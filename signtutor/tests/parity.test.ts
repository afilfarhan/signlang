/**
 * JS <-> Python feature parity test.
 * Mirrors ci/run_parity.mjs but runs inside Vitest.
 * Verifies that the TypeScript normalize() function produces features
 * that match the Python reference output to 1e-3 tolerance.
 *
 * This is the same contract enforced by ci/check_nfr.py (parity gate).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { normalize } from "../lib/normalize";

const PARITY_PATH = join(__dirname, "../../prototype/models/parity_samples.json");
const TOL = 1e-3;

interface ParitySample {
  landmarks: number[][];
  expected_normalized_first6: number[];
  expected_normalized_l2: number;
}

describe("JS <-> Python feature parity (normalize)", () => {
  let parity: Record<string, ParitySample>;

  try {
    parity = JSON.parse(readFileSync(PARITY_PATH, "utf8"));
  } catch {
    it.skip("parity_samples.json not found — run ml pipeline first", () => {});
    parity = {};
  }

  const letters = Object.keys(parity);

  it(`has ${letters.length} parity samples`, () => {
    expect(letters.length).toBeGreaterThan(0);
  });

  for (const letter of letters) {
    it(`letter ${letter}: first-6 features within ${TOL} of Python`, () => {
      const sample = parity[letter];
      const lm = sample.landmarks.map((pt) => ({ x: pt[0], y: pt[1], z: pt[2] }));
      const feats = normalize(lm);

      let maxDrift = 0;
      for (let i = 0; i < 6; i++) {
        maxDrift = Math.max(maxDrift, Math.abs(feats[i] - sample.expected_normalized_first6[i]));
      }
      expect(maxDrift).toBeLessThan(TOL);
    });

    it(`letter ${letter}: L2 norm within ${TOL} of Python`, () => {
      const sample = parity[letter];
      const lm = sample.landmarks.map((pt) => ({ x: pt[0], y: pt[1], z: pt[2] }));
      const feats = normalize(lm);

      let l2 = 0;
      for (let i = 0; i < feats.length; i++) l2 += feats[i] * feats[i];
      l2 = Math.sqrt(l2);

      expect(Math.abs(l2 - sample.expected_normalized_l2)).toBeLessThan(TOL);
    });
  }

  it("5/5 samples within tolerance (CI gate equivalent)", () => {
    let pass = 0;
    for (const letter of letters) {
      const sample = parity[letter];
      const lm = sample.landmarks.map((pt) => ({ x: pt[0], y: pt[1], z: pt[2] }));
      const feats = normalize(lm);
      let maxDrift = 0;
      for (let i = 0; i < 6; i++) maxDrift = Math.max(maxDrift, Math.abs(feats[i] - sample.expected_normalized_first6[i]));
      let l2 = 0;
      for (let i = 0; i < feats.length; i++) l2 += feats[i] * feats[i];
      l2 = Math.sqrt(l2);
      if (maxDrift < TOL && Math.abs(l2 - sample.expected_normalized_l2) < TOL) pass++;
    }
    expect(pass).toBe(letters.length);
  });
});
