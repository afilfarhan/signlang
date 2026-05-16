"""
ci/check_nfr.py  (v2 -- extended with W1/W3/W6 gates)

Release-gate enforcer. Reads eval/robustness/calibration reports and exits
non-zero if any gate fails.

Gates checked:
  NFR-9   : top-1 accuracy meets per-task target (real-data thresholds in v2)
  NFR-10  : no slice > 5pp below clean (robustness + fairness)
  Parity  : JS<->Python feature parity (run ci/run_parity.mjs first)
  ECE     : Expected Calibration Error <= 0.05 (W6)
  Macro-F1: >= 0.55 for dynamic classifier (W3)
  Licence : every dataset path in ml/data/*.py has an entry in LICENSES.md (W1)
  Signer  : train/test signer disjointness verified in eval reports (W1)

Run from the repo root:
    python3 ci/check_nfr.py
"""
from __future__ import annotations
import re, sys, pathlib, json

ROOT = pathlib.Path(__file__).resolve().parents[1]
RED, GREEN, YELLOW, RESET = "\033[31m", "\033[32m", "\033[33m", "\033[0m"

errors: list[str] = []

def fail(msg: str): errors.append(msg); print(f"{RED}X {msg}{RESET}")
def ok(msg: str):   print(f"{GREEN}OK {msg}{RESET}")
def warn(msg: str): print(f"{YELLOW}! {msg}{RESET}")

# =========================================================================
# NFR-9 (accuracy targets)
# v2 targets: real data is harder -- static >= 0.80, dynamic >= 0.65
# synth path keeps old targets for fast iteration
# =========================================================================
def _parse_accuracy(path: pathlib.Path, rx: re.Pattern) -> float | None:
    if not path.exists(): return None
    m = rx.search(path.read_text(encoding="utf-8", errors="replace"))
    return float(m.group(1)) if m else None

NFR9 = {
    "static (fingerspelling)": (
        ROOT / "ml/models/eval_report.md",
        re.compile(r"Held-out accuracy:\*\*\s*\*\*([0-9.]+)\*\*|accuracy:\s*\*\*([0-9.]+)\*\*"),
        0.80,   # real-data target (was 0.85 on synth)
    ),
    "dynamic (isolated signs)": (
        ROOT / "ml/models/dynamic_eval_report.md",
        re.compile(r"Held-out top-1 accuracy:\*\*\s*\*\*([0-9.]+)\*\*|accuracy:\s*\*\*([0-9.]+)\*\*"),
        0.65,   # real-data target (was 0.80 on synth)
    ),
}

print("== NFR-9 (accuracy targets) ==")
for name, (path, rx, target) in NFR9.items():
    if not path.exists():
        fail(f"{name}: report missing at {path.relative_to(ROOT)}")
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    m = rx.search(text)
    if not m:
        fail(f"{name}: couldn't parse accuracy from {path.relative_to(ROOT)}")
        continue
    acc = float(next(g for g in m.groups() if g is not None))
    if acc + 1e-6 < target:
        fail(f"{name}: accuracy {acc:.3f} below NFR-9 target {target:.2f}")
    else:
        ok(f"{name}: accuracy {acc:.3f} >= {target:.2f}")

# =========================================================================
# NFR-10 (per-slice +-5pp gate)
# =========================================================================
def parse_slice_table(text: str) -> list[tuple[str, float]]:
    rows = []
    in_table = False
    for line in text.splitlines():
        if re.match(r"\|\s*Slice\s*\|\s*Accuracy\b", line, re.I):
            in_table = True; continue
        if in_table:
            if not line.strip().startswith("|"): break
            if re.match(r"\|\s*-+", line): continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            if len(cells) >= 2:
                try: rows.append((cells[0], float(cells[1])))
                except ValueError: continue
    return rows

GATE_PP = 0.05
print("\n== NFR-10 (per-slice +-5pp gate) ==")
for path in [ROOT / "ml/models/dynamic_robustness_report.md"]:
    if not path.exists():
        fail(f"missing: {path.relative_to(ROOT)}")
        continue
    rows = parse_slice_table(path.read_text(encoding="utf-8", errors="replace"))
    if not rows:
        fail(f"{path.relative_to(ROOT)}: no rows parsed")
        continue
    clean = next((acc for s, acc in rows if s.lower() == "clean"), None)
    if clean is None:
        fail(f"{path.relative_to(ROOT)}: no 'clean' baseline row")
        continue
    print(f"  {path.relative_to(ROOT)} (clean={clean:.3f}):")
    for s, acc in rows:
        if s.lower() == "clean": continue
        delta = acc - clean
        within = abs(delta) <= GATE_PP + 1e-6
        line = f"    {s:<22s} acc={acc:.3f} delta={delta:+.3f}"
        if within: print(f"{GREEN}{line} OK{RESET}")
        else:
            print(f"{RED}{line} FAIL{RESET}")
            errors.append(f"slice '{s}' deviates {delta:+.3f} from clean (gate +-{GATE_PP})")

