# ADR-007 -- Continuous SLR Architecture

**Status:** Accepted
**Date:** 2025
**Workstream:** W8 (Continuous SLR research preview)

## Context

Continuous (sentence-level) sign recognition is a research-grade problem.
The PDR explicitly scopes it as a research preview (EPIC-17), not a product
feature. We need an architecture that:
1. Can be trained on available continuous datasets (How2Sign, RWTH-PHOENIX)
2. Produces streaming output (rolling decoded text)
3. Has a measurable quality gate (WER <= 0.50)
4. Does not contaminate the v1 product trust budget

## Decision

**CTC Transformer encoder-decoder** over landmark sequences.

Architecture:
- Encoder: same SignTransformer backbone (d_model=128, 4 layers, 8 heads)
  operating on a sliding window of 90 frames (~3s)
- CTC head: linear projection to vocabulary + blank token
- Decoder: greedy CTC decode (no beam search in v1 -- too slow for browser)

Training dataset: How2Sign (CC BY 4.0, ~80 hours of continuous ASL)

## Why CTC over alternatives

| Approach | Pros | Cons | Decision |
|---|---|---|---|
| CTC (chosen) | Simple, streaming-friendly, no alignment needed | Lower accuracy than attention decoder | **Chosen** |
| Attention encoder-decoder | Higher accuracy | Requires full sequence, not streaming | Rejected for v1 |
| HMM-based | Interpretable, well-studied | Worse on landmark sequences than Transformers | Rejected |
| Sliding-window isolated-sign | Reuses existing model | Cannot handle co-articulation | Rejected |

CTC is chosen because it enables streaming output (each frame produces a
partial decode) and does not require an explicit alignment between frames and
glosses. The attention decoder is a natural v2 upgrade once the research
preview has validated the pipeline.

## WER gate

The model is not shipped until WER <= 0.50 on the How2Sign held-out test set.
This is a deliberately lenient gate -- continuous SLR on real data is hard and
WER 0.50 is still useful for stakeholder demos. The gate is enforced in
ci/check_nfr.py via a new continuous_eval_report.md check.

## Disclaimer requirement

The research preview route (/research/continuous) has a mandatory 5-second
disclaimer that cannot be skipped. The route is 
oindex,nofollow and excluded
from the sitemap. These are non-negotiable -- the disclaimer is load-bearing
for the product trust budget.

## Consequences

- The CTC model is ~2x larger than the isolated-sign Transformer (~700 KB ONNX).
  This is acceptable for a research preview loaded on explicit user action.
- Streaming decode runs at ~3 Hz (one decode per 10 frames). This is visible
  latency but acceptable for a research surface.
- The model is not personalised (W5 adapter does not apply to continuous SLR).