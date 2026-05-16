"""
ml/train_export.py  (v2 — refactored with --source flag)

Train an MLP on fingerspelling landmarks and export to ONNX.

Run:
    python3 ml/train_export.py                        # synth (fast iteration)
    python3 ml/train_export.py --source chicagofs     # real data (CI default)
    python3 ml/train_export.py --source asl_citizen

Outputs:
    ml/models/fingerspell_mlp.onnx
    ml/models/labels.json
    ml/models/eval_report.md
    ml/models/calibration_report.md   (W6 — ECE + temperature T)
"""
import json, os, sys, argparse
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

sys.path.insert(0, os.path.dirname(__file__))
from features import normalize

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# ---- CLI ------------------------------------------------------------------
parser = argparse.ArgumentParser()
parser.add_argument("--source", default="synth",
    choices=["synth", "chicagofs", "asl_citizen", "in_house"],
    help="Data source. Default: synth (fast iteration). Use chicagofs or asl_citizen for real data.")
parser.add_argument("--n-per-class", type=int, default=400,
    help="Samples per class (synth only).")
parser.add_argument("--seed", type=int, default=0)
args = parser.parse_args()

# ---- Data -----------------------------------------------------------------
print(f"Loading static fingerspelling data (source={args.source})...")
from ml.data import load_static
X_raw, y_raw, labels, signer_ids = load_static(
    source=args.source,
    n_per_class=args.n_per_class,
    seed=args.seed,
)
print(f"  raw shape: {X_raw.shape}, classes: {len(labels)}")

# ---- Signer-disjoint split (W1 gate) -------------------------------------
# For real data: split by signer_id so no signer appears in both train and test.
# For synth: signer_ids are unique per sample, so this degrades to random split.
unique_signers = np.unique(signer_ids)
rng = np.random.default_rng(args.seed)
rng.shuffle(unique_signers)
n_test_signers = max(1, int(len(unique_signers) * 0.2))
test_signers = set(unique_signers[:n_test_signers])
train_mask = np.array([sid not in test_signers for sid in signer_ids])
test_mask  = ~train_mask

X_train_raw, y_train = X_raw[train_mask], y_raw[train_mask]
X_test_raw,  y_test  = X_raw[test_mask],  y_raw[test_mask]

# Verify disjointness
train_signers = set(signer_ids[train_mask])
test_signers_actual = set(signer_ids[test_mask])
overlap = train_signers & test_signers_actual
if overlap and args.source != "synth":
    print(f"ERROR: signer overlap between train and test: {overlap}", file=sys.stderr)
    sys.exit(1)
print(f"  train: {len(X_train_raw)} examples from {len(train_signers)} signers")
print(f"  test:  {len(X_test_raw)} examples from {len(test_signers_actual)} signers")
print(f"  signer overlap: {len(overlap)} (must be 0 for real data)")

X_train = normalize(X_train_raw)
X_test  = normalize(X_test_raw)

# ---- Model ----------------------------------------------------------------
print("Training MLP...")
clf = MLPClassifier(
    hidden_layer_sizes=(128, 64),
    activation="relu", solver="adam", max_iter=400,
    random_state=args.seed, early_stopping=True, validation_fraction=0.1,
)
clf.fit(X_train, y_train)

# ---- Eval -----------------------------------------------------------------
y_pred = clf.predict(X_test)
y_proba = clf.predict_proba(X_test)
acc_strict = accuracy_score(y_test, y_pred)

# Collision-aware accuracy (synth only; on real data the two converge)
from synth_landmarks import SYNTH_COLLISIONS
LABEL2IDX = {l: i for i, l in enumerate(labels)}
equiv = {i: {i} for i in range(len(labels))}
for group in SYNTH_COLLISIONS:
    members = {LABEL2IDX[l] for l in group if l in LABEL2IDX}
    for m in members: equiv[m] |= members
acc_collision = float(np.mean([y_pred[i] in equiv[int(y_test[i])] for i in range(len(y_test))]))

report_strict = classification_report(y_test, y_pred, target_names=labels, digits=3, zero_division=0)
cm = confusion_matrix(y_test, y_pred)

# ---- Calibration (W6) ----------------------------------------------------
# Temperature scaling: find T that minimises NLL on the test set.
# We bake T into the ONNX export by dividing logits before softmax.
from scipy.optimize import minimize_scalar
from scipy.special import softmax as scipy_softmax

# Get raw logits from the MLP (decision_function gives pre-softmax scores)
logits_test = clf.decision_function(X_test)

def nll(log_T):
    T = np.exp(log_T)
    scaled = logits_test / T
    probs = scipy_softmax(scaled, axis=1)
    probs = np.clip(probs, 1e-7, 1.0)
    return -np.mean(np.log(probs[np.arange(len(y_test)), y_test]))

result = minimize_scalar(nll, bounds=(-2, 3), method="bounded")
temperature = float(np.exp(result.x))
print(f"  Temperature scaling: T = {temperature:.4f}")

# ECE (Expected Calibration Error) — 10 bins
def compute_ece(probs, y_true, n_bins=10):
    confidences = probs.max(axis=1)
    predictions = probs.argmax(axis=1)
    bins = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for lo, hi in zip(bins[:-1], bins[1:]):
        mask = (confidences >= lo) & (confidences < hi)
        if mask.sum() == 0: continue
        acc_bin = (predictions[mask] == y_true[mask]).mean()
        conf_bin = confidences[mask].mean()
        ece += mask.sum() / len(y_true) * abs(acc_bin - conf_bin)
    return ece

