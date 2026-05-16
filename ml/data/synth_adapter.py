"""
ml/data/synth_adapter.py
Thin adapter that wraps the v1 synthetic generators so they satisfy the
v2 loader interface: (X, y, labels, signer_ids).

In v2 the synth is a TEST FIXTURE only — not training data.
Use --source synth for fast iteration and CI parity tests.
"""
from __future__ import annotations
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

def load_static_synth(n_per_class: int = 400, seed: int = 0, **_):
    from synth_landmarks import make_dataset
    X, y, labels = make_dataset(n_per_class=n_per_class, seed=seed)
    # Synthetic data has no real signer IDs; assign one per sample so
    # the disjointness check can still run (it will trivially pass).
    signer_ids = np.array([f"synth_{i}" for i in range(len(y))])
    return X, y, labels, signer_ids

def load_dynamic_synth(n_per_class: int = 200, seed: int = 0, **_):
    from synth_sequences import make_dataset
    X, y, labels = make_dataset(n_per_class=n_per_class, seed=seed)
    signer_ids = np.array([f"synth_{i}" for i in range(len(y))])
    return X, y, labels, signer_ids