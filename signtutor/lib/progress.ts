/**
 * Progress tracking with FSRS-5 spaced repetition (via ts-fsrs).
 * Stored in localStorage under "signtutor.progress".
 * No account required — all local.
 */

import { DefaultScheduler, Rating } from "ts-fsrs";

// Type for our internal card representation (matches ts-fsrs new scheduler Card output)
interface InternalCard {
  cardId: string | number;
  dueAt: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningStep: number;
  reps: number;
  lapses: number;
  scheduleStatus: "new" | "learning" | "review";
  lastReviewAt: Date | null;
  // For FSRS-7 compatibility
  stabilityFast?: number;
  state?: number;
}

export interface SignProgress {
  id: string;
  label: string;
  type: "static" | "dynamic";
  // FSRS-5 card state
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: "New" | "Learning" | "Review" | "Relearning";
  last_review: string | null;
  // Legacy fields for compatibility/migration
  attempts: number;
  successes: number;
  lastAttempt: string | null;
  nextReview: string | null;
  interval: number;
  easeFactor: number;
  mastered: boolean;
}

export interface ProgressStore {
  signs: Record<string, SignProgress>;
  lastUpdated: string;
  fsrsVersion: number;
}

const STORAGE_KEY = "signtutor.progress";
const PREFS_KEY = "signtutor.prefs";
const FSRS_CONFIG_KEY = "signtutor.fsrs_config";

export interface UserPrefs {
  language: string;
  handedness: "right" | "left";
  mirror: boolean;
  completedAt: string | null;
}

const DEFAULT_PREFS: UserPrefs = {
  language: "asl",
  handedness: "right",
  mirror: true,
  completedAt: null,
};

export interface FSRSConfig {
  desiredRetention: number;
  maximumInterval: number;
  enableShortTerm: boolean;
  learningSteps: string[];
  relearningSteps: string[];
  enableFuzz: boolean;
  version: "FSRS-5" | "FSRS-6" | "FSRS-7";
}

const DEFAULT_FSRS_CONFIG: FSRSConfig = {
  desiredRetention: 0.90,
  maximumInterval: 36500,
  enableShortTerm: true,
  learningSteps: ["1m", "10m"],
  relearningSteps: ["10m"],
  enableFuzz: false,
  version: "FSRS-5",
};

let schedulerPromise: Promise<Awaited<ReturnType<typeof DefaultScheduler>>> | null = null;

async function getScheduler(config?: Partial<FSRSConfig>): Promise<Awaited<ReturnType<typeof DefaultScheduler>>> {
  if (!schedulerPromise) {
    const cfg = { ...DEFAULT_FSRS_CONFIG, ...config };
    schedulerPromise = DefaultScheduler({
      version: cfg.version,
      desiredRetention: cfg.desiredRetention,
      maximumInterval: cfg.maximumInterval,
      enableShortTerm: cfg.enableShortTerm,
      learningSteps: cfg.learningSteps as readonly `${number}m`[] | readonly `${number}h`[] | readonly `${number}d`[],
      relearningSteps: cfg.relearningSteps as readonly `${number}m`[] | readonly `${number}h`[] | readonly `${number}d`[],
      enableFuzz: cfg.enableFuzz,
    });
  }
  return schedulerPromise;
}

function invalidateSchedulerCache(): void {
  schedulerPromise = null;
}

function hasLocalStorage(): boolean {
  try {
    return typeof globalThis !== "undefined" && globalThis.localStorage !== undefined;
  } catch {
    return false;
  }
}

// ---- Prefs ----

