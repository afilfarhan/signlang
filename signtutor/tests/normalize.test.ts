/**
 * Unit tests for normalize() — the core feature extraction function.
 * These properties must hold for the model to work correctly.
 */
import { describe, it, expect } from "vitest";
import { normalize } from "../lib/normalize";

function makeLandmarks(n = 21) {
  return Array.from({ length: n }, (_, i) => ({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: Math.random() * 0.2 - 0.1,
  }));
}

describe("normalize()", () => {
  it("returns Float32Array of length 63", () => {
    const lm = makeLandmarks();
    const out = normalize(lm);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(63);
  });

  it("wrist (landmark 0) is at origin after normalization", () => {
    const lm = makeLandmarks();
    const out = normalize(lm);
    expect(Math.abs(out[0])).toBeLessThan(1e-6); // x
    expect(Math.abs(out[1])).toBeLessThan(1e-6); // y
    expect(Math.abs(out[2])).toBeLessThan(1e-6); // z
  });

  it("middle-MCP (landmark 9) has unit xy distance from origin", () => {
    const lm = makeLandmarks();
    const out = normalize(lm);
    const mx = out[9 * 3 + 0];
    const my = out[9 * 3 + 1];
    const dist = Math.hypot(mx, my);
    expect(Math.abs(dist - 1.0)).toBeLessThan(1e-5);
  });

  it("is translation-invariant (shifting all landmarks gives same output)", () => {
    const lm = makeLandmarks();
    const shifted = lm.map((p) => ({ x: p.x + 5, y: p.y + 3, z: p.z + 1 }));
    const out1 = normalize(lm);
    const out2 = normalize(shifted);
    for (let i = 0; i < 63; i++) {
      expect(Math.abs(out1[i] - out2[i])).toBeLessThan(1e-5);
    }
  });

  it("is scale-invariant (scaling all landmarks gives same output)", () => {
    const lm = makeLandmarks();
    const scaled = lm.map((p) => ({ x: p.x * 3, y: p.y * 3, z: p.z * 3 }));
    const out1 = normalize(lm);
    const out2 = normalize(scaled);
    for (let i = 0; i < 63; i++) {
      expect(Math.abs(out1[i] - out2[i])).toBeLessThan(1e-5);
    }
  });

  it("handles degenerate case (all landmarks at same point) without NaN", () => {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    const out = normalize(lm);
    for (let i = 0; i < 63; i++) {
      expect(isNaN(out[i])).toBe(false);
      expect(isFinite(out[i])).toBe(true);
    }
  });
});
