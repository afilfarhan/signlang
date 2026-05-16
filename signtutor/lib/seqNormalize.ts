/**
 * Sequence-level feature normalization — mirror of ml/seq_features.py
 *
 * Key design decision (from ml/seq_features.py comments):
 * We normalize the *entire sequence as a whole*, not each frame independently.
 * Per-frame translation would destroy the global trajectory — but trajectory
 * is exactly what distinguishes HELLO from THANKS from PLEASE.
 *
 * Pipeline (applied identically in Python at training time and here at inference):
 *   1. Compute hand scale once from the first frame (wrist→middle-MCP distance).
 *   2. Translate every frame by the *first-frame wrist* position.
 *      Camera framing is removed, but relative trajectory is kept.
 *   3. Divide every frame by the same hand scale.
 *   4. Append per-frame velocity (delta vs. previous frame).
 *
 * Final feature vector per frame: 21*3 (positions) + 21*3 (velocities) = 126 floats.
 * Sequence shape into the model: (T, 126), with T=45.
 *
 * DO NOT change this without reading ml/ROBUSTNESS_GATE_DEMO.md
 */

const WRIST = 0;
const MIDDLE_MCP = 9;
const N_LANDMARKS = 21;
const FEATURE_DIM = N_LANDMARKS * 3 * 2; // 126

/**
 * Normalize a sequence of T frames.
 * @param buf Array of T Float32Array(21*3) — raw landmark frames
 * @returns Float32Array(T * 126)
 */
export function normalizeSequence(buf: Float32Array[]): Float32Array {
  const T = buf.length;
  const pos = new Float32Array(T * N_LANDMARKS * 3);

  // Anchor = first-frame wrist position
  const anchor_x = buf[0][WRIST * 3 + 0];
  const anchor_y = buf[0][WRIST * 3 + 1];
  const anchor_z = buf[0][WRIST * 3 + 2];

  // 1 & 2: Translate every frame by first-frame wrist
  for (let t = 0; t < T; t++) {
    for (let j = 0; j < N_LANDMARKS; j++) {
      pos[(t * N_LANDMARKS + j) * 3 + 0] = buf[t][j * 3 + 0] - anchor_x;
      pos[(t * N_LANDMARKS + j) * 3 + 1] = buf[t][j * 3 + 1] - anchor_y;
      pos[(t * N_LANDMARKS + j) * 3 + 2] = buf[t][j * 3 + 2] - anchor_z;
    }
  }

  // 3. Scale from first frame's wrist→middle-MCP distance (xy)
  const mx = pos[(0 * N_LANDMARKS + MIDDLE_MCP) * 3 + 0];
  const my = pos[(0 * N_LANDMARKS + MIDDLE_MCP) * 3 + 1];
  let scale = Math.hypot(mx, my);
  if (scale < 1e-6) scale = 1.0;
  for (let i = 0; i < pos.length; i++) pos[i] /= scale;

  // 4. Velocities
  const out = new Float32Array(T * FEATURE_DIM);
  for (let t = 0; t < T; t++) {
    for (let j = 0; j < N_LANDMARKS * 3; j++) {
      // Position component
      out[t * FEATURE_DIM + j] = pos[t * N_LANDMARKS * 3 + j];
      // Velocity component (0 for first frame)
      const v =
        t === 0
          ? 0
          : pos[t * N_LANDMARKS * 3 + j] - pos[(t - 1) * N_LANDMARKS * 3 + j];
      out[t * FEATURE_DIM + N_LANDMARKS * 3 + j] = v;
    }
  }

  return out;
}

export { FEATURE_DIM, N_LANDMARKS };
