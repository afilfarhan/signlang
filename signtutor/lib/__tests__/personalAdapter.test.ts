/**
 * PersonalAdapter unit tests (W5 gate)
 *
 * Gate requirement from BUILD_PROMPT_ML_EXTENSION.md:
 *   "Feed a fixed sequence of (embedding, label) pairs to PersonalAdapter,
 *    then assert top-1 on a held-out set improves by >= 5pp vs. unadapted baseline."
 *
 * Privacy gate:
 *   "A test that intercepts fetch/XHR during a full practice session asserts
 *    that no request body contains landmark tensors, embeddings, or adapter weights."
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PersonalAdapter } from "../personalAdapter";

const D_MODEL = 16;   // small for fast tests
const N_CLASSES = 4;
const RANK = 4;

function makeEmbedding(classIdx: number, noise = 0.1): Float32Array {
  // Embeddings that are linearly separable by class
  const emb = new Float32Array(D_MODEL);
  for (let i = 0; i < D_MODEL; i++) {
    emb[i] = (i === classIdx % D_MODEL ? 1.0 : 0.0) + (Math.random() - 0.5) * noise;
  }
  return emb;
}

function topK(logits: Float32Array, k = 1): number[] {
  return Array.from(logits)
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map((x) => x.i);
}

describe("PersonalAdapter", () => {
  it("initialises with zero-ish weights (no bias toward any class)", () => {
    const adapter = new PersonalAdapter(D_MODEL, N_CLASSES, RANK);
    const emb = new Float32Array(D_MODEL).fill(0.1);
    const delta = adapter.forward(emb);
    // All deltas should be small (near-zero init)
    for (const v of delta) {
      expect(Math.abs(v)).toBeLessThan(1.0);
    }
  });

  it("improves top-1 accuracy by >= 5pp after training on separable embeddings", () => {
    const adapter = new PersonalAdapter(D_MODEL, N_CLASSES, RANK, 0.05);

    // Generate training pairs: 40 examples per class
    const trainPairs: Array<[Float32Array, number]> = [];
    for (let c = 0; c < N_CLASSES; c++) {
      for (let i = 0; i < 40; i++) {
        trainPairs.push([makeEmbedding(c, 0.2), c]);
      }
    }
    // Shuffle
    trainPairs.sort(() => Math.random() - 0.5);

    // Baseline: unadapted accuracy on held-out set
    const heldOut: Array<[Float32Array, number]> = [];
    for (let c = 0; c < N_CLASSES; c++) {
      for (let i = 0; i < 10; i++) heldOut.push([makeEmbedding(c, 0.2), c]);
    }

    const baseLogits = new Float32Array(N_CLASSES).fill(0); // uniform baseline
    let baseCorrect = 0;
    for (const [emb, label] of heldOut) {
      const delta = adapter.forward(emb);
      const combined = baseLogits.map((v, i) => v + delta[i]) as unknown as Float32Array;
      if (topK(combined)[0] === label) baseCorrect++;
    }
    const baseAcc = baseCorrect / heldOut.length;

    // Train
    for (const [emb, label] of trainPairs) {
      adapter.update(emb, label);
    }

    // Post-training accuracy
    let trainedCorrect = 0;
    for (const [emb, label] of heldOut) {
      const delta = adapter.forward(emb);
      const combined = baseLogits.map((v, i) => v + delta[i]) as unknown as Float32Array;
      if (topK(combined)[0] === label) trainedCorrect++;
    }
    const trainedAcc = trainedCorrect / heldOut.length;

    // Gate: >= 5pp improvement
    expect(trainedAcc - baseAcc).toBeGreaterThanOrEqual(0.05);
    expect(trainedAcc).toBeGreaterThan(0.5); // sanity: better than random
  });

  it("confirmedAttempts increments on each update", () => {
    const adapter = new PersonalAdapter(D_MODEL, N_CLASSES, RANK);
    expect(adapter.confirmedAttempts).toBe(0);
    adapter.update(new Float32Array(D_MODEL).fill(0.1), 0);
    adapter.update(new Float32Array(D_MODEL).fill(0.1), 1);
    expect(adapter.confirmedAttempts).toBe(2);
  });

  it("isPersonalized is false below 20 attempts", () => {
    const adapter = new PersonalAdapter(D_MODEL, N_CLASSES, RANK);
    for (let i = 0; i < 19; i++) adapter.update(new Float32Array(D_MODEL).fill(0.1), 0);
    expect(adapter.isPersonalized).toBe(false);
    adapter.update(new Float32Array(D_MODEL).fill(0.1), 0);
    expect(adapter.isPersonalized).toBe(true);
  });

  it("save/load round-trips state correctly", () => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });

    const adapter = new PersonalAdapter(D_MODEL, N_CLASSES, RANK);
    const emb = new Float32Array(D_MODEL).fill(0.5);
    adapter.update(emb, 2);
    adapter.save();

    const loaded = PersonalAdapter.load(D_MODEL, N_CLASSES, RANK);
    expect(loaded.confirmedAttempts).toBe(1);

    // Forward pass should produce same output
    const out1 = adapter.forward(emb);
    const out2 = loaded.forward(emb);
    for (let i = 0; i < N_CLASSES; i++) {
      expect(Math.abs(out1[i] - out2[i])).toBeLessThan(1e-5);
    }

    vi.unstubAllGlobals();
  });

  it("reset clears localStorage", () => {
    const store: Record<string, string> = { "signtutor.adapter": '{"W_down":[],"W_up":[],"bias":[],"confirmedAttempts":5,"lastUpdated":"","nClasses":4,"dModel":16,"rank":4}' };
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });

    PersonalAdapter.reset();
    expect(store["signtutor.adapter"]).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe("PersonalAdapter privacy gate", () => {
  it("update() does not call fetch or XMLHttpRequest", () => {
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("XMLHttpRequest", xhrSpy);

    const adapter = new PersonalAdapter(D_MODEL, N_CLASSES, RANK);
    const emb = new Float32Array(D_MODEL).fill(0.3);
    adapter.update(emb, 1);
    adapter.update(emb, 2);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});