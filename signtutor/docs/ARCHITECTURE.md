# Architecture -- SignTutor v2

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | SSR for static pages, client components for camera/inference |
| Styling | Tailwind CSS + CSS custom properties | Utility classes + design tokens |
| ML runtime | onnxruntime-web 1.18.0 (WASM) | Same version as prototype; WebGPU opt-in behind feature flag |
| Landmark extraction | MediaPipe Hands 0.4 (CDN); Holistic when NMM flag on | WASM execution |
| State | React hooks + localStorage | No auth in v1/v2; progress persisted locally |
| Testing | Vitest (unit) + Playwright (E2E) | Standard for Next.js ecosystem |
| Deployment | Vercel (static + edge) | Zero-config Next.js deployment |

## Routes

| Route | Component | Notes |
|---|---|---|
| / | app/page.tsx | Marketing landing |
| /setup | components/SetupWizard.tsx | 4-step wizard |
| /learn/asl/fingerspelling | app/learn/asl/fingerspelling/page.tsx | All 26 letters (J/Z redirect to dynamic) |
| /learn/asl/fingerspelling/[letter] | components/StaticSignPlayer.tsx | ONNX MLP; J/Z redirect to /words/[slug] |
| /learn/asl/words | app/learn/asl/words/page.tsx | 200-sign vocabulary with categories |
| /learn/asl/words/[slug] | components/DynamicSignPlayer.tsx | Transformer player |
| /practice | components/PracticeQueue.tsx | FSRS review queue |
| /settings | components/SettingsPanel.tsx | Feature flags + personalization data |
| /research/continuous | components/ContinuousResearchPlayer.tsx | W8: CTC research preview, noindex |
| /about | app/about/page.tsx | Static |
| /privacy | app/privacy/page.tsx | On-device guarantee |

## Eight v1 Architectural Decisions (all preserved)

### 1. Hybrid ML + Rule Classifier
Both classifiers always run in the static-sign player. The ONNX MLP provides calibrated top-5 probabilities. The rule layer (fingerStates() + PATTERNS in lib/fingerStates.ts) provides per-finger interpretability and drives the actionable tip.

### 2. Auto-Fallback to Rule Mode
If onnxruntime-web fails to load, StaticSignPlayer catches the error, sets fallbackActive = true, and switches to rule mode. A warning badge is shown. The page remains fully functional.

### 3. Collision-Aware Verdict
COLLISION_GROUPS in lib/curriculum.ts mirrors SYNTH_COLLISIONS in ml/synth_landmarks.py. When the model predicts a collision-group neighbour, the verdict is "close" not "miss". On real data these groups collapse; the logic stays as a no-op.

### 4. Dynamic-Sign Feature Pipeline Anchors on First Frame
normalizeSequence() in lib/seqNormalize.ts mirrors ml/seq_features.py exactly. The entire sequence is translated by the first-frame wrist position to preserve global trajectory.

### 5. --rotation-aug at Training Time
The dynamic Transformer fails the NFR-10 rotation gate without rotation augmentation. The CI workflow passes --rotation-aug to train_transformer.py.

### 6. Lesson-Time Lighting Check On-Device
SetupWizard.tsx samples downscaled video frames (64x48), computes mean luminance and std-dev. No frames are uploaded.

### 7. Latency HUD Behind ?debug=1
Both lesson players expose a latency HUD when ?debug=1 is in the query string.

### 8. JS <-> Python Feature Contract
lib/normalize.ts mirrors ml/features.py. lib/seqNormalize.ts mirrors ml/seq_features.py. The parity test in tests/parity.test.ts verifies to 1e-3 tolerance.

## v2 Additions

### W1 -- Real Data Pipeline
ml/data/ contains loaders for WLASL, MS-ASL, ChicagoFSWild+, ASL Citizen, and in-house recordings. All loaders emit identical shapes to the synth. Signer-disjoint splits enforced in training scripts. See ADR-002, ADR-003.

### W2 -- J and Z Motion Letters
J and Z are added to the dynamic curriculum. /learn/asl/fingerspelling/J and /Z redirect to the dynamic player. The fingerspelling listing shows all 26 letters with a "Motion" badge on J and Z.

