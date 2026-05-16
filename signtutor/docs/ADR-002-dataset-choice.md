# ADR-002 -- Dataset Choice and Licence Stance

**Status:** Accepted
**Date:** 2025
**Workstream:** W1 (Real data)

## Context

v1 used synthetic landmark data. v2 requires real signer data to close the
accuracy gap on real-world users. We need datasets that are:
1. Publicly available for research
2. Clearly licensed
3. Diverse enough to pass NFR-10 fairness slices
4. Large enough to train a 200-class Transformer

## Decision

### Static fingerspelling
**Primary:** ChicagoFSWild+ (CC BY 4.0, ~7,000 sequences, 26 letters)
**Secondary:** ASL Citizen (CC BY 4.0, 2,731 signs, 52 signers, strong demographic diversity)

ChicagoFSWild+ is chosen as primary because it covers all 26 letters including
J and Z (motion letters), has a permissive licence, and has signer IDs for
disjoint splits. ASL Citizen is added as a secondary source for its demographic
diversity (Monk scale skin tones, age range, handedness balance).

### Dynamic isolated signs
**Primary:** WLASL (research-only, 2,000 classes, ~21,000 instances)
**Secondary:** MS-ASL (research-only, 1,000 classes, ~25,000 instances)

WLASL is chosen as primary for its class breadth (2,000 classes covers the
200-sign v2 vocabulary with room to grow). MS-ASL is added for cross-dataset
evaluation -- a model that generalises across both datasets is more likely to
generalise to real users.

### Licence stance
- CC BY 4.0 datasets (ChicagoFSWild+, ASL Citizen): approved for research and
  commercial use with attribution. Attribution is in ml/data/LICENSES.md.
- Research-only datasets (WLASL, MS-ASL): approved for non-commercial research.
  Raw videos are not redistributed. Landmark tensors derived from videos may be
  shared for reproducibility under the same licence terms.
- All datasets require a ml/data/LICENSES.md entry before any training run.
  CI enforces this via the licence gate in ci/check_nfr.py.

## Rejected alternatives

- **WLASL only (no MS-ASL):** Rejected because single-dataset training risks
  overfitting to WLASL's recording conditions. Cross-dataset eval is a stronger
  signal of real-world generalisation.
- **ASL-LEX:** Lexical database only, no video. Useful for curriculum curation
  (W3 sign frequency ranking) but not for training.
- **How2Sign:** Continuous signing dataset. Appropriate for W8 (continuous SLR)
  but not for isolated-sign training.
- **In-house only:** Deferred to post-launch recording sprint (S-18/S-19).
  Placeholder loader exists in ml/data/in_house.py.

## Consequences

- Training requires downloading raw videos (~50 GB for WLASL, ~30 GB for MS-ASL).
- CI rebuilds landmark cache on first run and uploads as an artifact.
- ml/data/cache/ is gitignored; CI re-extracts on clean runs.
- Accuracy targets are adjusted downward for real data (NFR-9: static >= 0.80,
  dynamic >= 0.65 on held-out signers) -- see ADR-003 for split methodology.