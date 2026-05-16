# ADR-004 -- Confidence Calibration Method

**Status:** Accepted
**Date:** 2025
**Workstream:** W6 (Calibration)

## Context

v1's softmax outputs are over-confident on real data (a well-known property of
neural networks trained with cross-entropy). When the model says "90% confident"
it is often wrong more than 10% of the time. This erodes trust in the
confidence-gated verdict (PDR FR-3.2) -- the core UX promise of SignTutor.

The gate is ECE (Expected Calibration Error) <= 0.05.

## Decision

**Temperature scaling** -- a single scalar T learned by minimising NLL on the
validation set logits.

`
calibrated_prob = softmax(logits / T)
`

T is baked into the ONNX export (the training script divides logits by T before
the softmax node). No runtime change is needed in the browser.

## Why temperature scaling over alternatives

| Method | Pros | Cons | Decision |
|---|---|---|---|
| Temperature scaling | 1 parameter, no overfitting, fast | Assumes uniform miscalibration | **Chosen** |
| Platt scaling | Per-class calibration | 2*n_classes parameters, can overfit | Rejected |
| Isotonic regression | Non-parametric, flexible | Requires large val set, can overfit | Rejected |
| Beta calibration | Handles asymmetric miscalibration | More complex, marginal gain | Deferred |

Temperature scaling is the right choice for our setting:
- Small validation sets (real data is limited)
- Single scalar is interpretable (T > 1 means model was over-confident)
- No risk of overfitting the calibration step
- Trivial to bake into ONNX export

## Implementation

ml/train_export.py and ml/train_transformer.py both:
1. Collect logits on the test set after training.
2. Minimise NLL over log(T) using scipy.optimize.minimize_scalar.
3. Compute ECE before and after calibration (10 bins).
4. Write a calibration report to ml/models/calibration_report*.md.
5. Store T in labels.json / dynamic_labels.json for reference.

The CI gate in ci/check_nfr.py parses the calibration report and fails if
ECE > 0.05.

## Consequences

- T is a post-hoc correction; it does not change the model's ranking of classes,
  only the magnitude of confidence scores.
- If T > 2.0, the model is severely over-confident and the training data
  distribution may be too narrow. This is a signal to add more diverse data,
  not to increase T further.
- The reliability diagram (10-bin accuracy vs. confidence plot) is published as
  a CI artifact for every training run.