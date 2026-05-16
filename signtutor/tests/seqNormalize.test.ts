/**
 * Unit tests for normalizeSequence() — the dynamic-sign feature pipeline.
 */
import { describe, it, expect } from "vitest";
import { normalizeSequence } from "../lib/seqNormalize";

const T = 45;
const N = 21;

function makeFrame(offset = 0): Float32Array {
  const arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    arr[i * 3 + 0] = i * 0.05 + offset;
    arr[i * 3 + 1] = i * 0.03 + offset;
    arr[i * 3 + 2] = i * 0.01;
  }
  return arr;
}

function makeBuffer(t = T): Float32Array[] {
  return Array.from({ length: t }, (_, i) => makeFrame(i * 0.01));
}

describe("normalizeSequence()", () => {
  it("returns Float32Array of length T * 126", () => {
    const buf = makeBuffer();
    const out = normalizeSequence(buf);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(T * 126);
  });

  it("first-frame wrist is at origin after normalization", () => {
    const buf = makeBuffer();
    const out = normalizeSequence(buf);
    // Frame 0, landmark 0 (wrist), position component (first 63 floats of frame 0)
    expect(Math.abs(out[0])).toBeLessThan(1e-5); // x
    expect(Math.abs(out[1])).toBeLessThan(1e-5); // y
    expect(Math.abs(out[2])).toBeLessThan(1e-5); // z
  });

  it("first-frame velocity is zero", () => {
    const buf = makeBuffer();
    const out = normalizeSequence(buf);
    // Velocity component of frame 0 starts at index 63
    for (let j = 63; j < 126; j++) {
      expect(Math.abs(out[j])).toBeLessThan(1e-5);
    }
  });

  it("preserves trajectory (wrist moves across frames)", () => {
    const buf = makeBuffer();
    const out = normalizeSequence(buf);
    // Frame 1 wrist x should differ from frame 0 wrist x (trajectory preserved)
    const frame0WristX = out[0];
    const frame1WristX = out[126 + 0];
    // They should differ because the wrist moves
    expect(Math.abs(frame1WristX - frame0WristX)).toBeGreaterThan(0);
  });

  it("is translation-invariant (camera framing removed)", () => {
    const buf = makeBuffer();
    const shifted = buf.map((frame) => {
      const s = new Float32Array(frame.length);
      for (let i = 0; i < N; i++) {
        s[i * 3 + 0] = frame[i * 3 + 0] + 10;
        s[i * 3 + 1] = frame[i * 3 + 1] + 5;
        s[i * 3 + 2] = frame[i * 3 + 2] + 2;
      }
      return s;
    });
    const out1 = normalizeSequence(buf);
    const out2 = normalizeSequence(shifted);
    for (let i = 0; i < out1.length; i++) {
      expect(Math.abs(out1[i] - out2[i])).toBeLessThan(1e-4);
    }
  });

  it("handles degenerate case without NaN", () => {
    const buf = Array.from({ length: T }, () => new Float32Array(N * 3).fill(0.5));
    const out = normalizeSequence(buf);
    for (let i = 0; i < out.length; i++) {
      expect(isNaN(out[i])).toBe(false);
    }
  });
});
