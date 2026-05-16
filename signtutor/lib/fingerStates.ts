/**
 * Rule-based finger state detection.
 * Used for:
 *   1. Per-finger panel (interpretability) — always runs even in ML mode
 *   2. Fallback classifier when ONNX model fails to load
 *   3. Actionable tip generation ("Try extending your thumb")
 *
 * This is the rule layer from prototype/index.html, extracted for reuse.
 */

import type { Landmark } from "./normalize";
import { PATTERNS, type FingerPattern, inSameGroup, LETTER_DESCRIPTIONS } from "./curriculum";

// Landmark indices
const FT  = { THUMB: 4, INDEX: 8, MIDDLE: 12, RING: 16, PINKY: 20 };
const PIP = { THUMB: 3, INDEX: 6, MIDDLE: 10, RING: 14, PINKY: 18 };
const MCP = { THUMB: 2, INDEX: 5, MIDDLE: 9,  RING: 13, PINKY: 17 };

function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(dx, dy, dz);
}

function fingerExtended(lm: Landmark[], tip: number, pip: number, mcp: number): boolean {
  const w = lm[0];
  return (
    dist(lm[tip], w) > dist(lm[pip], w) * 1.05 &&
    dist(lm[tip], w) > dist(lm[mcp], w) * 1.10
  );
}

function thumbExtended(lm: Landmark[]): boolean {
  return dist(lm[FT.THUMB], lm[0]) > dist(lm[PIP.THUMB], lm[0]) * 1.05;
}

export interface FingerStates {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export function fingerStates(lm: Landmark[]): FingerStates {
  return {
    thumb:  thumbExtended(lm),
    index:  fingerExtended(lm, FT.INDEX,  PIP.INDEX,  MCP.INDEX),
    middle: fingerExtended(lm, FT.MIDDLE, PIP.MIDDLE, MCP.MIDDLE),
    ring:   fingerExtended(lm, FT.RING,   PIP.RING,   MCP.RING),
    pinky:  fingerExtended(lm, FT.PINKY,  PIP.PINKY,  MCP.PINKY),
  };
}

function scoreLetterRule(states: FingerStates, target: string): number {
  const ref = PATTERNS[target];
  if (!ref) return 0;
  let agree = 0;
  const keys = Object.keys(ref) as (keyof FingerPattern)[];
  for (const k of keys) {
    if (ref[k] === states[k]) agree++;
  }
  return agree / keys.length;
}

export interface RankedResult {
  label: string;
  prob: number;
}

export function classifyRule(lm: Landmark[]): { ranked: RankedResult[]; states: FingerStates } {
  const states = fingerStates(lm);
  const ranked = Object.keys(PATTERNS)
    .map((letter) => ({ label: letter, prob: scoreLetterRule(states, letter) }))
    .sort((a, b) => b.prob - a.prob);
  return { ranked, states };
}

export interface PalmOrientation {
  facing: boolean;
  magnitude: number;
}

export function palmFacingCamera(lm: Landmark[]): PalmOrientation {
  const a = lm[5], b = lm[17], w = lm[0];
  const v1 = { x: a.x - w.x, y: a.y - w.y };
  const v2 = { x: b.x - w.x, y: b.y - w.y };
  const nz = v1.x * v2.y - v1.y * v2.x;
  return { facing: nz < 0, magnitude: Math.abs(nz) };
}

export function locationLabel(lm: Landmark[]): string {
  const w = lm[0];
  if (w.y < 0.33) return "upper";
  if (w.y < 0.66) return "middle (neutral signing space)";
  return "lower";
}

export function chooseTip(
  components: { shape: number; orient: number; loc: number; move: number },
  top: RankedResult,
  target: string,
  orient: PalmOrientation,
  ruleStates: FingerStates
): string {
  // 1. Match — congratulate
  if (top.label === target && components.shape >= 0.75 && components.orient > 0.5 && components.move > 0.5) {
    return `<b>Nice — that looks like "${target}".</b> Hold it for a beat to confirm.`;
  }
  // 2. Same-group neighbour
  if (top.label !== target && inSameGroup(top.label, target) && top.prob > 0.4) {
    return `Reads as <b>"${top.label}"</b>, which is the same handshape family as "${target}" in this model. With finger-curvature cues these are distinct — for now, hold the sign confidently.`;
  }
  // 3. Different letter with high confidence
  if (top.label !== target && top.prob > 0.6) {
    const desc = LETTER_DESCRIPTIONS[target] ?? "";
    return `Looks closer to <b>"${top.label}"</b>. For "${target}": ${desc.toLowerCase()}`;
  }
  // 4. Weak shape — use rule layer for finger-level tip
  if (components.shape < 0.5) {
    const ref = PATTERNS[target];
    if (ref) {
      for (const finger of ["thumb", "index", "middle", "ring", "pinky"] as (keyof FingerStates)[]) {
        if (ref[finger] !== ruleStates[finger]) {
          return ref[finger]
            ? `Try <b>extending your ${finger}</b> for "${target}".`
            : `Try <b>curling your ${finger}</b> in for "${target}".`;
        }
      }
    }
    return `Adjust your handshape to match "${target}".`;
  }
  // 5. Non-shape component is weakest
  const ranked = [
    ["orient", components.orient] as const,
    ["loc",    components.loc]    as const,
    ["move",   components.move]   as const,
  ].sort((a, b) => a[1] - b[1]);
  const [worstKey, worstVal] = ranked[0];
  if (worstVal > 0.7) return `Almost — keep going.`;
  if (worstKey === "orient") return `Rotate your <b>palm toward the camera</b>.`;
  if (worstKey === "loc")    return `Bring your hand into the <b>neutral signing space</b> in front of your chest.`;
  if (worstKey === "move")   return `<b>Hold the sign still</b> — fingerspelling letters are static.`;
  return `Keep going.`;
}
