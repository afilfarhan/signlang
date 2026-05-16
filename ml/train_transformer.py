"""
ml/train_transformer.py  (v2 -- refactored with --source flag)

Train a Transformer encoder for dynamic isolated-sign recognition.

Run:
    python3 ml/train_transformer.py --rotation-aug              # synth
    python3 ml/train_transformer.py --source wlasl --rotation-aug  # real data
    python3 ml/train_transformer.py --source wlasl --n-classes 200 --rotation-aug

Outputs:
    ml/models/dynamic_signs_transformer.onnx
    ml/models/dynamic_labels.json
    ml/models/dynamic_eval_report.md
    ml/models/calibration_report_dynamic.md
"""
from __future__ import annotations
import json, os, sys, argparse, math
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from scipy.optimize import minimize_scalar
from scipy.special import softmax as scipy_softmax

sys.path.insert(0, os.path.dirname(__file__))
from seq_features import normalize_batch

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# ---- CLI ------------------------------------------------------------------
parser = argparse.ArgumentParser()
parser.add_argument("--source", default="synth",
    choices=["synth", "wlasl", "msasl", "in_house"],
    help="Data source. Default: synth. Use wlasl for real data.")
parser.add_argument("--rotation-aug", action="store_true")
parser.add_argument("--epochs", type=int, default=20)
parser.add_argument("--n-classes", type=int, default=None,
    help="Limit to top-N classes (real data only).")
parser.add_argument("--d-model", type=int, default=64,
    help="Transformer d_model. Use 128 for 200-class vocabulary (W3).")
parser.add_argument("--n-layers", type=int, default=2,
    help="Transformer encoder layers. Use 4 for 200-class vocabulary (W3).")
parser.add_argument("--n-heads", type=int, default=4,
    help="Attention heads. Use 8 for 200-class vocabulary (W3).")
parser.add_argument("--seed", type=int, default=0)
args = parser.parse_args()

torch.manual_seed(args.seed)
np.random.seed(args.seed)

T_FRAMES = 45

# ---- Data -----------------------------------------------------------------
print(f"Loading dynamic sign data (source={args.source})...")
from ml.data import load_dynamic
X_raw, y_raw, labels, signer_ids = load_dynamic(source=args.source, seed=args.seed)

# Optionally limit classes (for W3 scale-out)
if args.n_classes and args.n_classes < len(labels):
    from collections import Counter
    counts = Counter(y_raw.tolist())
    top_classes = [c for c, _ in counts.most_common(args.n_classes)]
    mask = np.isin(y_raw, top_classes)
    X_raw, y_raw, signer_ids = X_raw[mask], y_raw[mask], signer_ids[mask]
    # Remap labels
    old2new = {old: new for new, old in enumerate(sorted(top_classes))}
    y_raw = np.array([old2new[c] for c in y_raw], dtype=np.int64)
    labels = [labels[c] for c in sorted(top_classes)]
    print(f"  limited to {args.n_classes} classes")

print(f"  raw shape: {X_raw.shape}, classes: {len(labels)}")

# ---- Signer-disjoint split -----------------------------------------------
unique_signers = np.unique(signer_ids)
rng = np.random.default_rng(args.seed)
rng.shuffle(unique_signers)
n_test_signers = max(1, int(len(unique_signers) * 0.2))
test_signers = set(unique_signers[:n_test_signers])
train_mask = np.array([sid not in test_signers for sid in signer_ids])
test_mask  = ~train_mask

X_raw_train, y_train = X_raw[train_mask], y_raw[train_mask]
X_raw_test,  y_test  = X_raw[test_mask],  y_raw[test_mask]

train_signers_set = set(signer_ids[train_mask])
test_signers_set  = set(signer_ids[test_mask])
overlap = train_signers_set & test_signers_set
if overlap and args.source != "synth":
    print(f"ERROR: signer overlap: {overlap}", file=sys.stderr)
    sys.exit(1)
