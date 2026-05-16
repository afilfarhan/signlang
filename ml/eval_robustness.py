"""
ml/eval_robustness.py  (v2 -- source-aware)

Stress-tests the trained Transformer under perturbation slices.
Now accepts --source to match the training source.

Run after train_transformer.py:
    python3 ml/eval_robustness.py --source wlasl
    python3 ml/eval_robustness.py --source synth  # fast iteration
"""
from __future__ import annotations
import os, sys, argparse
import numpy as np
import onnxruntime as ort
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

sys.path.insert(0, os.path.dirname(__file__))
from seq_features import normalize_batch

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
ONNX_PATH = os.path.join(MODEL_DIR, "dynamic_signs_transformer.onnx")

parser = argparse.ArgumentParser()
parser.add_argument("--source", default="synth",
    choices=["synth", "wlasl", "msasl", "in_house"])
args = parser.parse_args()

print(f"Loading data (source={args.source}) + model...")
from ml.data import load_dynamic

if args.source == "synth":
    from ml.tests.fixtures.synth_sequences import make_dataset
    X_raw, y, labels = make_dataset(n_per_class=200, seed=0)
    _, X_test_raw, _, y_test = train_test_split(
        X_raw, y, test_size=0.2, random_state=42, stratify=y)
else:
    X_test_raw, y_test, labels, _ = load_dynamic(args.source, split="test")

sess = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])

def evaluate(X_raw_slice: np.ndarray, name: str) -> float:
    feats = normalize_batch(X_raw_slice).astype(np.float32)
    logits = sess.run(["logits"], {"input": feats})[0]
    pred = logits.argmax(1)
    acc = accuracy_score(y_test, pred)
    print(f"  {name:22s} acc = {acc:.3f}")
    return acc

rng = np.random.default_rng(123)
results = {}
results["clean"] = evaluate(X_test_raw, "clean")

X_j = X_test_raw + rng.normal(0, 0.012, size=X_test_raw.shape).astype(np.float32)
results["landmark_jitter"] = evaluate(X_j, "landmark_jitter")

X_d = X_test_raw.copy()
for n in range(X_d.shape[0]):
    drop_idx = np.sort(rng.choice(X_d.shape[1], size=int(0.20 * X_d.shape[1]), replace=False))
    for f in drop_idx:
        X_d[n, f] = X_d[n, max(0, f-1)]
results["dropped_frames"] = evaluate(X_d, "dropped_frames")

X_z = X_test_raw.copy(); X_z[..., 2] = 0
results["missing_z"] = evaluate(X_z, "missing_z")

def rotate_clip(clip, deg):
    rot = np.deg2rad(deg)
    R = np.array([[np.cos(rot), -np.sin(rot), 0],
                  [np.sin(rot),  np.cos(rot), 0],
                  [0,            0,           1]], dtype=np.float32)
    anchor = clip[0:1, 0:1, :].copy()
    return ((clip - anchor) @ R.T) + anchor

X_r = np.stack([rotate_clip(c, rng.uniform(-25, 25)) for c in X_test_raw])
results["rotated"] = evaluate(X_r, "rotated")

X_s = np.stack([(c - c[0:1,0:1,:]) * rng.uniform(0.8, 1.2) + c[0:1,0:1,:] for c in X_test_raw])
results["scale_shift"] = evaluate(X_s, "scale_shift")

clean = results["clean"]
gate = 0.05
rows = []
for name, acc in results.items():
    delta = acc - clean
    pass_ = "OK" if abs(delta) <= gate or name == "clean" else "FAIL"
    rows.append(f"| {name} | {acc:.3f} | {delta:+.3f} | {pass_} |")

report = f"""# Robustness report -- dynamic_signs_transformer.onnx

**Source:** {args.source}

## Robustness slices

| Slice | Accuracy | Delta vs. clean | Within +-5pp? |
|---|---|---|---|
{chr(10).join(rows)}

## Slice descriptions

- **clean** -- in-distribution baseline.
- **landmark_jitter** -- Gaussian sigma=0.012 on every landmark (camera shake).
- **dropped_frames** -- 20% of frames replaced by predecessor (low FPS).
- **missing_z** -- depth coordinate zeroed (older webcams).
- **rotated** -- whole-clip rotation +-25 degrees (signer angle).
- **scale_shift** -- +-20% hand-size scaling (different signers/distances).

## Action when a slice fails on real data

Follow the pattern in ml/ROBUSTNESS_GATE_DEMO.md:
detect -> diagnose -> fix at training time only -> re-measure -> ship.
"""
out = os.path.join(MODEL_DIR, "dynamic_robustness_report.md")
with open(out, "w") as f:
    f.write(report)
print(f"\nWrote {out}")