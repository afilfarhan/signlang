/**
 * Feature normalization — line-for-line mirror of ml/features.py
 *
 * Contract (enforced by CI parity test):
 *   Input : 21 landmarks as {x, y, z}[]
 *   Output: Float32Array(63), normalized by:
 *     1. Translate so wrist (landmark 0) is at origin
 *     2. Scale by wrist→middle-MCP distance (xy magnitude)
 *     3. Flatten to 63 floats
 *
 * DO NOT change this function without re-running the parity test:
 *   node ci/run_parity.mjs | tee ci/parity.log
 */

const WRIST = 0;
const MIDDLE_MCP = 9;

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/**
 * Normalize a single frame of 21 hand landmarks.
 * Mirrors ml/features.py normalize() exactly.
 */
export function normalize(landmarks: Landmark[]): Float32Array {
  const out = new Float32Array(21 * 3);

  // 1. Translate so wrist is at origin
  const wx = landmarks[WRIST].x;
  const wy = landmarks[WRIST].y;
  const wz = landmarks[WRIST].z ?? 0;

  for (let i = 0; i < 21; i++) {
    out[i * 3 + 0] = landmarks[i].x - wx;
    out[i * 3 + 1] = landmarks[i].y - wy;
    out[i * 3 + 2] = (landmarks[i].z ?? 0) - wz;
  }

  // 2. Scale by wrist→middle-MCP distance (xy only, same as Python)
  const mx = out[MIDDLE_MCP * 3 + 0];
  const my = out[MIDDLE_MCP * 3 + 1];
  let scale = Math.hypot(mx, my);
  if (scale < 1e-6) scale = 1.0;

  for (let i = 0; i < out.length; i++) {
    out[i] /= scale;
  }

  return out;
}