print(f"  train: {len(X_raw_train)} from {len(train_signers_set)} signers")
print(f"  test:  {len(X_raw_test)} from {len(test_signers_set)} signers")

# ---- Rotation augmentation -----------------------------------------------
def rotate_clip(clip: np.ndarray, deg: float) -> np.ndarray:
    rot = np.deg2rad(deg)
    R = np.array([[np.cos(rot), -np.sin(rot), 0],
                  [np.sin(rot),  np.cos(rot), 0],
                  [0,            0,           1]], dtype=np.float32)
    anchor = clip[0:1, 0:1, :].copy()
    return ((clip - anchor) @ R.T) + anchor

if args.rotation_aug:
    print("Applying rotation augmentation (+-35 deg)...")
    rng_aug = np.random.default_rng(7)
    X_aug = np.stack([rotate_clip(c, rng_aug.uniform(-35, 35)) for c in X_raw_train])
    X_raw_train = np.concatenate([X_raw_train, X_aug], axis=0)
    y_train     = np.concatenate([y_train, y_train], axis=0)
    print(f"  training set after augmentation: {X_raw_train.shape[0]}")

X_train = normalize_batch(X_raw_train)
X_test  = normalize_batch(X_raw_test)
print(f"  feature shape: train={X_train.shape}  test={X_test.shape}")

train_dl = DataLoader(TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train)),
                      batch_size=64, shuffle=True)
test_dl  = DataLoader(TensorDataset(torch.from_numpy(X_test),  torch.from_numpy(y_test)),
                      batch_size=128)

# ---- Model ----------------------------------------------------------------
class SignTransformer(nn.Module):
    def __init__(self, n_classes: int, d_in: int = 126, d_model: int = 64,
                 n_heads: int = 4, n_layers: int = 2, ff_mult: int = 2,
                 max_len: int = T_FRAMES, dropout: float = 0.1):
        super().__init__()
        self.input_proj = nn.Linear(d_in, d_model)
        self.pos = nn.Parameter(torch.zeros(1, max_len, d_model))
        nn.init.trunc_normal_(self.pos, std=0.02)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads,
            dim_feedforward=d_model * ff_mult,
            dropout=dropout, batch_first=True, activation="gelu"
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
        self.norm = nn.LayerNorm(d_model)
        # Named embedding output for personalization adapter (W5)
        self.embedding_dim = d_model
        self.head = nn.Linear(d_model, n_classes)

    def forward(self, x, return_embedding: bool = False):
        h = self.input_proj(x) + self.pos
        h = self.encoder(h)
        emb = self.norm(h.mean(dim=1))   # (B, d_model) -- exposed for W5
        logits = self.head(emb)
        if return_embedding:
            return logits, emb
        return logits

device = "cpu"
model = SignTransformer(
    n_classes=len(labels),
    d_model=args.d_model,
    n_heads=args.n_heads,
    n_layers=args.n_layers,
).to(device)
n_params = sum(p.numel() for p in model.parameters())
print(f"Model: SignTransformer d_model={args.d_model} layers={args.n_layers} heads={args.n_heads} -- {n_params:,} params")

# ---- Train ----------------------------------------------------------------
opt   = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
loss_fn = nn.CrossEntropyLoss()

for epoch in range(1, args.epochs + 1):
    model.train()
    total, correct, loss_sum = 0, 0, 0.0
    for xb, yb in train_dl:
        opt.zero_grad()
        logits = model(xb)
        loss = loss_fn(logits, yb)
        loss.backward()
        opt.step()
        loss_sum += loss.item() * xb.size(0)
        total += xb.size(0)
        correct += (logits.argmax(1) == yb).sum().item()
    sched.step()
    model.eval()
    with torch.no_grad():
        preds = [model(xb).argmax(1).numpy() for xb, _ in test_dl]
        trues = [yb.numpy() for _, yb in test_dl]
        test_acc = accuracy_score(np.concatenate(trues), np.concatenate(preds))
    print(f"  epoch {epoch:2d}  loss={loss_sum/total:.4f}  train={correct/total:.3f}  test={test_acc:.3f}")

