# ADR-008 -- Per-Language Model Bundle Layout and Lazy Loading

**Status:** Accepted
**Date:** 2025
**Workstream:** W7 (Multi-language)

## Context

v1 ships ASL only. v2 adds a second language (BSL or ArSL) as a beta tier.
Each language has its own ONNX model bundle. We need a layout that:
1. Does not increase the initial page load (models are large)
2. Allows the wizard language selector to switch languages cleanly
3. Keeps CI gates independent per language

## Decision

**Per-language subdirectory under /public/models/** with lazy loading on
language switch.

Directory layout:
`
public/models/
  asl/
    fingerspell_mlp.onnx        (72 KB)
    labels.json
    dynamic_signs_transformer.onnx  (360 KB)
    dynamic_labels.json
    parity_samples.json
  bsl/                          (or arsl/)
    fingerspell_mlp.onnx
    labels.json
    dynamic_signs_transformer.onnx
    dynamic_labels.json
`

The model path is derived from the user's language preference:
`	ypescript
const modelBase = "/models/" + prefs.language + "/";
`

## Lazy loading strategy

Models are loaded on demand when the user first enters a lesson for that
language. The InferenceSession.create() call is deferred until the lesson
player mounts. A loading spinner is shown while the model downloads.

On language switch in the wizard:
1. The new language preference is saved to localStorage.
2. The next lesson page load triggers a fresh InferenceSession.create() for
   the new language's model path.
3. The old session is garbage-collected (no explicit cleanup needed).

**No prefetch on language switch** in v1 -- the model is only ~400 KB total
and the user has already committed to the new language by completing the wizard.
Prefetch can be added in v2 if latency is a complaint.

## CI gate independence

Each language runs in a separate CI matrix job:
`yaml
strategy:
  matrix:
    language: [asl, bsl]
  fail-fast: false
`

A failing BSL gate does not block ASL. The ASL gate is the release blocker;
other languages are informational until they reach GA.

## Language selector UI

The wizard language selector shows:
- ASL: "Fully shipped" (no badge)
- BSL/ArSL: "Beta" badge
- Other: "Coming soon" (disabled)

The beta badge is driven by the AVAILABLE_LANGUAGES constant in
lib/curriculum.ts, not hardcoded in the UI.

## Rejected alternatives

- **Single model file with language embedding:** Rejected. Would require
  retraining all languages together; a BSL regression would block ASL.
- **CDN-hosted models:** Rejected. The CSP on lesson pages restricts
  connect-src to self. Models must be served from the same origin.
- **Dynamic import of model files:** Not applicable -- ONNX files are binary
  assets, not JS modules.

## Consequences

- Adding a new language requires: (1) training a new model, (2) adding it to
  public/models/{lang}/, (3) adding a CI matrix job, (4) updating
  AVAILABLE_LANGUAGES in curriculum.ts.
- The v1 model paths (/models/fingerspell_mlp.onnx) are migrated to
  /models/asl/fingerspell_mlp.onnx. A redirect or symlink handles any
  cached references.