/**
 * Progress tracking with FSRS-inspired spaced repetition.
 * Stored in localStorage under "signtutor.progress".
 * No account required — all local.
 */

export interface SignProgress {
  id: string;
  label: string;
  type: "static" | "dynamic";
  attempts: number;
  successes: number;
  lastAttempt: string | null; // ISO date
  nextReview: string | null;  // ISO date
  interval: number;           // days
  easeFactor: number;         // FSRS ease
  mastered: boolean;
}

export interface ProgressStore {
  signs: Record<string, SignProgress>;
  lastUpdated: string;
}

const STORAGE_KEY = "signtutor.progress";
const PREFS_KEY = "signtutor.prefs";

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

// ---- Prefs ----

export function getPrefs(): UserPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Partial<UserPrefs>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getPrefs();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch {}
}

// ---- Progress ----

export function getProgress(): ProgressStore {
  if (typeof window === "undefined") return { signs: {}, lastUpdated: new Date().toISOString() };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { signs: {}, lastUpdated: new Date().toISOString() };
    return JSON.parse(raw);
  } catch {
    return { signs: {}, lastUpdated: new Date().toISOString() };
  }
}

export function saveProgress(store: ProgressStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function getSignProgress(id: string, label: string, type: "static" | "dynamic"): SignProgress {
  const store = getProgress();
  return store.signs[id] ?? {
    id,
    label,
    type,
    attempts: 0,
    successes: 0,
    lastAttempt: null,
    nextReview: null,
    interval: 1,
    easeFactor: 2.5,
    mastered: false,
  };
}

/**
 * Record an attempt result and update FSRS scheduling.
 * grade: 0 = miss, 1 = close, 2 = match
 */
export function recordAttempt(
  id: string,
  label: string,
  type: "static" | "dynamic",
  grade: 0 | 1 | 2
): SignProgress {
  const store = getProgress();
  const prog = getSignProgress(id, label, type);

  prog.attempts++;
  if (grade === 2) prog.successes++;

  const now = new Date();
  prog.lastAttempt = now.toISOString();

  // Simple FSRS-inspired scheduling
  if (grade === 2) {
    prog.easeFactor = Math.max(1.3, prog.easeFactor + 0.1);
    prog.interval = Math.round(prog.interval * prog.easeFactor);
  } else if (grade === 1) {
    prog.interval = Math.max(1, Math.round(prog.interval * 0.8));
  } else {
    prog.interval = 1;
    prog.easeFactor = Math.max(1.3, prog.easeFactor - 0.2);
  }

  const next = new Date(now);
  next.setDate(next.getDate() + prog.interval);
  prog.nextReview = next.toISOString();

  // Mastery: 3+ successes with confidence
  prog.mastered = prog.successes >= 3 && prog.successes / prog.attempts >= 0.7;

  store.signs[id] = prog;
  store.lastUpdated = now.toISOString();
  saveProgress(store);

  return prog;
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
    .sort((a, b) => {
      // Sort by next review date (most overdue first)
      return new Date(a.nextReview!).getTime() - new Date(b.nextReview!).getTime();
    });
}

export function getMasteredCount(): number {
  const store = getProgress();
  return Object.values(store.signs).filter((s) => s.mastered).length;
}

export function getTotalAttempted(): number {
  const store = getProgress();
  return Object.values(store.signs).filter((s) => s.attempts > 0).length;
}
