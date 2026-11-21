# SignTutor — Detailed Implementation Plan

**Execution Order:** Quick Wins → High Impact → Research/Accessibility → Community
**Git Strategy:** Feature branch per feature → PR → merge to main → tag release

---

## Phase 1: Quick Wins (Week 1-2)

### 1.1 FSRS-5 Spaced Repetition Upgrade
**Branch:** `feature/fsrs5-upgrade`
**Effort:** 5 days
**Files to Modify:**
- `signtutor/lib/progress.ts` — Core FSRS-5 implementation
- `signtutor/lib/__tests__/progress.test.ts` — Tests
- `signtutor/components/PracticeQueue.tsx` — UI updates
- `signtutor/app/settings/page.tsx` — Retention target slider
- `signtutor/package.json` — Add `ts-fsrs` dependency

**Implementation Steps:**

#### Day 1: Core FSRS-5 Integration
```bash
# 1. Install dependency
cd signtutor && pnpm add ts-fsrs

# 2. Replace progress.ts with FSRS-5 implementation
# Key changes:
# - Import { FSRS, Card, Rating } from 'ts-fsrs'
# - Replace SignProgress with FSRS Card state
# - Implement recordAttempt using FSRS.repeat()
# - Add difficulty, stability, desired_retention fields
# - Migration function for existing localStorage data
```

#### Day 2: PracticeQueue UI Updates
- Add "Desired Retention" display in stats
- Show next review intervals with stability
- Add "Simulate 30 days" button (opens modal with projection)

#### Day 3: Settings Integration
- Add retention target slider (0.85-0.97, default 0.90)
- Persist to localStorage `signtutor.fsrs_config`
- Apply to all future scheduling

#### Day 4: Tests & Migration
- Unit tests for FSRS-5 scheduling behavior
- Migration test: existing progress → FSRS-5 cards
- Edge cases: first review, lapsed cards, easy/good/hard ratings

#### Day 5: E2E Tests & Polish
- Playwright test: complete lesson → verify FSRS scheduling
- Lighthouse a11y check
- Documentation update

**Acceptance Criteria:**
- [ ] `pnpm test` passes (all 24+ tests)
- [ ] `pnpm test:e2e` passes
- [ ] Existing users' progress migrates without loss
- [ ] Review load decreases ≥15% at same retention
- [ ] Retention slider works and persists

---

### 1.2 WebGPU Acceleration Enable
**Branch:** `feature/webgpu-acceleration`
**Effort:** 3 days
**Files to Modify:**
- `signtutor/lib/featureFlags.ts` — Enable webgpu flag logic
- `signtutor/components/StaticSignPlayer.tsx` — WebGPU session creation
- `signtutor/components/DynamicSignPlayer.tsx` — WebGPU session creation
- `signtutor/lib/__tests__/webgpu.test.ts` — Feature detection test

**Implementation Steps:**

#### Day 1: Feature Detection & Session Options
```typescript
// In featureFlags.ts - add WebGPU detection
export function isWebGPUSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'gpu' in navigator && navigator.gpu !== undefined;
}

// In players - update session creation
const executionProviders = isEnabled('webgpu') && isWebGPUSupported()
  ? ['webgpu', 'wasm']
  : ['wasm'];

const session = await ort.InferenceSession.create(modelPath, {
  executionProviders,
  // WebGPU-specific options
  webgpuPowerPreference: 'high-performance',
});
```

#### Day 2: Fallback Logic & Caching
- Graceful fallback if WebGPU init fails → WASM
- Shader compilation caching via IndexedDB
- Device capability logging (debug HUD)

#### Day 3: Benchmarks & Tests
- Benchmark script: `scripts/benchmark-webgpu.mjs`
- Test on target devices (simulate via CI matrix)
- Feature flag default: OFF (opt-in via Settings)

**Acceptance Criteria:**
- [ ] WebGPU EP loads on Chrome 113+, Edge 113+, Safari 17+
- [ ] Falls back to WASM gracefully on unsupported
- [ ] Latency ≤ 30% of WASM on supported devices
- [ ] Parity test passes (identical outputs)
- [ ] Feature flag controllable in Settings

---

