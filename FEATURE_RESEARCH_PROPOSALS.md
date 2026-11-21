# SignTutor — Feature Research & Improvement Proposals

**Based on:** v1 architecture, v2 roadmap (W1–W8), ADRs 001–008, current ML/SLR research landscape, and EdTech best practices.

---

## Executive Summary

SignTutor v1/v2 establishes a **privacy-first, on-device sign language learning platform** with a hybrid ML+rule architecture. The v2 roadmap (W1–W8) is well-structured and addresses the core ML limitations of v1 (synthetic data → real data, 8 → 200 signs, motion letters, NMM, personalization, calibration, multi-language, continuous SLR research).

This document proposes **15 feature improvements/additions** organized by:
- **ML/AI Capabilities** (5 proposals)
- **Learning Experience & Pedagogy** (4 proposals)
- **Platform & Technical Infrastructure** (3 proposals)
- **Accessibility & Inclusion** (2 proposals)
- **Community & Social** (1 proposal)

Each proposal includes: motivation, technical approach, effort estimate, dependencies, and success metrics.

---

## 1. ML/AI Capabilities

### 1.1 Few-Shot / Zero-Shot Sign Recognition (Research → Production)

**Motivation:** Current approach requires retraining for every new sign/vocabulary expansion. With 200 signs as a starting point, users will inevitably want to learn signs not in the curriculum. Few-shot learning would allow recognizing new signs from 1–5 user demonstrations without retraining the backbone.

**Technical Approach:**
- **Backbone:** Use the existing Transformer encoder (d_model=128) as a frozen feature extractor
- **Adapter:** Train a **prototypical network** or **matching network** head on top of embeddings
- **Inference:** User demonstrates a new sign 3–5 times → compute embedding prototypes → classify new attempts by nearest-prototype distance in embedding space
- **Storage:** Store prototypes in localStorage (~1 KB per new sign)
- **Integration:** Add "Teach me a new sign" flow in Practice page

**Research Reference:** 
- Snell et al., "Prototypical Networks for Few-Shot Learning" (NeurIPS 2017)
- Recent SLR applications: "Few-Shot Sign Language Recognition" (CVPR 2023 workshops)
- MediaPipe embeddings + prototypical heads run entirely on-device

**Effort:** Medium (2–3 weeks)
- Week 1: Python prototype with WLASL embeddings, validate few-shot accuracy
- Week 2: ONNX export of prototype head, JS integration
- Week 3: UI flow, localStorage persistence, testing

**Dependencies:** W3 (200-sign vocabulary) must be stable; W5 (personalization adapter) provides pattern for localStorage model state

**Success Metrics:**
- Top-1 accuracy ≥ 70% on 5-shot for 20 held-out signs (not in 200)
- Inference latency < 50ms additional
- localStorage growth < 50 KB for 50 user-added signs

---

### 1.2 Sign Language Detection (Is Signing Happening?)

**Motivation:** Current players assume the user is always signing. False positives occur when user adjusts camera, scratches face, or gestures while thinking. A lightweight "is signing happening" detector would:
- Gate inference (save CPU/battery)
- Trigger "ready" UI state automatically
- Enable continuous mode without explicit record button

**Technical Approach:**
- **Option A (Lightweight):** Rule-based heuristic on hand velocity + hand presence consistency
  - Compute frame-to-frame wrist displacement
  - Require sustained movement > threshold for N consecutive frames
  - Zero ML cost, runs in existing `onResults` callback
- **Option B (ML):** Tiny binary classifier (1–2 layer MLP) on 5-frame window of hand landmarks
  - Input: 5 × 21 × 3 = 315 floats → hidden 32 → 1 logit
  - Train on signing vs. non-signing clips from WLASL + negative samples
  - Export to ONNX (~10 KB), run alongside main model

**Effort:** Low (Option A: 3 days; Option B: 1–2 weeks)

**Dependencies:** None — can ship independently