export function getPrefs(): UserPrefs {
  if (!hasLocalStorage()) return DEFAULT_PREFS;
  try {
    const raw = globalThis.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Partial<UserPrefs>): void {
  if (!hasLocalStorage()) return;
  try {
    const current = getPrefs();
    globalThis.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch {}
}

// ---- FSRS Config ----

export function getFSRSConfig(): FSRSConfig {
  if (!hasLocalStorage()) return DEFAULT_FSRS_CONFIG;
  try {
    const raw = globalThis.localStorage.getItem(FSRS_CONFIG_KEY);
    if (!raw) return DEFAULT_FSRS_CONFIG;
    return { ...DEFAULT_FSRS_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FSRS_CONFIG;
  }
}

export function saveFSRSConfig(config: Partial<FSRSConfig>): void {
  if (!hasLocalStorage()) return;
  try {
    const current = getFSRSConfig();
    globalThis.localStorage.setItem(FSRS_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
    invalidateSchedulerCache();
  } catch {}
}

// ---- Progress ----

export function getProgress(): ProgressStore {
  if (!hasLocalStorage()) return { signs: {}, lastUpdated: new Date().toISOString(), fsrsVersion: 5 };
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { signs: {}, lastUpdated: new Date().toISOString(), fsrsVersion: 5 };
    const parsed = JSON.parse(raw);
    if (!parsed.fsrsVersion) {
      parsed.fsrsVersion = 5;
    }
    return parsed;
  } catch {
    return { signs: {}, lastUpdated: new Date().toISOString(), fsrsVersion: 5 };
  }
}

export function saveProgress(store: ProgressStore): void {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

// Create a proper new card using the scheduler's newCard method
async function createNewCard(scheduler: Awaited<ReturnType<typeof DefaultScheduler>>, now: Date) {
  const card = scheduler.newCard({ now });
  return {
    cardId: card.cardId,
    dueAt: card.dueAt,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduledDays,
    learningStep: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    scheduleStatus: card.scheduleStatus,
    lastReviewAt: card.lastReviewAt,
    stabilityFast: (card as any).stabilityFast ?? 0,
    state: (card as any).state ?? 0,
  };
}

// Convert our stored SignProgress to ts-fsrs InternalCard
async function progressToCard(prog: SignProgress, now: Date, scheduler: Awaited<ReturnType<typeof DefaultScheduler>>) {
  if (prog.stability !== undefined && prog.stability > 0) {
    // Existing card with FSRS data
    const statusMap: Record<string, "new" | "learning" | "review"> = {
      "New": "new",
      "Learning": "learning",
      "Review": "review",
      "Relearning": "learning",
    };
    return {
      cardId: prog.id,
      dueAt: prog.nextReview ? new Date(prog.nextReview) : now,
      stability: prog.stability,
      difficulty: prog.difficulty,
      scheduledDays: prog.scheduled_days,
      learningStep: prog.learning_steps,
      reps: prog.reps,
      lapses: prog.lapses,
      scheduleStatus: statusMap[prog.state] || "new",
      lastReviewAt: prog.last_review ? new Date(prog.last_review) : null,
      stabilityFast: 0,
      state: 0,
    };
  } else {
    // New card - use scheduler's newCard for proper initialization
    return createNewCard(scheduler, now);
  }
}

// Convert ts-fsrs result card to our SignProgress
function cardToProgress(card: any, label: string, type: "static" | "dynamic", legacy?: SignProgress): SignProgress {
  const now = new Date();
  const statusMap: Record<string, "New" | "Learning" | "Review" | "Relearning"> = {
    "new": "New",
    "learning": "Learning",
    "review": "Review",
  };
  return {
    id: legacy?.id ?? `asl-${type}-${label}`,
    label,
    type,
    due: card.dueAt.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    state: statusMap[card.scheduleStatus] ?? "New",
    last_review: card.lastReviewAt?.toISOString() ?? null,
    attempts: (legacy?.attempts ?? 0) + 1,
    successes: (legacy?.successes ?? 0) + (card.scheduleStatus === "review" ? 1 : 0),
    lastAttempt: now.toISOString(),
    nextReview: card.dueAt.toISOString(),
    interval: card.scheduledDays,
    easeFactor: Math.max(1.3, 5.5 - card.difficulty * 0.5),
    mastered: card.scheduleStatus === "review" && card.stability >= 30 && card.reps >= 3,
  };
}

/**
 * Record an attempt result and update FSRS-5 scheduling.
 * grade: 0 = miss (Again), 1 = close (Hard), 2 = match (Good)
 */
export async function recordAttempt(
  id: string,
  label: string,
  type: "static" | "dynamic",
  grade: 0 | 1 | 2
): Promise<SignProgress> {
  const store = getProgress();
  const config = getFSRSConfig();
  const scheduler = await getScheduler(config);

  const now = new Date();
  const legacyProg = store.signs[id];

  // Convert to internal card format
  const card = legacyProg
    ? await progressToCard(legacyProg, now, scheduler)
    : await createNewCard(scheduler, now);

  // Map our 3-grade system to FSRS ratings
  const fsrsGrade = grade === 0 ? Rating.Again : grade === 1 ? Rating.Hard : Rating.Good;

  // Review the card using new scheduler API
  const result = scheduler.review({ card: card as any, grade: fsrsGrade, now });

  // Convert back to SignProgress
  const updated = cardToProgress(result.card, label, type, legacyProg);
  updated.lastAttempt = now.toISOString();
  updated.nextReview = result.card.dueAt.toISOString();

  store.signs[id] = updated;
  store.lastUpdated = now.toISOString();
  store.fsrsVersion = 5;
  saveProgress(store);

  return updated;
}

/**
 * Get the review queue — signs due for review, sorted by urgency.
 */
export function getReviewQueue(): SignProgress[] {
  const store = getProgress();
  const now = new Date();
  return Object.values(store.signs)
    .filter((s) => s.attempts > 0 && s.nextReview !== null)
    .filter((s) => new Date(s.nextReview!) <= now)
    .sort((a, b) => new Date(a.nextReview!).getTime() - new Date(b.nextReview!).getTime());
}

export function getMasteredCount(): number {
  const store = getProgress();
  return Object.values(store.signs).filter((s) => s.mastered).length;
}

export function getTotalAttempted(): number {
  const store = getProgress();
  return Object.values(store.signs).filter((s) => s.attempts > 0).length;
}

/**
 * Get a sign's current retrievability (estimated recall probability).
 * Returns 0-1, where 1 = certain recall, 0 = certain forgetting.
 */
export async function getRetrievability(id: string): Promise<number> {
  const store = getProgress();
  const prog = store.signs[id];
  if (!prog || prog.attempts === 0) return 0;

  const config = getFSRSConfig();
  const scheduler = await getScheduler(config);

  const card = await progressToCard(prog, new Date(), scheduler);
  const elapsedDays = scheduler.chrono.difference(
    prog.last_review ? new Date(prog.last_review) : new Date(prog.due),
    new Date()
  );

  const memoryState = config.version === "FSRS-7"
    ? { stability: card.stability, stabilityFast: 0, difficulty: card.difficulty }
    : { stability: card.stability, difficulty: card.difficulty };

  return scheduler.model.forgettingCurve(memoryState as any, elapsedDays);
}

/**
 * Simulate the review schedule for the next N days.
 */
export async function simulateReviewSchedule(days = 30): Promise<Array<{ date: string; count: number }>> {
  const store = getProgress();
  const now = new Date();
  const schedule: Record<string, number> = {};

  for (const prog of Object.values(store.signs)) {
    if (prog.attempts === 0) continue;

    let currentDue = new Date(prog.due);
    for (let i = 0; i < 10; i++) {
      const dateStr = currentDue.toISOString().split("T")[0];
      const maxDate = new Date(now.getTime() + days * 86400000).toISOString().split("T")[0];
      if (dateStr > maxDate) break;
      schedule[dateStr] = (schedule[dateStr] || 0) + 1;
      const nextInterval = Math.max(1, Math.round(prog.scheduled_days * (1 + prog.stability / 50)));
      currentDue = new Date(currentDue.getTime() + nextInterval * 86400000);
    }
  }

  return Object.entries(schedule)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Migrate legacy progress data to FSRS-5 format.
 */
export async function migrateToFSRS5(): Promise<void> {
  const store = getProgress();
  if (store.fsrsVersion >= 5) return;

  const config = getFSRSConfig();
  const scheduler = await getScheduler(config);
  const now = new Date();

  for (const [id, prog] of Object.entries(store.signs)) {
    if (prog.attempts === 0) continue;
    if (prog.stability !== undefined) continue;

    // Create initial card using scheduler's newCard
    let currentCard = await createNewCard(scheduler, now);

    // Replay history approximately
    const avgGrade = prog.successes / Math.max(1, prog.attempts);
    let fsrsGrade: import("ts-fsrs").Rating;
    if (avgGrade >= 0.8) fsrsGrade = Rating.Good;
    else if (avgGrade >= 0.5) fsrsGrade = Rating.Hard;
    else fsrsGrade = Rating.Again;

    const reviewCount = Math.min(prog.attempts, 5);
    for (let i = 0; i < reviewCount; i++) {
      const result = scheduler.review({ card: currentCard as any, grade: fsrsGrade, now });
      currentCard = result.card;
    }

    store.signs[id] = cardToProgress(currentCard, prog.label, prog.type, prog);
  }

  store.fsrsVersion = 5;
  store.lastUpdated = now.toISOString();
  saveProgress(store);
}

/**
 * Reset all progress data.
 */
export function resetProgress(): void {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const STORAGE_KEY = "signtutor.progress";
const PREFS_KEY = "signtutor.prefs";
const FSRS_CONFIG_KEY = "signtutor.fsrs_config";

export interface UserPrefs {
  language: string;
  handedness: "right" | "left";
  mirror: boolean;
  completedAt: string | null;
}

const DEFAULT_PREFS: UserPrefs = {
  language: "asl",
  handedness: "right",
  mirror: true,
  completedAt: null,
};

export interface FSRSConfig {
  desiredRetention: number;
  maximumInterval: number;
  enableShortTerm: boolean;
  learningSteps: string[];
  relearningSteps: string[];
  enableFuzz: boolean;
  version: "FSRS-5" | "FSRS-6" | "FSRS-7";
}

const DEFAULT_FSRS_CONFIG: FSRSConfig = {
  desiredRetention: 0.90,
  maximumInterval: 36500,
  enableShortTerm: true,
  learningSteps: ["1m", "10m"],
  relearningSteps: ["10m"],
  enableFuzz: false,
  version: "FSRS-5",
};

let schedulerPromise: Promise<Awaited<ReturnType<typeof DefaultScheduler>>> | null = null;

async function getScheduler(config?: Partial<FSRSConfig>): Promise<Awaited<ReturnType<typeof DefaultScheduler>>> {
  if (!schedulerPromise) {
    const cfg = { ...DEFAULT_FSRS_CONFIG, ...config };
    schedulerPromise = DefaultScheduler({
      version: cfg.version,
      desiredRetention: cfg.desiredRetention,
      maximumInterval: cfg.maximumInterval,
      enableShortTerm: cfg.enableShortTerm,
      learningSteps: cfg.learningSteps as readonly `${number}m`[] | readonly `${number}h`[] | readonly `${number}d`[],
      relearningSteps: cfg.relearningSteps as readonly `${number}m`[] | readonly `${number}h`[] | readonly `${number}d`[],
      enableFuzz: cfg.enableFuzz,
    });
  }
  return schedulerPromise;
}

function invalidateSchedulerCache(): void {
  schedulerPromise = null;
}

function hasLocalStorage(): boolean {
  try {
    return typeof globalThis !== "undefined" && globalThis.localStorage !== undefined;
  } catch {
    return false;
  }
}

// ---- Prefs ----

export function getPrefs(): UserPrefs {
  if (!hasLocalStorage()) return DEFAULT_PREFS;
  try {
    const raw = globalThis.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Partial<UserPrefs>): void {
  if (!hasLocalStorage()) return;
  try {
    const current = getPrefs();
    globalThis.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch {}
}

// ---- FSRS Config ----

export function getFSRSConfig(): FSRSConfig {
  if (!hasLocalStorage()) return DEFAULT_FSRS_CONFIG;
  try {
    const raw = globalThis.localStorage.getItem(FSRS_CONFIG_KEY);
    if (!raw) return DEFAULT_FSRS_CONFIG;
    return { ...DEFAULT_FSRS_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FSRS_CONFIG;
  }
}

export function saveFSRSConfig(config: Partial<FSRSConfig>): void {
  if (!hasLocalStorage()) return;
  try {
    const current = getFSRSConfig();
    globalThis.localStorage.setItem(FSRS_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
    invalidateSchedulerCache();
  } catch {}
}

// ---- Progress ----

export function getProgress(): ProgressStore {
  if (!hasLocalStorage()) return { signs: {}, lastUpdated: new Date().toISOString(), fsrsVersion: 5 };
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { signs: {}, lastUpdated: new Date().toISOString(), fsrsVersion: 5 };
    const parsed = JSON.parse(raw);
    if (!parsed.fsrsVersion) {
      parsed.fsrsVersion = 5;
    }
    return parsed;
  } catch {
    return { signs: {}, lastUpdated: new Date().toISOString(), fsrsVersion: 5 };
  }
}

export function saveProgress(store: ProgressStore): void {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function resetProgress(): void {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}