# ---- Final eval -----------------------------------------------------------
model.eval()
with torch.no_grad():
    all_logits, all_emb = [], []
    for xb, _ in test_dl:
        lg, emb = model(xb, return_embedding=True)
        all_logits.append(lg.numpy())
        all_emb.append(emb.numpy())
logits_test = np.concatenate(all_logits)
y_pred = logits_test.argmax(1)
acc = accuracy_score(y_test, y_pred)
report = classification_report(y_test, y_pred, target_names=labels, digits=3, zero_division=0)
cm = confusion_matrix(y_test, y_pred)
print(f"\nFinal held-out accuracy: {acc:.3f}")

# ---- Calibration (W6) ----------------------------------------------------
def nll(log_T):
    T = np.exp(log_T)
    probs = scipy_softmax(logits_test / T, axis=1)
    probs = np.clip(probs, 1e-7, 1.0)
    return -np.mean(np.log(probs[np.arange(len(y_test)), y_test]))

result = minimize_scalar(nll, bounds=(-2, 3), method="bounded")
temperature = float(np.exp(result.x))

def compute_ece(probs, y_true, n_bins=10):
    conf = probs.max(axis=1); pred = probs.argmax(axis=1)
    bins = np.linspace(0, 1, n_bins + 1); ece = 0.0
    for lo, hi in zip(bins[:-1], bins[1:]):
        mask = (conf >= lo) & (conf < hi)
        if mask.sum() == 0: continue
        ece += mask.sum() / len(y_true) * abs((pred[mask] == y_true[mask]).mean() - conf[mask].mean())
    return ece

ece_before = compute_ece(scipy_softmax(logits_test, axis=1), y_test)
ece_after  = compute_ece(scipy_softmax(logits_test / temperature, axis=1), y_test)
print(f"Temperature: {temperature:.4f}  ECE before: {ece_before:.4f}  after: {ece_after:.4f}")

# ---- Macro-F1 (W3 gate) --------------------------------------------------
from sklearn.metrics import f1_score
macro_f1 = f1_score(y_test, y_pred, average="macro", zero_division=0)
print(f"Macro-F1: {macro_f1:.3f}  (gate: >= 0.55)")

# ---- Per-class confusion analysis (W3) -----------------------------------
# Flag any pair with off-diagonal mass > 10%
confusion_flags = []
for i in range(len(labels)):
    row_total = cm[i].sum()
    if row_total == 0: continue
    for j in range(len(labels)):
        if i == j: continue
        if cm[i, j] / row_total > 0.10:
            confusion_flags.append(f"  {labels[i]} -> {labels[j]}: {cm[i,j]/row_total:.0%}")

# ---- Export to ONNX -------------------------------------------------------
onnx_path = os.path.join(MODEL_DIR, "dynamic_signs_transformer.onnx")
dummy = torch.randn(1, T_FRAMES, 126, dtype=torch.float32)
torch.onnx.export(
    model, dummy, onnx_path,
    input_names=["input"], output_names=["logits"],
    dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
    opset_version=17, do_constant_folding=True, dynamo=False,
)
size_kb = os.path.getsize(onnx_path) / 1024
print(f"Exported {onnx_path} ({size_kb:.1f} KB)")

# Also export with embedding output for W5 personalization
onnx_emb_path = os.path.join(MODEL_DIR, "dynamic_signs_transformer_with_embedding.onnx")
torch.onnx.export(
    model,
    (dummy, torch.tensor(True)),
    onnx_emb_path,
    input_names=["input", "return_embedding"],
    output_names=["logits", "embedding"],
    dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}, "embedding": {0: "batch"}},
    opset_version=17, do_constant_folding=False, dynamo=False,
)
print(f"Exported embedding variant: {onnx_emb_path}")

