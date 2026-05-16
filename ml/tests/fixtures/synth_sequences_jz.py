"""
ml/tests/fixtures/synth_sequences_jz.py
Synthetic motion templates for J and Z -- the two ASL motion letters
missing from the v1 synth. Used as test fixtures only; real WLASL data
is the training source for W2.

J: index finger traces a 'J' curve (down then hook left)
Z: index finger traces a 'Z' (right, diagonal down-left, right)
"""
from __future__ import annotations
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from ml.tests.fixtures.synth_sequences import (
    T_FRAMES, N_LANDMARKS, _closed_fist, _interp
)

def _j_wrist_path(t: np.ndarray) -> np.ndarray:
    """J: hand starts high, traces downward then hooks left."""
    x = 0.55 + 0.02 * np.sin(np.pi * t)
    y = _interp(0.25, 0.55, t)
    # Hook: last 20% curves left
    hook = np.maximum(0, (t - 0.8) / 0.2)
    x = x - 0.08 * hook
    return np.stack([x, y, np.zeros_like(x)], axis=-1).astype(np.float32)

def _z_wrist_path(t: np.ndarray) -> np.ndarray:
    """Z: three strokes -- right, diagonal down-left, right."""
    x = np.where(t < 0.33,
        _interp(0.40, 0.65, t / 0.33),
        np.where(t < 0.66,
            _interp(0.65, 0.40, (t - 0.33) / 0.33),
            _interp(0.40, 0.65, (t - 0.66) / 0.34)
        )
    )
    y = np.where(t < 0.33,
        0.35 + np.zeros_like(t),
        np.where(t < 0.66,
            _interp(0.35, 0.55, (t - 0.33) / 0.33),
            0.55 + np.zeros_like(t)
        )
    )
    return np.stack([x, y, np.zeros_like(x)], axis=-1).astype(np.float32)

def _synthesize_jz(name: str, rng: np.random.Generator) -> np.ndarray:
    t = np.linspace(0, 1, T_FRAMES, dtype=np.float32)
    wrists = _j_wrist_path(t) if name == "J" else _z_wrist_path(t)
    palm_scale = 0.18 * (1 + rng.normal(0, 0.10))
    rot_deg = rng.normal(0, 12)
    rot = np.deg2rad(rot_deg)
    R = np.array([[np.cos(rot), -np.sin(rot), 0],
                  [np.sin(rot),  np.cos(rot), 0],
                  [0,            0,           1]], dtype=np.float32)
    cam_jitter = rng.normal(0, 0.01, size=(1, 3)).astype(np.float32)
    # J and Z use index-extended hand shape
    from ml.tests.fixtures.synth_sequences import _index_middle_extended
    base_shape = _index_middle_extended(palm_scale)
    seq = np.zeros((T_FRAMES, N_LANDMARKS, 3), dtype=np.float32)
    for fi in range(T_FRAMES):
        local = base_shape.copy() @ R.T
        local += rng.normal(0, 0.003, size=local.shape).astype(np.float32)
        seq[fi] = local + wrists[fi] + cam_jitter
    return seq

def make_jz_dataset(n_per_class: int = 200, seed: int = 0):
    """Return (X, y, labels) for J and Z only."""
    rng = np.random.default_rng(seed)
    X, y = [], []
    for ci, name in enumerate(["J", "Z"]):
        for _ in range(n_per_class):
            X.append(_synthesize_jz(name, rng))
            y.append(ci)
    return np.stack(X).astype(np.float32), np.array(y, dtype=np.int64), ["J", "Z"]