### 1.3 Sign Detection Heuristic (Rule-Based)
**Branch:** `feature/sign-detection`
**Effort:** 3 days
**Files to Modify:**
- `signtutor/lib/signDetection.ts` — New module
- `signtutor/components/StaticSignPlayer.tsx` — Integration
- `signtutor/components/DynamicSignPlayer.tsx` — Integration
- `signtutor/lib/__tests__/signDetection.test.ts` — Tests

**Implementation Steps:**

#### Day 1: Core Detection Logic
```typescript
// lib/signDetection.ts
interface SignDetectionState {
  isSigning: boolean;
  confidence: number; // 0-1
  framesSinceSign: number;
}

const VELOCITY_THRESHOLD = 0.008; // normalized units/frame
const MIN_SIGN_FRAMES = 5;
const MAX_IDLE_FRAMES = 30;

export function updateSignDetection(
  state: SignDetectionState,
  landmarks: Landmark[] | null,
  prevWrist: {x: number, y: number} | null
): SignDetectionState {
  if (!landmarks) {
    return { ...state, framesSinceSign: state.framesSinceSign + 1 };
  }
  
  const wrist = landmarks[0];
  let velocity = 0;
  if (prevWrist) {
    velocity = Math.hypot(wrist.x - prevWrist.x, wrist.y - prevWrist.y);
  }
  
  const isMoving = velocity > VELOCITY_THRESHOLD;
  const newFramesSinceSign = isMoving ? 0 : state.framesSinceSign + 1;
  const isSigning = newFramesSinceSign < MAX_IDLE_FRAMES && 
                    state.framesSinceSign < MIN_SIGN_FRAMES;
  
  return {
    isSigning,
    confidence: isMoving ? Math.min(1, velocity / VELOCITY_THRESHOLD * 0.5) : 0,
    framesSinceSign: newFramesSinceSign
  };
}
```

#### Day 2: Player Integration
- StaticSignPlayer: Gate inference + show "Ready" / "Signing" indicator
- DynamicSignPlayer: Auto-start recording when signing detected
- UI: Subtle pulse indicator when `isSigning === true`

#### Day 3: Tuning & Tests
- Calibrate thresholds on real data
- Unit tests for state machine
- E2E: Verify no false positives during idle

**Acceptance Criteria:**
- [ ] False positive rate < 5% during 60s idle
- [ ] Detection latency < 200ms from sign start
- [ ] Zero model size increase
- [ ] Dynamic player auto-record works smoothly

---

## Phase 2: High Impact Features (Week 3-6)

### 2.1 PWA + Offline-First Architecture
**Branch:** `feature/pwa-offline`
**Effort:** 10 days
**Files to Modify/Create:**
- `signtutor/next.config.ts` — next-pwa config
- `signtutor/public/manifest.json` — PWA manifest
- `signtutor/public/sw.js` — Service worker (Workbox)
- `signtutor/components/InstallPrompt.tsx` — Install banner
- `signtutor/lib/offline.ts` — Offline utilities
- `signtutor/app/layout.tsx` — Manifest link, theme-color
- `.github/workflows/pwa-test.yml` — Lighthouse CI

**Implementation Steps:**

#### Day 1-2: Workbox Configuration
```typescript
// next.config.ts
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'mediapipe-cdn',
        expiration: { maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/models\/.*\.onnx$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'onnx-models',
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
});
```

#### Day 3: Manifest & Icons
- Generate icons (72x72 to 512x512) from logo
- manifest.json with shortcuts: Practice, Learn, Setup
- Theme colors matching CSS custom properties

#### Day 4-5: Service Worker & Caching
- Precaching: all static assets, ONNX models
- Runtime caching: MediaPipe CDN, curriculum data
- Offline fallback page (`/offline`)

#### Day 6: Install Prompt UX
- Custom "Install SignTutor" banner (after 2nd visit, 30s delay)
- `beforeinstallprompt` handler
- Dismissible, remembers dismissal

#### Day 7: Offline Utilities
- `isOnline()` hook with navigator.onLine + fetch check
- Queue failed analytics (if any) for background sync
- IndexedDB for larger offline storage

#### Day 8-9: Testing & Lighthouse
- Lighthouse CI in GitHub Actions (PWA score ≥ 90)
- Manual offline testing: airplane mode, lesson completion
- Cache inspection in DevTools

