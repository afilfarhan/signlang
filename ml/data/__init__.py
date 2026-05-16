"""
ml/data/__init__.py
Dataset registry for SignTutor v2.

Usage:
    from ml.data import load_static, load_dynamic

Each loader returns (X, y, labels, signer_ids) with shapes:
    static:  X (N, 21, 3) float32, y (N,) int64
    dynamic: X (N, T, 21, 3) float32, y (N,) int64

signer_ids is a (N,) array of opaque string IDs used to enforce
train/val/test signer disjointness (ADR-003).
"""
from __future__ import annotations
from typing import Literal

DataSource = Literal["synth", "wlasl", "msasl", "chicagofs", "asl_citizen", "in_house"]

def load_static(source: DataSource = "synth", **kwargs):
    """Load static fingerspelling data from the given source."""
    if source == "synth":
        from ml.data.synth_adapter import load_static_synth
        return load_static_synth(**kwargs)
    elif source == "chicagofs":
        from ml.data.asl_fingerspelling import load_chicagofs
        return load_chicagofs(**kwargs)
    elif source == "asl_citizen":
        from ml.data.asl_fingerspelling import load_asl_citizen
        return load_asl_citizen(**kwargs)
    elif source == "in_house":
        from ml.data.in_house import load_static_in_house
        return load_static_in_house(**kwargs)
    else:
        raise ValueError(f"Unknown static source: {source!r}. Valid: synth, chicagofs, asl_citizen, in_house")

def load_dynamic(source: DataSource = "synth", **kwargs):
    """Load dynamic isolated-sign data from the given source."""
    if source == "synth":
        from ml.data.synth_adapter import load_dynamic_synth
        return load_dynamic_synth(**kwargs)
    elif source == "wlasl":
        from ml.data.wlasl import load_wlasl
        return load_wlasl(**kwargs)
    elif source == "msasl":
        from ml.data.msasl import load_msasl
        return load_msasl(**kwargs)
    elif source == "in_house":
        from ml.data.in_house import load_dynamic_in_house
        return load_dynamic_in_house(**kwargs)
    else:
        raise ValueError(f"Unknown dynamic source: {source!r}. Valid: synth, wlasl, msasl, in_house")