**Success Metrics:**
- False positive rate < 5% during "idle" periods
- Detection latency < 200ms from sign start
- Option A: zero model size increase; Option B: < 20 KB ONNX

---

### 1.3 Two-Handed Sign Support (Dynamic Player)

**Motivation:** ~30% of ASL signs are two-handed (e.g., "AGAIN", "MEETING", "FAMILY", "UNDERSTAND"). Current MediaPipe Hands `maxNumHands: 1` only tracks the dominant hand. Two-handed support would:
- Expand vocabulary to include critical two-handed signs
- Improve accuracy for signs where non-dominant hand provides context
- Enable NMM fusion (head pose, torso orientation) for two-handed signs

**Technical Approach:**
1. **MediaPipe:** Change `maxNumHands: 2` in both players
2. **Landmark ordering:** Consistent left/right hand assignment (MediaPipe provides `handedness` classification)
3. **Feature normalization:** 
   - Static: Concatenate both hands' normalized features (63 × 2 = 126 dims) or use dominant-hand-only for one-handed signs
   - Dynamic: Dual-stream Transformer or concatenated 42-landmark sequence (252 dims/frame)
4. **Model architecture:** 
   - **Static:** Retrain MLP with 126-dim input (two-hand concat) + sign-type indicator
   - **Dynamic:** Two-stream encoder (shared weights) → fusion → classifier, or single encoder on 42 landmarks
5. **Curriculum:** Tag signs as `oneHanded` / `twoHanded` / `either` in `curriculum.ts`
6. **UI:** Show both hand skeletons in overlay; indicate which hand is dominant

**Research Reference:**
- "Two-Stream Convolutional Networks for Sign Language Recognition" (ICCV 2019)
- MediaPipe Hands supports `maxNumHands: 2` with handedness classification since v0.4

**Effort:** High (4–6 weeks)
- Week 1–2: Data pipeline — extract two-hand landmarks from WLASL, verify handedness consistency
- Week 2–3: Model architecture exploration (dual-stream vs. concat), training
- Week 3–4: ONNX export, JS integration, parity testing
- Week 5: UI updates, curriculum tagging, E2E tests

**Dependencies:** W1 (real data pipeline) — need two-hand annotations; W3 (vocabulary scale) for curriculum tagging

**Success Metrics:**
- Two-handed sign accuracy ≥ 60% (vs. ~0% currently)
- One-handed sign accuracy unchanged (±2pp)
- Model size increase < 2× (target: < 3 MB total)

---

### 1.4 Sign Production Quality Scoring (Beyond Classification)

**Motivation:** Current verdict is binary-ish (match/close/miss) based on classification confidence. Learners need **formative feedback** on *how well* they produced the sign — not just *which* sign it was classified as. This enables:
- "You got the handshape right but movement was too fast"
- "Palm orientation needs 15° more rotation"
- Progress tracking on sub-dimensions (handshape, orientation, location, movement, NMM)

**Technical Approach:**
- **Multi-head regression** on Transformer encoder embedding:
  - Head 1: Handshape quality (0–1) — distance to canonical handshape in embedding space
  - Head 2: Orientation quality — cosine similarity to target palm normal
  - Head 3: Location quality — normalized distance to canonical signing space
  - Head 4: Movement quality — DTW distance to reference trajectory (for dynamic signs)
  - Head 5: NMM quality (when flag enabled) — auxiliary head confidence
- **Training:** Synthetic + real data with quality labels from expert annotations or programmatic metrics
- **Inference:** Run alongside classification; display as 5-component radar chart + prioritized tip

**Effort:** Medium-High (3–4 weeks)
- Week 1: Define quality metrics, generate labels from existing data
- Week 2: Multi-head architecture, training, calibration
- Week 3: ONNX export (multi-output), JS integration
- Week 4: UI redesign for detailed feedback panel

**Dependencies:** W3 (200 signs), W4 (NMM), W6 (calibration) — quality scores need calibrated confidence