#### Day 10: Documentation & Polish
- Update README with PWA features
- Screenshots for install prompt
- Changelog entry

**Acceptance Criteria:**
- [ ] Lighthouse PWA score ≥ 90
- [ ] Offline lesson completion works end-to-end
- [ ] Models cached and load offline
- [ ] Install prompt appears correctly
- [ ] No regression in online performance

---

### 2.2 Minimal Pairs Training
**Branch:** `feature/minimal-pairs`
**Effort:** 10 days
**Files to Modify/Create:**
- `signtutor/lib/curriculum.ts` — Confusion pair extraction
- `signtutor/lib/minimalPairs.ts` — Core logic
- `signtutor/components/MinimalPairsPlayer.tsx` — New component
- `signtutor/app/practice/minimal-pairs/page.tsx` — Route
- `signtutor/components/DynamicSignPlayer.tsx` — Comparison mode
- `signtutor/components/StaticSignPlayer.tsx` — Comparison mode
- `signtutor/lib/__tests__/minimalPairs.test.ts` — Tests

**Implementation Steps:**

#### Day 1: Confusion Pair Extraction
```typescript
// lib/minimalPairs.ts
export interface ConfusionPair {
  signA: string;
  signB: string;
  confusionRate: number; // 0-1
  distinguishingFeatures: string[];
}

export function extractConfusionPairs(
  confusionMatrix: number[][],
  labels: string[],
  threshold = 0.10
): ConfusionPair[] {
  const pairs: ConfusionPair[] = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const totalI = confusionMatrix[i].reduce((a, b) => a + b, 0);
      const totalJ = confusionMatrix[j].reduce((a, b) => a + b, 0);
      const rateIJ = totalI > 0 ? confusionMatrix[i][j] / totalI : 0;
      const rateJI = totalJ > 0 ? confusionMatrix[j][i] / totalJ : 0;
      const maxRate = Math.max(rateIJ, rateJI);
      if (maxRate >= threshold) {
        pairs.push({
          signA: labels[i],
          signB: labels[j],
          confusionRate: maxRate,
          distinguishingFeatures: computeDistinguishingFeatures(labels[i], labels[j])
        });
      }
    }
  }
  return pairs.sort((a, b) => b.confusionRate - a.confusionRate);
}
```

#### Day 2: Differential Tip Generation
- Extend `chooseTip()` in `fingerStates.ts` to accept `compareTo?: string`
- Generate tips like: "Your MOTHER looks like FATHER — thumb touches chin vs forehead"

#### Day 3: MinimalPairsPlayer Component
- Side-by-side demo videos
- Alternating recording flow
- Progress tracking per pair

#### Day 4: Practice Route & Queue
- `/practice/minimal-pairs` page
- User-specific queue from personal confusion history
- Global queue from eval report

#### Day 5: Player Comparison Mode
- StaticSignPlayer: `comparisonMode` prop
- DynamicSignPlayer: `comparisonMode` prop
- Shared UI for alternating targets

#### Day 6-7: Integration & Polish
- Link from Practice page stats
- Settings: "Enable minimal pairs practice"
- Keyboard shortcuts for alternating

#### Day 8-9: Tests
- Unit: confusion extraction, tip generation
- E2E: complete minimal pair session
- A11y: ARIA labels for comparison UI

#### Day 10: Documentation
- Update ARCHITECTURE.md
- Changelog

**Acceptance Criteria:**
- [ ] Top 20 confusion pairs extracted from eval report
- [ ] Differential tips generated for each pair
- [ ] Minimal pairs practice queue works
- [ ] Error rate on practiced pairs decreases ≥40%
- [ ] All tests pass

---

### 2.3 Guided Curriculum
**Branch:** `feature/guided-curriculum`
**Effort:** 15 days
**Files to Modify/Create:**
- `signtutor/lib/curriculum.ts` — Lesson graph, prerequisites
- `signtutor/lib/userCurriculum.ts` — Progress tracking
- `signtutor/app/learn/asl/curriculum/page.tsx` — Curriculum map page
- `signtutor/app/learn/asl/curriculum/[lessonId]/page.tsx` — Lesson page
- `signtutor/components/CurriculumMap.tsx` — Visual path component
- `signtutor/components/LessonPlayer.tsx` — Wrapper for lesson steps
- `signtutor/lib/__tests__/curriculum.test.ts` — Tests

