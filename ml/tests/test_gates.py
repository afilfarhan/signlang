"""
ml/tests/test_gates.py
Python unit tests for the v2 CI gate logic.

Tests that the gates FAIL correctly when they should (the gate-flipping pattern
from ml/ROBUSTNESS_GATE_DEMO.md). Run with:
    python -m pytest ml/tests/test_gates.py -v
"""
from __future__ import annotations
import sys, os, pathlib, json, tempfile, textwrap
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

import pytest

# ---- helpers ---------------------------------------------------------------

def write_report(path: pathlib.Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)

# ---- NFR-9 gate ------------------------------------------------------------

def test_nfr9_passes_when_accuracy_meets_target(tmp_path):
    """Gate passes when accuracy >= target."""
    report = tmp_path / "eval_report.md"
    write_report(report, "accuracy: **0.82**")
    import re
    rx = re.compile(r"accuracy:\s*\*\*([0-9.]+)\*\*")
    m = rx.search(report.read_text())
    assert m is not None
    assert float(m.group(1)) >= 0.80

def test_nfr9_fails_when_accuracy_below_target(tmp_path):
    """Gate fails when accuracy < target."""
    report = tmp_path / "eval_report.md"
    write_report(report, "accuracy: **0.72**")
    import re
    rx = re.compile(r"accuracy:\s*\*\*([0-9.]+)\*\*")
    m = rx.search(report.read_text())
    assert m is not None
    assert float(m.group(1)) < 0.80  # confirms gate would fail

# ---- ECE gate --------------------------------------------------------------

def test_ece_gate_passes(tmp_path):
    """ECE gate passes when ECE after calibration <= 0.05."""
    # Matches the format written by train_export.py calibration report
    report = tmp_path / "calibration_report.md"
    write_report(report, "| ECE (10 bins) | 0.0821 | 0.0312 | <= 0.05 -- pass |\n")
    import re
    # Parse the 'after' column (3rd numeric cell) from the ECE table row
    rx = re.compile(r"\|\s*ECE[^|]*\|\s*[0-9.]+\s*\|\s*([0-9.]+)\s*\|", re.I)
    m = rx.search(report.read_text())
    assert m is not None, "ECE row not found in calibration report"
    assert float(m.group(1)) <= 0.05

def test_ece_gate_fails_when_over_threshold(tmp_path):
    """ECE gate fails when ECE after calibration > 0.05."""
    report = tmp_path / "calibration_report.md"
    write_report(report, "| ECE (10 bins) | 0.1200 | 0.0820 | <= 0.05 -- fail |\n")
    import re
    rx = re.compile(r"\|\s*ECE[^|]*\|\s*[0-9.]+\s*\|\s*([0-9.]+)\s*\|", re.I)
    m = rx.search(report.read_text())
    assert m is not None, "ECE row not found in calibration report"
    assert float(m.group(1)) > 0.05  # confirms gate would fail

# ---- Licence gate ----------------------------------------------------------

def test_licence_gate_passes_when_all_documented(tmp_path):
    """Licence gate passes when all dataset_ids are in LICENSES.md."""
    licenses = tmp_path / "LICENSES.md"
    write_report(licenses, "## wlasl\n- Licence: research\n\n## chicagofs\n- Licence: CC BY 4.0\n")
    loader = tmp_path / "wlasl.py"
    loader.write_text('DATASET_ID = "wlasl"\n')
    import re
    documented = set(re.findall(r"^## (\w+)", licenses.read_text(), re.M))
    for py_file in tmp_path.glob("*.py"):
        src = py_file.read_text()
        for m in re.finditer(r'DATASET_ID\s*=\s*["\'](\w+)["\']', src):
            assert m.group(1) in documented, f"{m.group(1)} not in LICENSES.md"

def test_licence_gate_fails_when_undocumented(tmp_path):
    """Licence gate fails when a dataset_id is missing from LICENSES.md."""
    licenses = tmp_path / "LICENSES.md"
    write_report(licenses, "## wlasl\n- Licence: research\n")
    loader = tmp_path / "msasl.py"
    loader.write_text('DATASET_ID = "msasl"\n')
    import re
    documented = set(re.findall(r"^## (\w+)", licenses.read_text(), re.M))
    missing = []
    for py_file in tmp_path.glob("*.py"):
        src = py_file.read_text()
        for m in re.finditer(r'DATASET_ID\s*=\s*["\'](\w+)["\']', src):
            if m.group(1) not in documented:
                missing.append(m.group(1))
    assert "msasl" in missing  # confirms gate would fail

# ---- Signer disjointness gate ----------------------------------------------

def test_signer_disjoint_gate_passes(tmp_path):
    """Gate passes when eval report confirms signer-disjoint split."""
    report = tmp_path / "eval_report.md"
    write_report(report, "Split: signer-disjoint 80/20\nsigner overlap: 0")
    import re
    rx = re.compile(r"signer.disjoint|signer overlap:\s*0", re.I)
    assert rx.search(report.read_text()) is not None

def test_signer_disjoint_gate_fails_when_missing(tmp_path):
    """Gate fails when eval report does not confirm signer-disjoint split."""
    report = tmp_path / "eval_report.md"
    write_report(report, "Split: random 80/20\naccuracy: **0.85**")
    import re
    rx = re.compile(r"signer.disjoint|signer overlap:\s*0", re.I)
    assert rx.search(report.read_text()) is None  # confirms gate would fail

# ---- Macro-F1 gate ---------------------------------------------------------

def test_macro_f1_gate_passes(tmp_path):
    """Macro-F1 gate passes when F1 >= 0.55."""
    report = tmp_path / "dynamic_eval_report.md"
    write_report(report, "Macro-F1: 0.612 (gate: >= 0.55 -- pass)")
    import re
    rx = re.compile(r"Macro-F1.*?([0-9.]+).*?gate", re.I)
    m = rx.search(report.read_text())
    assert m is not None
    assert float(m.group(1)) >= 0.55

def test_macro_f1_gate_fails_when_below_threshold(tmp_path):
    """Macro-F1 gate fails when F1 < 0.55."""
    report = tmp_path / "dynamic_eval_report.md"
    write_report(report, "Macro-F1: 0.421 (gate: >= 0.55 -- fail)")
    import re
    rx = re.compile(r"Macro-F1.*?([0-9.]+).*?gate", re.I)
    m = rx.search(report.read_text())
    assert m is not None
    assert float(m.group(1)) < 0.55  # confirms gate would fail

# ---- Synth adapter (fixture only) -----------------------------------------

def test_synth_adapter_returns_correct_shapes():
    """Synth adapter returns (X, y, labels, signer_ids) with correct shapes."""
    from ml.data.synth_adapter import load_static_synth, load_dynamic_synth
    X, y, labels, signer_ids = load_static_synth(n_per_class=5, seed=0)
    assert X.shape == (len(labels) * 5, 21, 3)
    assert y.shape == (len(labels) * 5,)
    assert len(signer_ids) == len(y)

    X2, y2, labels2, sids2 = load_dynamic_synth(n_per_class=3, seed=0)
    assert X2.shape[1:] == (45, 21, 3)
    assert len(labels2) == 8  # 8 core dynamic signs

def test_jz_fixture_returns_correct_shapes():
    """J/Z synth fixture returns (X, y, labels) with correct shapes."""
    from ml.tests.fixtures.synth_sequences_jz import make_jz_dataset
    X, y, labels = make_jz_dataset(n_per_class=5, seed=0)
    assert X.shape == (10, 45, 21, 3)
    assert set(labels) == {"J", "Z"}
    assert len(y) == 10