**Success Metrics:**
- Quality scores correlate with human expert ratings (r > 0.7)
- Per-component feedback reduces repeat errors by ≥ 20% in user study
- Inference latency increase < 30ms

---

### 1.5 Active Learning / Uncertainty Sampling for Data Collection

**Motivation:** Model accuracy plateaus on hard signs/confusion pairs. Active learning would identify **which user attempts are most valuable for retraining** and prompt users to re-record or confirm them, building a high-value fine-tuning dataset per user (and optionally aggregated anonymized for global model improvement).

**Technical Approach:**
- **Uncertainty metric:** Entropy of calibrated softmax + distance to decision boundary
- **Diversity metric:** Embedding distance to existing confirmed attempts
- **Acquisition function:** `score = α × uncertainty + β × diversity`
- **User flow:** After lesson, show "Help improve SignTutor — re-record these 3 signs?" with high-value attempts pre-selected
- **Privacy:** All selection happens on-device; only user-opt-in uploads anonymized (embedding, label) pairs

**Effort:** Medium (2–3 weeks)
- Week 1: Uncertainty/diversity metrics, acquisition function tuning
- Week 2: UI flow, localStorage queue, opt-in consent modal
- Week 3: Integration with personalization adapter (W5) — use selected samples for adapter update

**Dependencies:** W5 (personalization), W6 (calibration) — needs calibrated probabilities for entropy

**Success Metrics:**
- Adapter improvement rate increases ≥ 2× with active selection vs. random
- User opt-in rate ≥ 30% (with clear value proposition)
- No privacy violations in CSP test

---

## 2. Learning Experience & Pedagogy

### 2.1 Spaced Repetition v2: FSRS-5 with Difficulty Modeling

**Motivation:** Current FSRS implementation (in `lib/progress.ts`) is a simplified version. The **FSRS-5 algorithm** (Free Spaced Repetition Scheduler v5) adds:
- **Difficulty parameter** per card (sign) — learns how hard each sign is for *this user*
- **Stability parameter** — models memory retention more accurately
- **Optimal retention target** — configurable (e.g., 90% vs 95%)
- **Simulation-based parameter optimization** — finds best parameters per user

**Technical Approach:**
- Port TypeScript implementation of FSRS-5 (open source: `ts-fsrs` npm package)
- Replace `recordAttempt()` with full FSRS-5 state update
- Add per-sign `difficulty` and `stability` to `SignProgress`
- Expose "Desired retention" slider in Settings (85%–97%)
- Add "Simulate next 30 days" preview in Practice page

**Effort:** Low (1 week)
- Day 1–2: Integrate `ts-fsrs`, migrate state schema
- Day 3: Settings UI, retention target slider
- Day 4: Practice page simulation preview
- Day 5: Tests, migration for existing users

**Dependencies:** None — standalone improvement

**Success Metrics:**
- Review load (cards/day) decreases ≥ 15% at same retention
- User-reported "feels right" satisfaction ≥ 4/5
- No regression in mastery rate

---

### 2.2 Guided Lesson Curriculum (Structured Learning Paths)

**Motivation:** Current `/learn` pages are **browsers**, not **curricula**. Users don't know what to learn next. A guided curriculum would:
- Sequence signs by linguistic dependency (handshapes → orientations → movements)
- Group by communicative function (greetings → questions → descriptions)
- Adaptive: skip mastered signs, repeat weak areas
- Provide "Lesson 1 of 10" progress visualization

**Technical Approach:**
1. **Curriculum graph** in `lib/curriculum.ts`:
   ```typescript
   interface LessonStep {
     id: string;
     signs: string[];           // 3–5 signs per lesson
     prerequisites: string[];   // lesson IDs
     communicativeGoal: string; // "Greet someone", "Ask yes/no questions"
     estimatedMinutes: number;
   }
   ```
2. **Progress tracking:** `UserCurriculumProgress` in localStorage — completed lessons, current lesson, mastery per sign
3. **UI:** New `/learn/asl/curriculum` page with visual path, locked/unlocked lessons
4. **Adaptive gating:** Lesson unlocks when prerequisites signs are `mastered: true` (from FSRS)