### W3 -- 200-Sign Vocabulary
Dynamic vocabulary expanded from 8 to 200 signs. Transformer scaled to d_model=128, 4 layers, 8 heads (~1.4 MB ONNX). Signs organised by semantic category in the lesson browser. Per-class confusion analysis flags pairs with >10% off-diagonal mass.

### W4 -- NMM Scoring (feature flag: nmm)
Non-manual marker scoring behind a feature flag. MediaPipe Holistic replaces Hands when enabled. Two auxiliary MLP heads (nmm_brow, nmm_mouth) over pooled face landmarks. Requires explicit consent modal. See ADR-006.

### W5 -- On-Device Personalization (feature flag: personalization)
PersonalAdapter (lib/personalAdapter.ts): low-rank linear adapter (rank=8) over the Transformer encoder embedding. Trained in-browser via SGD on confirmed attempts. State in localStorage. Nothing leaves the device. See ADR-005.

### W6 -- Confidence Calibration
Temperature scaling (single scalar T) fitted on validation logits after each training run. T baked into ONNX export. ECE gate: <= 0.05. Reliability diagram published as CI artifact. See ADR-004.

### W7 -- Multi-Language (feature flag: bsl)
Per-language model bundles under /public/models/{lang}/. Lazy-loaded on language switch. CI matrix jobs run per-language independently. See ADR-008.

### W8 -- Continuous SLR Research Preview (feature flag: continuous)
Route /research/continuous with mandatory 5-second disclaimer. noindex,nofollow. CTC Transformer over landmark sequences. WER gate: <= 0.50. See ADR-007.

## v2 ML Pipeline

`
Real data (WLASL / ChicagoFSWild+ / ASL Citizen)
  -> ml/data/{loader}.py
  -> MediaPipe offline landmark extraction
  -> ml/data/cache/{dataset}/{split}.npz  (gitignored)
  -> Signer-disjoint split (ADR-003)
  -> ml/train_export.py --source chicagofs    (static MLP)
  -> ml/train_transformer.py --source wlasl --rotation-aug  (dynamic Transformer)
  -> Temperature scaling calibration (ADR-004)
  -> ONNX export -> public/models/asl/
  -> ci/check_nfr.py  (NFR-9, NFR-10, ECE, Macro-F1, licence, signer-disjoint)
`

## CI Gates (v2 -- all gates)

| Gate | File | Threshold |
|---|---|---|
| NFR-9 static accuracy | ml/models/eval_report.md | >= 0.80 (real data) |
| NFR-9 dynamic accuracy | ml/models/dynamic_eval_report.md | >= 0.65 (real data) |
| NFR-10 robustness slices | ml/models/dynamic_robustness_report.md | +-5pp from clean |
| ECE calibration | ml/models/calibration_report*.md | <= 0.05 |
| Macro-F1 dynamic | ml/models/dynamic_eval_report.md | >= 0.55 |
| Licence provenance | ml/data/LICENSES.md | Every dataset_id documented |
| Signer disjointness | eval reports | "signer-disjoint" confirmed |
| JS<->Python parity | ci/parity.log | 5/5 within 1e-3 |
| PersonalAdapter improvement | lib/__tests__/personalAdapter.test.ts | >= 5pp on held-out |
| Privacy egress | lib/__tests__/personalAdapter.test.ts | No fetch/XHR during update() |

## ADR Index

| ADR | Topic |
|---|---|
| ADR-001 | Stack selection (Next.js 16, TypeScript, Tailwind) |
| ADR-002 | Dataset choice and licence stance (WLASL, ChicagoFSWild+, ASL Citizen) |
| ADR-003 | Signer-disjoint train/val/test split methodology |
| ADR-004 | Confidence calibration: temperature scaling |
| ADR-005 | Personalization adapter shape and format (low-rank, localStorage) |
| ADR-006 | NMM landmark fusion strategy (MediaPipe Holistic, auxiliary heads) |
| ADR-007 | Continuous SLR architecture (CTC Transformer) |
| ADR-008 | Per-language model bundle layout and lazy loading |

## Privacy Architecture

- No webcam frames, landmarks, embeddings, or adapter weights leave the browser
- Content-Security-Policy on /learn/* restricts connect-src to self only
- Progress, preferences, and adapter state in localStorage
- NMM feature requires explicit consent modal before activation
- Personalization reset is one-click and irreversible
- /research/continuous is noindex,nofollow and excluded from sitemap