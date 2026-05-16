# ADR-001 — Stack Selection

**Status:** Accepted  
**Date:** 2025

## Context

The BUILD_PROMPT.md recommends Next.js 14+ (App Router) + TypeScript + Tailwind CSS. This ADR documents the decision and any deviations.

## Decision

We follow the recommended stack exactly:

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 + CSS custom properties (design tokens)
- **ML runtime:** `onnxruntime-web` 1.18.0 (WASM execution provider)
- **Landmark extraction:** MediaPipe Hands 0.4 via CDN (same version as prototype)
- **State:** React hooks + `localStorage` (no auth in v1)
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Deployment:** Vercel

## No Deviations

The recommended stack was followed without deviation. The only notable version difference is Next.js 16 (latest stable at time of build) vs. the "14+" recommendation — this is a forward-compatible upgrade with no breaking changes for this use case.

## Trade-offs

| Choice | Upside | Downside |
|---|---|---|
| App Router | RSC for static pages, client components for camera | Slightly more complex than Pages Router |
| `localStorage` for progress | No backend required, instant v1 | No cross-device sync (v2 feature) |
| CDN MediaPipe | Zero bundle size impact | Requires network on first load |
| WASM ONNX | Works in all browsers | Slower than WebGPU (stretch goal) |

## WebGPU Stretch Goal

WebGPU execution provider for `onnxruntime-web` is available as a stretch goal. To enable: pass `executionProviders: ["webgpu", "wasm"]` to `InferenceSession.create()`. The WASM fallback handles unsupported browsers. Latency improvement should be visible in the debug HUD (`?debug=1`).