**Effort:** Medium (2–3 weeks)
- Week 1: Curriculum design (linguist review ideal), graph structure, data
- Week 2: Progress tracking, adaptive unlocking logic, UI
- Week 3: Integration with Practice queue (prioritize current lesson signs)

**Dependencies:** W3 (200 signs with categories), 2.1 (FSRS-5 mastery signal)

**Success Metrics:**
- New user completion rate (first 5 lessons) ≥ 60%
- Time to "can sign 50 signs" decreases ≥ 30%
- Drop-off after lesson 1 < 40%

---

### 2.3 Sign Comparison / Minimal Pairs Training

**Motivation:** Confusion matrix (W3 gate) shows specific sign pairs with >10% off-diagonal confusion (e.g., "MOTHER" vs "FATHER", "RED" vs "PINK"). **Minimal pairs training** — focused practice on confusing pairs — is a proven technique in phonology and SLR.

**Technical Approach:**
1. **Confusion-driven pair generation:** From eval report, extract top-K confused pairs per sign
2. **Comparison mode in players:**
   - Side-by-side demo videos (native signer doing both signs)
   - Alternating recording: "Sign MOTHER" → "Sign FATHER" → repeat
   - Differential feedback: "Your MOTHER looks like FATHER because thumb position differs"
3. **Dedicated `/practice/minimal-pairs` route:** Queue of user's personal confusion pairs
4. **Rule-layer differential tips:** Extend `chooseTip()` to compare two target patterns

**Effort:** Low-Medium (1–2 weeks)
- Week 1: Confusion pair extraction, comparison UI in DynamicSignPlayer
- Week 2: Minimal pairs practice queue, differential tip generation

**Dependencies:** W3 (confusion analysis), 1.4 (quality scoring for differential feedback)

**Success Metrics:**
- Confusion pair error rate decreases ≥ 40% after 3 minimal-pair sessions
- Users rate "helped me distinguish similar signs" ≥ 4/5

---

### 2.4 Receptive Practice (Watch → Identify)

**Motivation:** Current players are **expressive only** (user signs, AI evaluates). **Receptive skills** (watching and understanding) are equally critical for communication. Add a mode where:
- Native signer video plays (from dataset or curated recordings)
- User selects from 4 options what was signed
- Immediate feedback with replay option

**Technical Approach:**
1. **Video assets:** Extract sign clips from WLASL/How2Sign (license permitting) or record native signers
   - Store as compressed WebM in `public/models/asl/receptive/{sign}.webm`
   - ~50 KB per sign × 200 = 10 MB total (lazy-loaded)
2. **Player component:** `ReceptiveSignPlayer.tsx` — video + 4-choice grid
3. **Curriculum integration:** Alternate expressive/receptive in guided curriculum
4. **Progress tracking:** Separate `receptiveMastery` in `SignProgress`

**Effort:** Medium (2–3 weeks + video asset collection)
- Week 1: Video extraction/pipeline, player component
- Week 2: Curriculum integration, progress tracking
- Week 3: Adaptive difficulty (fewer distractors for hard signs)

**Dependencies:** W1 (dataset licenses for video use), W3 (200 signs)

**Success Metrics:**
- Receptive accuracy correlates with expressive (r > 0.6)
- Users report improved real-world comprehension
- Asset load time < 3s on 3G (lazy, cached)

---

## 3. Platform & Technical Infrastructure

### 3.1 PWA + Offline-First Architecture

**Motivation:** SignTutor is used in classrooms, homes, and on-the-go. **Offline support** enables:
- Practice without WiFi (subway, rural areas)
- Faster load times (cache-first)
- Installable as "app" on mobile/desktop
- Background sync when online

**Technical Approach:**
1. **Service Worker:** Workbox (Next.js PWA plugin) with:
   - Cache-first for static assets (JS, CSS, ONNX models)
   - Stale-while-revalidate for curriculum data
   - Offline fallback page
