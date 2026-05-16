# ADR-006 -- NMM Landmark Fusion Strategy

**Status:** Accepted
**Date:** 2025
**Workstream:** W4 (Non-manual marker scoring)

## Context

Non-manual markers (NMM) -- brow raise/furrow, mouth shape, head tilt -- carry
grammatical meaning in ASL (questions, negation, intensity). Scoring them
requires face landmarks in addition to hand landmarks.

## Decision

**MediaPipe Holistic** replaces MediaPipe Hands in the dynamic player when the
NMM feature flag is on. Holistic provides:
- 21 hand landmarks (same as before)
- 468 face landmarks
- 33 pose landmarks

**Fusion strategy: separate auxiliary heads** over pooled face landmarks.

Two small MLP heads trained on top of the frozen Transformer encoder:
- 
mm_brow: brow raise / furrow / neutral (3 classes)
- 
mm_mouth: mouthing / negation-purse / open / closed (4 classes)

Each head takes the mean of the 10 most informative face landmarks (brow region
for nmm_brow, lip region for nmm_mouth) as input -- not the full 468.

## Why separate heads over joint training

| Approach | Pros | Cons | Decision |
|---|---|---|---|
| Separate auxiliary heads (chosen) | Independent, can be added post-hoc, no sign-classifier regression | Two inference passes | **Chosen** |
| Joint multi-task training | Single pass | Requires re-training backbone, risks sign-classifier regression | Rejected |
| Full holistic feature concat | Richest signal | 468+33+21=522 landmarks, 4x larger model | Rejected |
| Face-only MLP (no backbone) | Simplest | Misses sign-NMM correlation | Rejected |

## Feature normalization

The same first-frame-anchor normalization (ADR architectural decision #4) is
applied to face landmarks. Face landmark positions are normalized relative to
the nose tip (landmark 1) rather than the wrist, using the inter-eye distance
as the scale reference.

A new JS function 
ormalizeFaceLandmarks() in lib/normalizeNMM.ts mirrors
the Python training pipeline. It is covered by the parity test extension.

## Latency budget

NMM adds <= 50 ms p50 to the inference pipeline (gate from BUILD_PROMPT).
MediaPipe Holistic is ~20 ms slower than Hands on a 2020-class laptop.
The two auxiliary MLP heads add < 1 ms each.

## Consent

The NMM feature requires explicit user consent (modal in Settings) before
activation. The consent modal cannot be dismissed via keyboard alone -- it
requires clicking "Enable NMM scoring". This is enforced in SettingsPanel.tsx.

## Consequences

- NMM is default-off. Turning it on switches the landmark extractor from Hands
  to Holistic, which is slightly slower.
- The NMM eval report (ml/models/nmm_eval_report.md) has its own NFR-9-style
  targets: brow >= 0.70, mouthing >= 0.65.
- NFR-10 adds glasses-on/off and mask-on/off slices for NMM.