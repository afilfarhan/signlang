/**
 * Shared MediaPipe + ONNX Runtime Web ambient type declarations.
 * Loaded via CDN scripts in layout.tsx.
 */

export interface OrtSession {
  run(inputs: Record<string, unknown>): Promise<Record<string, { data: Float32Array }>>;
}

export interface OrtTensor {
  data: Float32Array;
}

export interface MediaPipeHandsInstance {
  setOptions(opts: object): void;
  onResults(cb: (results: { multiHandLandmarks?: Array<Array<{ x: number; y: number; z: number }>> }) => void): void;
  send(input: { image: HTMLVideoElement }): Promise<void>;
}

declare global {
  interface Window {
    Hands: { new(c: { locateFile: (f: string) => string }): MediaPipeHandsInstance };
    Camera: { new(v: HTMLVideoElement, c: { onFrame: () => Promise<void>; width: number; height: number }): { start(): void; stop(): void } };
    drawConnectors(ctx: CanvasRenderingContext2D, lm: unknown[], conn: unknown, s: object): void;
    drawLandmarks(ctx: CanvasRenderingContext2D, lm: unknown[], s: object): void;
    HAND_CONNECTIONS: unknown[];
    ort: {
      InferenceSession: { create(path: string, opts: object): Promise<OrtSession> };
      Tensor: { new(type: string, data: Float32Array, dims: number[]): OrtTensor };
    };
  }
}

export {};