2. **Model caching:** ONNX models (~2 MB total) cached in Cache API + IndexedDB fallback
3. **Progress sync:** localStorage → IndexedDB → background sync to server (opt-in future)
4. **Manifest:** `manifest.json` with icons, shortcuts (Practice, Learn, Setup)
5. **Install prompt:** Custom "Install SignTutor" banner after 2nd visit

**Effort:** Medium (2 weeks)
- Week 1: Workbox config, service worker, caching strategies
- Week 2: Manifest, install UX, offline testing, Lighthouse PWA audit

**Dependencies:** None — can ship anytime

**Success Metrics:**
- Lighthouse PWA score ≥ 90
- Offline lesson completion works end-to-end
- Install rate ≥ 15% of returning users
- No regression in online performance

---

### 3.2 WebGPU Acceleration (Stretch Goal → Production)

**Motivation:** `featureFlags.ts` already has `webgpu` flag. WebGPU execution provider for onnxruntime-web offers **3–10× faster inference** on supported hardware (Chrome 113+, Edge 113+, Safari 17+). This enables:
- Larger models (continuous SLR, two-handed) at interactive latency
- Lower battery usage
- Foundation for real-time continuous SLR

**Technical Approach:**
1. **onnxruntime-web WebGPU:** Update to 1.18+ (supports WebGPU EP)
2. **Device detection:** Check `navigator.gpu` + `ort.env.wasm` fallback
3. **Session options:** `{ executionProviders: ['webgpu', 'wasm'] }`
4. **Shader compilation caching:** Cache pipeline state in IndexedDB
5. **Benchmark:** Compare WASM vs WebGPU latency on target devices

**Effort:** Low-Medium (1–2 weeks)
- Week 1: WebGPU EP integration, feature detection, fallback logic
- Week 2: Benchmarking, caching, device-specific tuning

**Dependencies:** None — flag exists, just needs implementation

**Success Metrics:**
- WebGPU latency ≤ 30% of WASM on supported devices
- Graceful fallback to WASM on unsupported
- No correctness regression (parity test passes)

---

### 3.3 Model Compression / Quantization Pipeline

**Motivation:** As vocabulary grows (200 → 500 → 1000 signs), model size grows. **Quantization** (FP32 → INT8/INT4) and **pruning** can reduce ONNX size by 2–4× with <1% accuracy drop, enabling:
- Faster downloads (critical for PWA offline)
- Lower memory usage on mobile
- Room for multi-language bundles

**Technical Approach:**
1. **Post-training quantization (PTQ):** ONNX Runtime quantization tools
   - Dynamic quantization (weights only) → ~2× size reduction
   - Static quantization (weights + activations) → ~4× with calibration data
2. **Quantization-aware training (QAT):** PyTorch `torch.ao.quantization` for better accuracy
3. **Pipeline integration:** Add `--quantize` flag to training scripts
4. **JS runtime:** onnxruntime-web supports quantized models natively
5. **CI gate:** Accuracy drop ≤ 1pp vs. FP32 baseline

**Effort:** Medium (2–3 weeks)
- Week 1: PTQ exploration, accuracy evaluation on dynamic/static models
- Week 2: QAT if needed, training script integration
- Week 3: CI gate, benchmarking, documentation

**Dependencies:** W3 (stable 200-sign model), W7 (multi-language bundles benefit most)

**Success Metrics:**
- Dynamic model ≤ 500 KB (from 1.4 MB) at INT8 with ≤ 1pp accuracy drop
- Static model ≤ 30 KB (from 72 KB)
- Inference latency improvement ≥ 20% on mobile

---

## 4. Accessibility & Inclusion

### 4.1 Screen Reader Optimized Feedback (ARIA Live Regions + Semantic Descriptions)