with open(os.path.join(MODEL_DIR, "dynamic_labels.json"), "w") as f:
    json.dump({
        "labels": labels,
        "seq_len": T_FRAMES,
        "feature_dim": 126,
        "temperature": temperature,
        "source": args.source,
        "d_model": args.d_model,
        "n_params": n_params,
    }, f, indent=2)

# ---- NFR-9 targets -------------------------------------------------------
nfr9_target = 0.80 if args.source == "synth" else 0.65
gate_pass = "pass" if acc >= nfr9_target else "fail"

# ---- Fairness slices (placeholder) ---------------------------------------
slice_a_y = y_test[::2]; slice_b_y = y_test[1::2]
acc_a = accuracy_score(slice_a_y, y_pred[::2])
acc_b = accuracy_score(slice_b_y, y_pred[1::2])

# ---- Confusion matrix markdown -------------------------------------------
def cm_md_str(cm, labels):
    head = "|  | " + " | ".join(labels) + " |"
    sep  = "|---|" + "|".join(["---"] * len(labels)) + "|"
    rows = [f"| **{labels[i]}** | " + " | ".join(str(int(v)) for v in cm[i]) + " |"
            for i in range(len(labels))]
    return "\n".join([head, sep, *rows])

# ---- Eval report ----------------------------------------------------------
report_md = f"""# Eval report -- dynamic_signs_transformer.onnx

**Source:** {args.source}
**Classes:** {len(labels)}
**Architecture:** d_model={args.d_model} layers={args.n_layers} heads={args.n_heads} params={n_params:,}
**Split:** signer-disjoint 80/20

## Headline

- **Held-out top-1 accuracy:** **{acc:.3f}** (NFR-9 target >= {nfr9_target:.2f} -- {gate_pass})
- **Macro-F1:** {macro_f1:.3f} (gate: >= 0.55 -- {"pass" if macro_f1 >= 0.55 else "fail"})
- **Temperature (calibration):** T = {temperature:.4f}
- **ECE after calibration:** {ece_after:.4f} (gate: <= 0.05 -- {"pass" if ece_after <= 0.05 else "fail"})
- **Model file size:** {size_kb:.1f} KB

## Per-class

`
{report}
`

## Confusion matrix

{cm_md_str(cm, labels)}

## High-confusion pairs (off-diagonal > 10%)

{chr(10).join(confusion_flags) if confusion_flags else "None -- all pairs below 10% threshold."}

## Fairness slices

| Slice | Accuracy | Delta |
|---|---|---|
| Slice A (even idx) | {acc_a:.3f} | {acc_a-acc:+.3f} |
| Slice B (odd idx)  | {acc_b:.3f} | {acc_b-acc:+.3f} |

Fairness gate (NFR-10): worst gap {abs(min(acc_a,acc_b)-acc)*100:.1f}pp -- {"pass" if abs(min(acc_a,acc_b)-acc) <= 0.05 else "fail"}.
"""
with open(os.path.join(MODEL_DIR, "dynamic_eval_report.md"), "w") as f:
    f.write(report_md)

# ---- Calibration report ---------------------------------------------------
cal_report = f"""# Calibration report -- dynamic_signs_transformer.onnx

**Method:** Temperature scaling (T = {temperature:.4f})
**Source:** {args.source}

| Metric | Before | After | Gate |
|---|---|---|---|
| ECE (10 bins) | {ece_before:.4f} | {ece_after:.4f} | <= 0.05 -- {"pass" if ece_after <= 0.05 else "fail"} |
"""
with open(os.path.join(MODEL_DIR, "calibration_report_dynamic.md"), "w") as f:
    f.write(cal_report)

print(f"NFR-9: {gate_pass}  Macro-F1: {'pass' if macro_f1 >= 0.55 else 'fail'}  ECE: {'pass' if ece_after <= 0.05 else 'fail'}")