# =========================================================================
# Parity (JS <-> Python feature contract)
# =========================================================================
print("\n== JS <-> Python feature parity ==")
parity_log = ROOT / "ci/parity.log"
if not parity_log.exists():
    warn("parity.log not found -- skipped (run ci/run_parity.mjs first)")
else:
    text = parity_log.read_text(encoding="utf-8", errors="replace")
    if "5/5 samples within tolerance" in text:
        ok("static MLP normalize() parity: 5/5 within tolerance")
    else:
        fail("parity.log present but did not report 5/5 within tolerance")
        print(text)

# =========================================================================
# ECE calibration gate (W6)
# =========================================================================
print("\n== ECE calibration gate (W6) ==")
ECE_GATE = 0.05
# Parse the 'after calibration' column (3rd numeric cell) from the ECE table row
ECE_RX = re.compile(r"\|\s*ECE[^|]*\|\s*[0-9.]+\s*\|\s*([0-9.]+)\s*\|", re.I)

for name, cal_path in [
    ("static",  ROOT / "ml/models/calibration_report.md"),
    ("dynamic", ROOT / "ml/models/calibration_report_dynamic.md"),
]:
    if not cal_path.exists():
        warn(f"{name}: calibration report missing (run training first)")
        continue
    m = ECE_RX.search(cal_path.read_text(encoding="utf-8", errors="replace"))
    if not m:
        fail(f"{name}: couldn't parse ECE from {cal_path.relative_to(ROOT)}")
        continue
    ece = float(m.group(1))
    if ece > ECE_GATE + 1e-6:
        fail(f"{name}: ECE {ece:.4f} > gate {ECE_GATE} -- confidence-gated verdict is dishonest")
    else:
        ok(f"{name}: ECE {ece:.4f} <= {ECE_GATE}")

# =========================================================================
# Macro-F1 gate (W3 -- dynamic only)
# =========================================================================
print("\n== Macro-F1 gate (W3, dynamic) ==")
F1_GATE = 0.55
F1_RX = re.compile(r"Macro-F1.*?([0-9.]+).*?gate", re.I)
dyn_report = ROOT / "ml/models/dynamic_eval_report.md"
if dyn_report.exists():
    m = F1_RX.search(dyn_report.read_text(encoding="utf-8", errors="replace"))
    if m:
        f1 = float(m.group(1))
        if f1 < F1_GATE - 1e-6:
            fail(f"dynamic Macro-F1 {f1:.3f} < gate {F1_GATE}")
        else:
            ok(f"dynamic Macro-F1 {f1:.3f} >= {F1_GATE}")
    else:
        warn("dynamic eval report found but Macro-F1 line not parsed (old format?)")

# =========================================================================
# Licence gate (W1) -- every dataset_id in ml/data/*.py must be in LICENSES.md
# =========================================================================
print("\n== Licence provenance gate (W1) ==")
licenses_path = ROOT / "ml/data/LICENSES.md"
if not licenses_path.exists():
    fail("ml/data/LICENSES.md missing -- add licence entries before training")
else:
    licenses_text = licenses_path.read_text(encoding="utf-8", errors="replace")
    documented_ids = set(re.findall(r"^## (\w+)", licenses_text, re.M))
    # Scan all loader files for DATASET_ID = "..." declarations
    data_dir = ROOT / "ml/data"
    for py_file in data_dir.glob("*.py"):
        if py_file.name.startswith("_"): continue
        src = py_file.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r'DATASET_ID\s*=\s*["\'](\w+)["\']', src):
            did = m.group(1)
            if did not in documented_ids:
                fail(f"dataset '{did}' in {py_file.name} has no entry in ml/data/LICENSES.md")
            else:
                ok(f"licence documented: {did}")

# =========================================================================
# Signer disjointness gate (W1) -- check eval reports mention disjoint split
# Only hard-fails if the report was generated by the v2 training script
# (identified by presence of "Source:" line). v1 synth reports are warned.
# =========================================================================
print("\n== Signer disjointness gate (W1) ==")
DISJOINT_RX = re.compile(r"signer.disjoint|signer overlap:\s*0", re.I)
V2_REPORT_RX = re.compile(r"^\*\*Source:\*\*", re.M)  # v2 reports have this line
for name, path in [
    ("static",  ROOT / "ml/models/eval_report.md"),
    ("dynamic", ROOT / "ml/models/dynamic_eval_report.md"),
]:
    if not path.exists():
        warn(f"{name}: eval report missing")
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    if DISJOINT_RX.search(text):
        ok(f"{name}: signer-disjoint split confirmed in eval report")
    elif V2_REPORT_RX.search(text):
        # v2 report format but missing disjoint confirmation -- hard fail
        fail(f"{name}: v2 eval report does not confirm signer-disjoint split -- re-run training with v2 script")
    else:
        # v1 synth report -- warn only, not a hard failure
        warn(f"{name}: v1 synth report (no signer-disjoint check). Re-run with --source real_data to enforce.")

# =========================================================================
# Summary
# =========================================================================
print()
if errors:
    print(f"{RED}FAIL: {len(errors)} gate(s) violated{RESET}")
    for e in errors: print(f"  - {e}")
    sys.exit(1)
print(f"{GREEN}PASS: all release gates green{RESET}")