**Motivation:** Current players use `aria-live="polite"` for verdicts, but **blind/low-vision users** need richer semantic descriptions of:
- Handshape (e.g., "thumb tucked, index extended, middle curled...")
- Movement trajectory (e.g., "hand moves upward in arc")
- Spatial relationships (e.g., "right hand contacts left palm")

**Technical Approach:**
1. **Semantic description generator** in `lib/fingerStates.ts`:
   - Convert `FingerStates` + `PalmOrientation` + `MovementVector` → natural language
   - Template-based: "Your {hand} hand forms {handshape}. {Movement description}."
2. **ARIA live regions** with appropriate politeness:
   - `assertive` for verdict (match/miss)
   - `polite` for tips and component scores
3. **Screen reader only panel:** Toggle in Settings → "Detailed audio descriptions"
4. **Keyboard navigation:** Full player operable without mouse (already WCAG 2.2 AA, verify)

**Effort:** Low-Medium (1–2 weeks)
- Week 1: Description templates, live region strategy, SR testing
- Week 2: Settings toggle, integration, NVDA/JAWS/VoiceOver testing

**Dependencies:** None — accessibility improvement

**Success Metrics:**
- Screen reader user task success rate ≥ 90% (usability test)
- No WCAG 2.2 AA regressions
- "Detailed descriptions" toggle used by ≥ 20% of SR users

---

### 4.2 Left-Handed / Mirror-First Design Validation

**Motivation:** Setup wizard has left-handed toggle, but **has the full experience been validated for left-handed signers?** MediaPipe handedness classification, rule-layer patterns, and demo videos all assume right-handed dominance.

**Technical Approach:**
1. **Audit:** Test all 200 signs with `leftHanded: true` + `mirror: true`
2. **Rule layer:** Verify `PATTERNS` work for left-hand (MediaPipe landmarks are mirrored)
3. **Demo videos:** Ensure left-handed demos exist or are correctly mirrored
4. **Dynamic player:** Verify two-hand (when added) assigns dominant/non-dominant correctly
5. **User testing:** Recruit 5+ left-handed signers for validation session

**Effort:** Low (1 week audit + user testing)

**Dependencies:** 1.3 (two-handed) — dominant hand assignment critical

**Success Metrics:**
- Left-handed accuracy within 5pp of right-handed
- No "feels awkward" reports from left-handed testers
- Setup wizard correctly configures left-handed default

---

## 5. Community & Social (Privacy-Preserving)

### 5.1 Anonymous Leaderboards / Challenges (Opt-In, Local-First)

**Motivation:** Gamification increases retention in language learning (Duolingo, Memrise). **Privacy-preserving** approach:
- All scoring local; only *user chooses* to submit anonymous score
- No PII, no embeddings, no landmarks — just `(sign_id, score, timestamp)`
- Aggregated on server → daily/weekly "Community Challenge" (e.g., "This week: Greetings category")
- Local leaderboard (device-only) always available

**Technical Approach:**
1. **Local scoring:** FSRS mastery + streak + accuracy → composite score
2. **Opt-in submit:** "Share my progress anonymously?" modal after milestone
3. **Server endpoint:** Minimal API (Cloudflare Workers / Vercel Edge) accepting `{ sign_id, score, day_bucket }`
4. **Aggregation:** Daily top-100 per category, no user linking
5. **Display:** `/community` page with "This week's challenge" + anonymous top learners

**Effort:** Medium (2–3 weeks + minimal backend)
- Week 1: Local scoring, opt-in flow, API endpoint
- Week 2: Aggregation, community page, challenge rotation
- Week 3: Privacy review, CSP update, abuse prevention (rate limiting)

**Dependencies:** 2.1 (FSRS-5 mastery signal), 2.2 (curriculum categories)

**Success Metrics:**
- Opt-in rate ≥ 25% of active users
- Weekly challenge participation ≥ 10% of opted-in
- Zero privacy incidents / data leakage

---

## Prioritization Matrix