**Implementation Steps:**

#### Day 1-3: Curriculum Data Design
```typescript
// lib/curriculum.ts additions
export interface LessonStep {
  id: string;
  title: string;
  communicativeGoal: string;
  signs: string[]; // 3-5 signs
  prerequisites: string[]; // lesson IDs
  estimatedMinutes: number;
  type: 'fingerspelling' | 'vocabulary' | 'mixed';
}

export const CURRICULUM_PATH: LessonStep[] = [
  {
    id: 'foundations-1',
    title: 'Foundations 1: Basic Handshapes',
    communicativeGoal: 'Master the 5 basic handshapes',
    signs: ['A', 'B', 'C', 'S', 'O'],
    prerequisites: [],
    estimatedMinutes: 15,
    type: 'fingerspelling'
  },
  // ... 19 more lessons covering all 200 signs
];
```

#### Day 4-5: Progress Tracking
- `UserCurriculumProgress` in localStorage
- Completed lessons, current lesson, sign mastery per lesson
- Adaptive unlocking: prerequisites must be `mastered: true` (FSRS-5)

#### Day 6-8: Curriculum Map UI
- Visual path with nodes (lessons) and edges (prerequisites)
- Locked/unlocked/in-progress/completed states
- Responsive: horizontal on desktop, vertical on mobile
- Click lesson → navigate to lesson page

#### Day 9-10: Lesson Page
- Sequential sign practice within lesson
- "Lesson 3 of 20" progress indicator
- Completion celebration + unlock next lesson
- Skip option (for advanced users)

#### Day 11-12: Integration
- Redirect `/learn/asl/fingerspelling` → curriculum map (new users)
- Practice queue prioritizes current lesson signs
- Settings: "Guided curriculum" toggle

#### Day 13-14: Tests & Polish
- Unit: unlocking logic, progress persistence
- E2E: new user completes first 3 lessons
- A11y: keyboard navigation on curriculum map

#### Day 15: Documentation

**Acceptance Criteria:**
- [ ] 20 lessons covering all 200 signs + 24 letters
- [ ] Prerequisite unlocking works with FSRS-5 mastery
- [ ] Visual curriculum map renders correctly
- [ ] New user completion rate (first 5 lessons) ≥ 60%
- [ ] All tests pass

---

### 2.4 Model Quantization (INT8)
**Branch:** `feature/model-quantization`
**Effort:** 15 days
**Files to Modify/Create:**
- `ml/quantize.py` — Quantization script
- `ml/train_export.py` — Add `--quantize` flag
- `ml/train_transformer.py` — Add `--quantize` flag
- `ci/check_nfr.py` — Quantization accuracy gate
- `.github/workflows/ml-gate.yml` — Quantized model artifacts

**Implementation Steps:**

#### Day 1-3: Post-Training Quantization (PTQ)
```python
# ml/quantize.py
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

def quantize_model(input_path: str, output_path: str, mode='dynamic'):
    if mode == 'dynamic':
        quantize_dynamic(
            input_path, output_path,
            weight_type=QuantType.QInt8,
            optimize_model=True
        )
    elif mode == 'static':
        # Requires calibration data
        from onnxruntime.quantization import CalibrationDataReader
        # ... static quantization
```

#### Day 4-5: Static Quantization with Calibration
- Create `CalibrationDataReader` from validation set
- Static quantization for dynamic Transformer (better accuracy)
- Dynamic quantization for static MLP (simpler)

#### Day 6-7: Training Script Integration
- Add `--quantize dynamic|static|none` flag
- Auto-run quantization after ONNX export
- Output both FP32 and INT8 models

#### Day 8-9: Accuracy Evaluation
- Compare FP32 vs INT8 on held-out test set
- Per-class accuracy, ECE, latency benchmark
- Gate: accuracy drop ≤ 1pp, ECE increase ≤ 0.01

#### Day 10-11: CI Integration
- Upload quantized models as artifacts
- Update `check_nfr.py` to test quantized models
- Fail build if quantization gate fails

#### Day 12-13: JS Runtime Testing
- Verify onnxruntime-web loads INT8 models
- Benchmark WASM + INT8 vs FP32
- Test on mobile (Chrome DevTools device toolbar)

