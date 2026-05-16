/**
 * PersonalAdapter -- on-device fine-tuning (W5)
 *
 * A tiny low-rank linear adapter over the Transformer encoder embedding.
 * Trained in-browser on confirmed attempts; state stored in localStorage.
 * Nothing leaves the device.
 *
 * Architecture:
 *   embedding (d_model) -> W (d_model x d_model, low-rank) -> bias -> logits_delta
 *   final_logits = base_logits + logits_delta
 *
 * Training: SGD on (embedding, label) pairs from confirmed attempts.
 * ~1 KB of state per user (d_model=64 -> 64*64 floats = 16 KB max, but
 * low-rank r=8 reduces to 64*8 + 8*n_classes floats).
 */

const STORAGE_KEY = "signtutor.adapter";
const MIN_ATTEMPTS_FOR_BADGE = 20;

export interface AdapterState {
  W_down: number[][];   // (d_model, rank)
  W_up: number[][];     // (rank, n_classes)
  bias: number[];       // (n_classes,)
  confirmedAttempts: number;
  lastUpdated: string;
  nClasses: number;
  dModel: number;
  rank: number;
}

export class PersonalAdapter {
  private W_down: Float32Array;  // (d_model * rank)
  private W_up: Float32Array;    // (rank * n_classes)
  private bias: Float32Array;    // (n_classes)
  private readonly dModel: number;
  private readonly nClasses: number;
  private readonly rank: number;
  private readonly lr: number;
  confirmedAttempts: number = 0;
  lastUpdated: string = "";

  constructor(dModel: number, nClasses: number, rank = 8, lr = 0.01) {
    this.dModel = dModel;
    this.nClasses = nClasses;
    this.rank = rank;
    this.lr = lr;
    this.W_down = new Float32Array(dModel * rank);
    this.W_up   = new Float32Array(rank * nClasses);
    this.bias   = new Float32Array(nClasses);
    // Xavier init
    const scale = Math.sqrt(2.0 / (dModel + rank));
    for (let i = 0; i < this.W_down.length; i++) this.W_down[i] = (Math.random() * 2 - 1) * scale;
    const scale2 = Math.sqrt(2.0 / (rank + nClasses));
    for (let i = 0; i < this.W_up.length; i++) this.W_up[i] = (Math.random() * 2 - 1) * scale2;
  }

  /** Forward pass: returns logits_delta (n_classes) */
  forward(embedding: Float32Array): Float32Array {
    // h = embedding @ W_down  (d_model -> rank)
    const h = new Float32Array(this.rank);
    for (let r = 0; r < this.rank; r++) {
      let sum = 0;
      for (let d = 0; d < this.dModel; d++) sum += embedding[d] * this.W_down[d * this.rank + r];
      h[r] = Math.max(0, sum); // ReLU
    }
    // out = h @ W_up + bias  (rank -> n_classes)
    const out = new Float32Array(this.nClasses);
    for (let c = 0; c < this.nClasses; c++) {
      let sum = this.bias[c];
      for (let r = 0; r < this.rank; r++) sum += h[r] * this.W_up[r * this.nClasses + c];
      out[c] = sum;
    }
    return out;
  }

  /** SGD update on a single (embedding, label) pair. */
  update(embedding: Float32Array, label: number): void {
    // Forward
    const h_pre = new Float32Array(this.rank);
    for (let r = 0; r < this.rank; r++) {
      let sum = 0;
      for (let d = 0; d < this.dModel; d++) sum += embedding[d] * this.W_down[d * this.rank + r];
      h_pre[r] = sum;
    }
    const h = h_pre.map(v => Math.max(0, v));
    const logits = this.forward(embedding);

    // Softmax + cross-entropy gradient
    const maxL = Math.max(...logits);
    const exps = logits.map(v => Math.exp(v - maxL));
    const sumE = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(e => e / sumE);
    const dL = probs.slice(); // copy
    dL[label] -= 1.0;         // gradient of cross-entropy

    // Backprop through W_up and bias
    for (let c = 0; c < this.nClasses; c++) {
      this.bias[c] -= this.lr * dL[c];
      for (let r = 0; r < this.rank; r++) {
        this.W_up[r * this.nClasses + c] -= this.lr * dL[c] * h[r];
      }
    }

    // Backprop through ReLU and W_down
    const dh = new Float32Array(this.rank);
    for (let r = 0; r < this.rank; r++) {
      for (let c = 0; c < this.nClasses; c++) dh[r] += dL[c] * this.W_up[r * this.nClasses + c];
      dh[r] *= h_pre[r] > 0 ? 1 : 0; // ReLU derivative
    }
    for (let d = 0; d < this.dModel; d++) {
      for (let r = 0; r < this.rank; r++) {
        this.W_down[d * this.rank + r] -= this.lr * dh[r] * embedding[d];
      }
    }

    this.confirmedAttempts++;
    this.lastUpdated = new Date().toISOString();
    this.save();
  }

  /** Apply adapter delta to base logits. */
  applyToLogits(baseLogits: Float32Array, embedding: Float32Array): Float32Array {
    const delta = this.forward(embedding);
    const out = new Float32Array(baseLogits.length);
    for (let i = 0; i < out.length; i++) out[i] = baseLogits[i] + delta[i];
    return out;
  }

  get isPersonalized(): boolean {
    return this.confirmedAttempts >= MIN_ATTEMPTS_FOR_BADGE;
  }

  save(): void {
    if (typeof globalThis.localStorage === "undefined") return;
    try {
      const state: AdapterState = {
        W_down: this._reshape2d(this.W_down, this.dModel, this.rank),
        W_up:   this._reshape2d(this.W_up,   this.rank,   this.nClasses),
        bias:   Array.from(this.bias),
        confirmedAttempts: this.confirmedAttempts,
        lastUpdated: this.lastUpdated,
        nClasses: this.nClasses,
        dModel: this.dModel,
        rank: this.rank,
      };
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  static load(dModel: number, nClasses: number, rank = 8, lr = 0.01): PersonalAdapter {
    const adapter = new PersonalAdapter(dModel, nClasses, rank, lr);
    if (typeof globalThis.localStorage === "undefined") return adapter;
    try {
      const raw = globalThis.localStorage.getItem(STORAGE_KEY);
      if (!raw) return adapter;
      const state: AdapterState = JSON.parse(raw);
      if (state.dModel !== dModel || state.nClasses !== nClasses || state.rank !== rank) {
        console.warn("[PersonalAdapter] stored state shape mismatch -- resetting");
        return adapter;
      }
      adapter.W_down = new Float32Array(state.W_down.flat());
      adapter.W_up   = new Float32Array(state.W_up.flat());
      adapter.bias   = new Float32Array(state.bias);
      adapter.confirmedAttempts = state.confirmedAttempts;
      adapter.lastUpdated = state.lastUpdated;
    } catch {}
    return adapter;
  }

  static reset(): void {
    if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.removeItem(STORAGE_KEY);
  }

  private _reshape2d(flat: Float32Array, rows: number, cols: number): number[][] {
    const out: number[][] = [];
    for (let r = 0; r < rows; r++) {
      out.push(Array.from(flat.slice(r * cols, (r + 1) * cols)));
    }
    return out;
  }
}