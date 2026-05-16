# ADR-003 -- Signer-Disjoint Train/Val/Test Split

**Status:** Accepted
**Date:** 2025
**Workstream:** W1 (Real data)

## Context

Random frame-level splits leak signer identity across train and test, producing
inflated accuracy numbers that do not reflect performance on unseen signers.
The PDR NFR-9 target is explicitly "on held-out signers", not random frames.

## Decision

All splits are **signer-disjoint**: a given signer_id appears in exactly one
of {train, val, test}. The split is 80/10/10 by signer count (not sample count,
since some signers contribute more samples than others).

### Implementation

ml/train_export.py and ml/train_transformer.py both implement this via:
1. Collect unique signer_ids from the dataset.
2. Shuffle with a fixed seed (args.seed, default 0).
3. Assign the first 20% of signers to test, next 10% to val, rest to train.
4. Verify zero overlap: ssert len(train_signers & test_signers) == 0.
5. Log signer counts in the eval report.

CI gate in ci/check_nfr.py checks that the eval report contains the phrase
"signer-disjoint" or "signer overlap: 0" -- a training run that skips this
check will fail the gate.

### Synthetic data exception

Synthetic data (--source synth) assigns one unique signer_id per sample
("synth_0", "synth_1", ...). The disjointness check trivially passes. This is
intentional: synth is a test fixture, not a real-world generalisation test.

## Rejected alternatives

- **Random frame split:** Rejected. Inflates accuracy by ~15-25pp on real data.
  The PDR explicitly requires held-out signers.
- **Stratified by class only:** Rejected for the same reason -- does not prevent
  signer leakage.
- **Leave-one-signer-out cross-validation:** More rigorous but 10x more
  expensive to train. Deferred to post-launch evaluation sprint.

## Audit procedure

To verify a split is signer-disjoint after the fact:
`python
import numpy as np
data = np.load("ml/data/cache/wlasl/train.npz", allow_pickle=True)
train_signers = set(data["signer_ids"])
data = np.load("ml/data/cache/wlasl/test.npz", allow_pickle=True)
test_signers = set(data["signer_ids"])
assert len(train_signers & test_signers) == 0, "LEAK DETECTED"
`

This check is also run automatically in ci/check_nfr.py.

## Consequences

- Effective test set size is smaller than a random split (fewer samples from
  held-out signers). This is correct -- it reflects real deployment conditions.
- Accuracy numbers will be lower than random-split baselines in the literature.
  This is expected and honest.
- The signer_id field must be present in every dataset loader. Loaders that
  cannot provide signer_ids (e.g., datasets without metadata) must assign a
  unique ID per video to prevent accidental leakage.