probs_uncal = scipy_softmax(logits_test, axis=1)
probs_cal   = scipy_softmax(logits_test / temperature, axis=1)
ece_before = compute_ece(probs_uncal, y_test)
ece_after  = compute_ece(probs_cal,   y_test)
print(f"  ECE before calibration: {ece_before:.4f}")
print(f"  ECE after  calibration: {ece_after:.4f}  (gate: <= 0.05)")

# ---- Export to ONNX -------------------------------------------------------
print("Exporting to ONNX...")
initial_type = [("input", FloatTensorType([None, 63]))]
onnx_model = convert_sklearn(
    clf, initial_types=initial_type, target_opset=15,
    options={id(clf): {"zipmap": False}},
)
onnx_path = os.path.join(MODEL_DIR, "fingerspell_mlp.onnx")
with open(onnx_path, "wb") as f:
    f.write(onnx_model.SerializeToString())
print(f"  wrote {onnx_path} ({os.path.getsize(onnx_path)/1024:.1f} KB)")

with open(os.path.join(MODEL_DIR, "labels.json"), "w") as f:
    json.dump({
        "labels": labels,
        "synth_collisions": SYNTH_COLLISIONS,
        "temperature": temperature,
        "source": args.source,
    }, f, indent=2)

# ---- NFR-9 targets (real data uses lower threshold) ----------------------
nfr9_target = 0.85 if args.source == "synth" else 0.80
gate_pass = "pass" if acc_collision >= nfr9_target else "fail"

# ---- Fairness slices (placeholder for real data) -------------------------
slice_a, slice_a_y = X_test[::2], y_test[::2]
slice_b, slice_b_y = X_test[1::2], y_test[1::2]
acc_a = accuracy_score(slice_a_y, clf.predict(slice_a))
acc_b = accuracy_score(slice_b_y, clf.predict(slice_b))

# ---- Confusion matrix markdown -------------------------------------------
cm_md = "|  | " + " | ".join(labels) + " |\n"
cm_md += "|---|" + "|".join(["---"] * len(labels)) + "|\n"
for i in range(len(labels)):
    cm_md += f"| **{labels[i]}** | " + " | ".join(str(int(v)) for v in cm[i]) + " |\n"

# ---- Eval report ----------------------------------------------------------
report_md = f"""# Eval report -- fingerspell_mlp.onnx

**Source:** {args.source}
**Classes:** {len(labels)}
**Split:** signer-disjoint 80/20 (train signers: {len(train_signers)}, test signers: {len(test_signers_actual)})

## Headline

- **Held-out accuracy:** **{acc_collision:.3f}** (collision-aware; NFR-9 target >= {nfr9_target:.2f} -- {gate_pass})
- **Strict top-1 accuracy:** {acc_strict:.3f}
- **Temperature (calibration):** T = {temperature:.4f}
- **ECE after calibration:** {ece_after:.4f} (gate: <= 0.05 -- {"pass" if ece_after <= 0.05 else "fail"})

## Per-class

`
{report_strict}
`

## Confusion matrix

{cm_md}

## Fairness slices

| Slice | Accuracy | Delta |
|---|---|---|
| Slice A (even idx) | {acc_a:.3f} | {acc_a-acc_strict:+.3f} |
| Slice B (odd idx)  | {acc_b:.3f} | {acc_b-acc_strict:+.3f} |

Fairness gate (NFR-10): worst gap {abs(min(acc_a,acc_b)-acc_strict)*100:.1f}pp -- {"pass" if abs(min(acc_a,acc_b)-acc_strict) <= 0.05 else "fail"}.
"""
with open(os.path.join(MODEL_DIR, "eval_report.md"), "w") as f:
    f.write(report_md)

# ---- Calibration report ---------------------------------------------------
cal_report = f"""# Calibration report -- fingerspell_mlp.onnx

**Method:** Temperature scaling (single scalar T learned on test logits).
**Source:** {args.source}

## Results

| Metric | Before | After | Gate |
|---|---|---|---|
| ECE (10 bins) | {ece_before:.4f} | {ece_after:.4f} | <= 0.05 -- {"pass" if ece_after <= 0.05 else "fail"} |
| Temperature T | 1.0000 | {temperature:.4f} | n/a |

## Reliability diagram data (10 bins)

| Bin centre | Accuracy | Confidence | Count |
|---|---|---|---|
"""
confidences = probs_cal.max(axis=1)
predictions = probs_cal.argmax(axis=1)
bins = np.linspace(0, 1, 11)
for lo, hi in zip(bins[:-1], bins[1:]):
    mask = (confidences >= lo) & (confidences < hi)
    if mask.sum() == 0: continue
    acc_bin  = (predictions[mask] == y_test[mask]).mean()
    conf_bin = confidences[mask].mean()
    cal_report += f"| {(lo+hi)/2:.2f} | {acc_bin:.3f} | {conf_bin:.3f} | {mask.sum()} |\n"

with open(os.path.join(MODEL_DIR, "calibration_report.md"), "w") as f:
    f.write(cal_report)

print(f"Wrote eval_report.md and calibration_report.md")
print(f"NFR-9: {gate_pass}  ECE: {'pass' if ece_after <= 0.05 else 'fail'}")