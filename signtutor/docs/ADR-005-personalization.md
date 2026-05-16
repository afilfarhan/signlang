# ADR-005 -- Personalization Adapter Shape and Format

**Status:** Accepted
**Date:** 2025
**Workstream:** W5 (On-device personalization)

## Context

We want each user's model to adapt to their hand size, lighting, and signing
style without uploading any data. The backbone ONNX model is frozen; we add a
small per-user adapter layer trained in-browser.

## Decision

**Low-rank linear adapter** over the Transformer encoder embedding.

Architecture:
`
embedding (d_model=64) -> W_down (64 x rank=8) -> ReLU -> W_up (8 x n_classes) + bias -> logits_delta
final_logits = backbone_logits + logits_delta
`

State size: 64*8 + 8*n_classes + n_classes floats.
For n_classes=200: 512 + 1600 + 200 = 2,312 floats = ~9 KB. Well within budget.

Training: SGD on (embedding, label) pairs from confirmed attempts.
Learning rate: 0.01. No momentum (keeps state minimal).

## Why low-rank adapter over alternatives

| Approach | State size | Latency | Privacy | Decision |
|---|---|---|---|---|
| Low-rank adapter (chosen) | ~9 KB | <10 us | All local | **Chosen** |
| Full fine-tune last layer | n_classes * d_model = 12 KB | <10 us | All local | Rejected (larger, no rank compression) |
| LoRA on all layers | ~100 KB | ~1 ms | All local | Rejected (too large for localStorage) |
| Server-side fine-tune | Minimal client | N/A | Uploads data | Rejected (violates privacy invariant) |
| k-NN over embeddings | O(N) per query | O(N) | All local | Rejected (grows unboundedly) |

## Embedding output

	rain_transformer.py exports two ONNX variants:
1. dynamic_signs_transformer.onnx -- standard, logits only (browser default)
2. dynamic_signs_transformer_with_embedding.onnx -- logits + embedding (for W5)

The embedding variant is loaded only when the personalization feature flag is on.

## Consent and transparency

- Personalization is opt-in via the feature flag (default ON because nothing
  leaves the device -- see BUILD_PROMPT_ML_EXTENSION.md note).
- A "Personalized" badge appears after >= 20 confirmed attempts.
- The badge links to Settings#data showing attempt count and last-updated date.
- "Reset personalization" deletes the adapter from localStorage irreversibly.

## Privacy gate

A Vitest test (signtutor/tests/personalAdapter.test.ts) intercepts fetch/XHR
during a simulated practice session and asserts that no request body contains
Float32Array data (embeddings or adapter weights). This test must pass in CI.

## Consequences

- The adapter is only as good as the confirmed attempts. Users who never confirm
  ("Was this you signing X?") get no benefit.
- The adapter does not generalise across devices (no sync in v1).
- If the backbone model is retrained and d_model or n_classes changes, the
  stored adapter is incompatible and is silently reset.