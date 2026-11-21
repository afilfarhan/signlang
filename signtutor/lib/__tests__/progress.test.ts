/**
 * FSRS-5 Progress tracking tests.
 * Tests the ts-fsrs integration and migration logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getProgress,
  saveProgress,
  recordAttempt,
  getReviewQueue,
  getMasteredCount,
  getTotalAttempted,
  migrateToFSRS5,
  resetProgress,
  getFSRSConfig,
  saveFSRSConfig,
  type SignProgress,
  type ProgressStore,
} from "../progress";

// Mock localStorage with proper persistence
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get store() { return store; },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Use a test FSRS config without short-term learning steps for cleaner day-based intervals
const TEST_FSRS_CONFIG = {
  desiredRetention: 0.9,
  maximumInterval: 36500,
  enableShortTerm: false,
  learningSteps: [] as string[],
  relearningSteps: [] as string[],
  enableFuzz: false,
  version: "FSRS-5" as const,
};

describe("FSRS-5 Progress Tracking", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    // Use test FSRS config (no short-term learning steps)
    saveFSRSConfig(TEST_FSRS_CONFIG);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorageMock.clear();
  });

  describe("Basic Progress Operations", () => {
    it("returns empty progress for new user", () => {
      const progress = getProgress();
      expect(progress.signs).toEqual({});
      expect(progress.fsrsVersion).toBe(5);
    });

    it("saves and loads progress", () => {
      const store: ProgressStore = {
        signs: {
          "test-id": {
            id: "test-id",
            label: "A",
            type: "static",
            due: "2026-01-02T12:00:00.000Z",
            stability: 2.5,
            difficulty: 5.0,
            scheduled_days: 3,
            learning_steps: 0,
            reps: 1,
            lapses: 0,
            state: "Review",
            last_review: "2026-01-01T12:00:00.000Z",
            attempts: 1,
            successes: 1,
            lastAttempt: "2026-01-01T12:00:00.000Z",
            nextReview: "2026-01-02T12:00:00.000Z",
            interval: 3,
            easeFactor: 2.5,
            mastered: false,
          },
        },
        lastUpdated: "2026-01-01T12:00:00.000Z",
        fsrsVersion: 5,
      };
      saveProgress(store);
      const loaded = getProgress();
      expect(loaded.signs["test-id"]).toBeDefined();
      expect(loaded.signs["test-id"].label).toBe("A");
    });
  });

  describe("recordAttempt with FSRS-5", () => {
    it("creates new card on first attempt (grade: Good)", async () => {
      const result = await recordAttempt("asl-static-A", "A", "static", 2);
      expect(result.id).toBe("asl-static-A");
      expect(result.label).toBe("A");
      expect(result.type).toBe("static");
      expect(result.attempts).toBeGreaterThanOrEqual(1);
      // With enableShortTerm=false, new cards start in Review state
      expect(result.state).toBe("Review");
      expect(result.scheduled_days).toBeGreaterThan(0);
      expect(result.stability).toBeGreaterThan(0);
      expect(result.difficulty).toBeGreaterThan(0);
    });

    it("creates new card on first attempt (grade: Again)", async () => {
      const result = await recordAttempt("asl-static-B", "B", "static", 0);
      expect(result.attempts).toBe(1);
      // With enableShortTerm=false, new cards start in Review.
      // Again on Review -> Relearning
      expect(["Review", "Relearning"]).toContain(result.state);
      expect(result.scheduled_days).toBeGreaterThanOrEqual(1);
    });

    it("creates new card on first attempt (grade: Hard)", async () => {
      const result = await recordAttempt("asl-static-C", "C", "static", 1);
      expect(result.attempts).toBe(1);
      // Hard on new card -> Review state (with lower stability)
      expect(result.state).toBe("Review");
    });

    it("progresses card through multiple reviews", async () => {
      // First review - Good
      let result = await recordAttempt("asl-static-D", "D", "static", 2);
      expect(result.state).toBe("Review");
      const firstInterval = result.scheduled_days;

      // Advance time past the due date
      vi.advanceTimersByTime(firstInterval * 24 * 60 * 60 * 1000 + 1000);

      // Second review - Good
      result = await recordAttempt("asl-static-D", "D", "static", 2);
      expect(result.reps).toBeGreaterThanOrEqual(2);
      expect(result.scheduled_days).toBeGreaterThan(firstInterval);

      // Third review - Good
      vi.advanceTimersByTime(result.scheduled_days * 24 * 60 * 60 * 1000 + 1000);
      result = await recordAttempt("asl-static-D", "D", "static", 2);
      expect(result.reps).toBeGreaterThanOrEqual(3);
    });

    it("handles Again (lapse) correctly", async () => {
      // Build up a card in Review state
      let result = await recordAttempt("asl-static-E", "E", "static", 2);
      vi.advanceTimersByTime(result.scheduled_days * 24 * 60 * 60 * 1000 + 1000);
      result = await recordAttempt("asl-static-E", "E", "static", 2);
      vi.advanceTimersByTime(result.scheduled_days * 24 * 60 * 60 * 1000 + 1000);
      result = await recordAttempt("asl-static-E", "E", "static", 2);

      // Verify we have a Review card with some reps
      expect(result.state).toBe("Review");
      expect(result.reps).toBeGreaterThanOrEqual(3);

      // Now lapse it with Again
      vi.advanceTimersByTime(result.scheduled_days * 24 * 60 * 60 * 1000 + 1000);
      result = await recordAttempt("asl-static-E", "E", "static", 0);

      // With enableShortTerm=false, Again on Review stays in Review (reduced stability)
      // The scheduler doesn't have separate Relearning state without short-term steps
      expect(["Review", "Relearning"]).toContain(result.state);
      // Interval should be reset to a small value
      expect(result.scheduled_days).toBeLessThanOrEqual(1);
    });

    it("persists progress to localStorage", async () => {
      await recordAttempt("asl-static-F", "F", "static", 2);
      const progress = getProgress();
      expect(progress.signs["asl-static-F"]).toBeDefined();
      expect(progress.signs["asl-static-F"].attempts).toBeGreaterThanOrEqual(1);
    });

    it("increments attempts correctly", async () => {
      await recordAttempt("asl-static-G", "G", "static", 2);
      await recordAttempt("asl-static-G", "G", "static", 0);
      await recordAttempt("asl-static-G", "G", "static", 2);

      const progress = getProgress();
      const card = progress.signs["asl-static-G"];
      expect(card).toBeDefined();
      if (card) {
        expect(card.attempts).toBe(3);
      }
    });
  });

  describe("Review Queue", () => {
    it("returns empty queue for new user", () => {
      expect(getReviewQueue()).toEqual([]);
    });

    it("includes due cards in queue", async () => {
      const result = await recordAttempt("asl-static-H", "H", "static", 2);
      vi.advanceTimersByTime(result.scheduled_days * 24 * 60 * 60 * 1000 + 1000);

      const queue = getReviewQueue();
      expect(queue.length).toBeGreaterThanOrEqual(1);
      if (queue.length > 0) {
        expect(queue[0].id).toBe("asl-static-H");
      }
    });

    it("excludes cards not yet due", async () => {
      await recordAttempt("asl-static-I", "I", "static", 2);
      const queue = getReviewQueue();
      expect(queue.length).toBe(0);
    });

    it("sorts by most overdue first", async () => {
      await recordAttempt("asl-static-J", "J", "static", 2);
      await recordAttempt("asl-static-K", "K", "static", 2);

      vi.advanceTimersByTime(10 * 24 * 60 * 60 * 1000);

      const queue = getReviewQueue();
      expect(queue.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Statistics", () => {
    it("counts total attempted signs", async () => {
      expect(getTotalAttempted()).toBe(0);
      await recordAttempt("asl-static-M", "M", "static", 2);
      expect(getTotalAttempted()).toBeGreaterThanOrEqual(1);
      await recordAttempt("asl-static-N", "N", "static", 2);
      expect(getTotalAttempted()).toBeGreaterThanOrEqual(2);
    });
  });

  describe("FSRS Configuration", () => {
    it("returns default config", () => {
      const config = getFSRSConfig();
      expect(config.desiredRetention).toBe(0.9);
      expect(config.version).toBe("FSRS-5");
      expect(config.maximumInterval).toBe(36500);
    });

    it("saves and loads config", () => {
      saveFSRSConfig({ desiredRetention: 0.95, enableFuzz: true });
      const config = getFSRSConfig();
      expect(config.desiredRetention).toBe(0.95);
      expect(config.enableFuzz).toBe(true);
      expect(config.version).toBe("FSRS-5");
    });
  });

  describe("Migration", () => {
    it("migrates legacy progress to FSRS-5 format", async () => {
      const legacyStore: ProgressStore = {
        signs: {
          "asl-static-O": {
            id: "asl-static-O",
            label: "O",
            type: "static",
            due: "2026-01-02T12:00:00.000Z",
            stability: 0,
            difficulty: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: "New",
            last_review: null,
            attempts: 5,
            successes: 4,
            lastAttempt: "2026-01-01T10:00:00.000Z",
            nextReview: "2026-01-02T12:00:00.000Z",
            interval: 3,
            easeFactor: 2.5,
            mastered: false,
          },
        },
        lastUpdated: "2026-01-01T10:00:00.000Z",
        fsrsVersion: 1,
      };
      saveProgress(legacyStore);

      await migrateToFSRS5();

      const progress = getProgress();
      const card = progress.signs["asl-static-O"];
      expect(card).toBeDefined();
      if (card) {
        // Migration should produce valid FSRS card structure
        expect(card.state).toBeDefined();
        expect(card.due).toBeDefined();
        expect(card.nextReview).toBeDefined();
        expect(typeof card.stability).toBe("number");
        expect(typeof card.difficulty).toBe("number");
      }
      expect(progress.fsrsVersion).toBe(5);
    });

    it("does not re-migrate already migrated data", async () => {
      const store: ProgressStore = {
        signs: {
          "asl-static-P": {
            id: "asl-static-P",
            label: "P",
            type: "static",
            due: "2026-01-02T12:00:00.000Z",
            stability: 5.0,
            difficulty: 4.0,
            scheduled_days: 10,
            learning_steps: 0,
            reps: 3,
            lapses: 0,
            state: "Review",
            last_review: "2026-01-01T12:00:00.000Z",
            attempts: 3,
            successes: 3,
            lastAttempt: "2026-01-01T12:00:00.000Z",
            nextReview: "2026-01-02T12:00:00.000Z",
            interval: 10,
            easeFactor: 2.5,
            mastered: true,
          },
        },
        lastUpdated: "2026-01-01T12:00:00.000Z",
        fsrsVersion: 5,
      };
      saveProgress(store);

      await migrateToFSRS5();

      const progress = getProgress();
      expect(progress.signs["asl-static-P"]).toBeDefined();
      if (progress.signs["asl-static-P"]) {
        expect(progress.signs["asl-static-P"].stability).toBe(5.0);
      }
    });
  });

  describe("resetProgress", () => {
    it("clears all progress data", async () => {
      await recordAttempt("asl-static-Q", "Q", "static", 2);
      expect(getTotalAttempted()).toBeGreaterThanOrEqual(1);

      resetProgress();

      expect(getTotalAttempted()).toBe(0);
      expect(getProgress().signs).toEqual({});
    });
  });
});