#### Day 14-15: Documentation & Rollout
- Update ARCHITECTURE.md with model sizes
- Decision: ship INT8 as default, FP32 as fallback
- Changelog

**Acceptance Criteria:**
- [ ] Dynamic model ≤ 500 KB (from 1.4 MB) at INT8
- [ ] Static model ≤ 30 KB (from 72 KB)
- [ ] Accuracy drop ≤ 1pp vs FP32
- [ ] Inference latency improvement ≥ 20% on mobile
- [ ] CI gate passes

---

## Phase 3: Accessibility & Polish (Week 7-8)

### 3.1 Screen Reader Semantic Descriptions
**Branch:** `feature/sr-descriptions`
**Effort:** 5 days

### 3.2 Left-Handed Audit & Fixes
**Branch:** `feature/left-handed-audit`
**Effort:** 5 days

---

## Phase 4: Research Features (Week 9+)

### 4.1 Few-Shot Sign Recognition
**Branch:** `feature/few-shot`
**Effort:** 15 days

### 4.2 Two-Handed Sign Support
**Branch:** `feature/two-handed`
**Effort:** 25 days

### 4.3 Quality Scoring
**Branch:** `feature/quality-scoring`
**Effort:** 15 days

### 4.4 Active Learning
**Branch:** `feature/active-learning`
**Effort:** 10 days

### 4.4 Receptive Practice
**Branch:** `feature/receptive-practice`
**Effort:** 15 days

### 4.5 Community Challenges
**Branch:** `feature/community`
**Effort:** 15 days

---

## Git Workflow per Feature

```bash
# 1. Create feature branch from main
git checkout main && git pull origin main
git checkout -b feature/<feature-name>

# 2. Implement in commits (logical chunks)
git add -A
git commit -m "feat(<feature>): <description>

- Detail 1
- Detail 2

Closes #<issue-number>"

# 3. Run full test suite
pnpm test && pnpm test:e2e && pnpm typecheck && pnpm lint

# 4. Push and create PR
git push origin feature/<feature-name>
gh pr create --title "feat: <feature name>" --body "$(cat PR_TEMPLATE.md)"

# 5. After review & CI pass: squash merge
gh pr merge --squash --delete-branch

# 6. Tag release
git checkout main && git pull origin main
git tag -a v<version> -m "Release v<version>"
git push origin v<version>
```

---

## Versioning Scheme

| Phase | Version | Features |
|-------|---------|----------|
| Current | v2.0.0 | W1-W8 complete |
| Phase 1 | v2.1.0 | FSRS-5, WebGPU, Sign Detection |
| Phase 2 | v2.2.0 | PWA, Minimal Pairs, Curriculum, Quantization |
| Phase 3 | v2.3.0 | SR Descriptions, Left-Handed |
| Phase 4 | v3.0.0 | Few-Shot, Two-Handed, Quality, Active Learning, Receptive, Community |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| FSRS-5 migration loses progress | Comprehensive migration test; backup localStorage before migration |
| WebGPU breaks on some devices | Feature flag OFF by default; extensive device testing |
| PWA caching breaks updates | Versioned cache names; `skipWaiting` + `clients.claim()` |
| Quantization accuracy drop | Static quantization with calibration; gate at 1pp |
| Curriculum design controversy | Linguist review; configurable path; skip option |

---

## Success Metrics Dashboard

Track in GitHub Project / Notion:

| Metric | Baseline (v2.0) | Target (v2.3) | Target (v3.0) |
|--------|-----------------|---------------|---------------|
| Lighthouse PWA | N/A | ≥90 | ≥95 |
| Review load (cards/day) | ~50 | ≤35 | ≤25 |
| Model size (dynamic) | 1.4 MB | ≤500 KB | ≤300 KB |
| Inference latency (mobile) | ~400ms | ≤200ms | ≤100ms |
| New user 5-lesson completion | ~30% | ≥60% | ≥75% |
| Confusion pair error rate | ~15% | ≤9% | ≤5% |
| Left-handed accuracy gap | Unknown | ≤5pp | ≤2pp |
| Screen reader task success | Unknown | ≥90% | ≥95% |

---

*Plan Version: 1.0 | Created: 2025 | Next Review: After Phase 1 Complete*