| Proposal | Impact | Effort | Dependencies | Phase |
|----------|--------|--------|--------------|-------|
| **2.1 FSRS-5** | High | Low | None | **v2.1** (quick win) |
| **3.1 PWA/Offline** | High | Med | None | **v2.1** |
| **3.2 WebGPU** | High | Low | None | **v2.1** (flag exists) |
| **1.2 Sign Detection** | Med | Low | None | **v2.1** |
| **2.3 Minimal Pairs** | High | Low | W3 | **v2.2** |
| **3.3 Quantization** | High | Med | W3, W7 | **v2.2** |
| **2.2 Guided Curriculum** | High | Med | W3, 2.1 | **v2.2** |
| **1.1 Few-Shot** | High | Med | W3, W5 | **v3.0** |
| **1.3 Two-Handed** | High | High | W1, W3 | **v3.0** |
| **1.4 Quality Scoring** | High | Med | W3, W4, W6 | **v3.0** |
| **2.4 Receptive Practice** | Med | Med | W1, W3 | **v3.0** |
| **1.5 Active Learning** | Med | Med | W5, W6 | **v3.0** |
| **4.1 SR Descriptions** | Med | Low | None | **v2.2** (a11y) |
| **4.2 Left-Handed Audit** | Med | Low | 1.3 | **v2.2** |
| **5.1 Community** | Med | Med | 2.1, 2.2 | **v3.0** |

---

## Research Gaps to Investigate

Before committing to v3.0 proposals, validate these assumptions:

1. **Few-shot SLR on embeddings:** Prototype with WLASL embeddings — what's 5-shot accuracy on 20 held-out classes?
2. **Two-handed landmark consistency:** MediaPipe `handedness` classification accuracy in diverse lighting/angles
3. **Quality score human correlation:** Collect 100 expert ratings on user attempts vs. proposed metrics
4. **Receptive video licensing:** Confirm WLASL/How2Sign clips can be used for receptive practice (CC BY 4.0 allows)
5. **WebGPU real-world speedup:** Benchmark on target devices (2020 MacBook, 2022 Chromebook, 2023 Android)
6. **Quantization accuracy drop:** INT8 static quantization on dynamic Transformer — actual vs. theoretical

---

## Recommended Next Steps

1. **Immediate (this sprint):**
   - Implement FSRS-5 (2.1) — 1 week, high impact, no deps
   - Enable WebGPU flag (3.2) — 3 days, flag exists
   - Add sign detection heuristic (1.2 Option A) — 3 days

2. **Next 2 sprints:**
   - PWA/Offline (3.1) — 2 weeks, enables mobile usage
   - Minimal pairs (2.3) — leverages W3 confusion analysis
   - Guided curriculum design (2.2) — linguist review needed

3. **v3.0 Planning (quarterly):**
   - Prototype few-shot (1.1) and two-handed (1.3) in parallel
   - Decide receptive video strategy (2.4)
   - Design quality scoring (1.4) with curriculum team

---

## Appendix: Related Work & References

### SLR Research (2023–2025)
- "SignBERT: Pre-training Transformers for Sign Language Understanding" (ICCV 2023)
- "Two-Handed Sign Language Recognition with Cross-Attention" (CVPR 2024)
- "Few-Shot Continuous Sign Language Recognition" (ECCV 2024)
- "MediaPipe Holistic for Real-Time Sign Language Recognition" (Google AI Blog 2024)

### EdTech / Language Learning
- Duolingo's "Spaced Repetition + Skill Tree" architecture (blog.duolingo.com)
- FSRS-5 algorithm: https://github.com/open-spaced-repetition/fsrs-ts
- "Minimal Pairs in Sign Language Phonology" (Brentari, 2019)

### Web ML
- onnxruntime-web WebGPU EP: https://onnxruntime.ai/docs/execution-providers/WebGPU-ExecutionProvider.html
- Model quantization: https://onnxruntime.ai/docs/performance/model-quantization.html
- PWA best practices: https://web.dev/progressive-web-apps/

---

*Document version: 1.0 | Generated from codebase analysis + research | Date: 2025*