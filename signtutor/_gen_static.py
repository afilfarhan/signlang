import pathlib

STATIC = r"""
"use client";
/**
 * Static-sign lesson player (PDR S-05)
 * Pipeline: getUserMedia -> MediaPipe Hands -> normalize() -> ONNX MLP -> verdict + per-finger panel
 * Architectural decisions 1,2,3,7,8 preserved.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { normalize } from "@/lib/normalize";
import { STATIC_LETTERS, LETTER_DESCRIPTIONS, PATTERNS, inSameGroup } from "@/lib/curriculum";
import { fingerStates, classifyRule, palmFacingCamera, locationLabel, chooseTip } from "@/lib/fingerStates";
import type { FingerStates, RankedResult } from "@/lib/fingerStates";
import { getPrefs, recordAttempt } from "@/lib/progress";

type ClassifierMode = "ml" | "rule";
type VerdictType = "match" | "close" | "miss" | null;
interface ComponentScores { shape: number; orient: number; loc: number; move: number; }

interface OrtSession {
  run: (inputs: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
}

declare global {
  interface Window {
    Hands: new (c: { locateFile: (f: string) => string }) => {
      setOptions(o: object): void;
      onResults(cb: (r: { multiHandLandmarks?: Array<Array<{ x: number; y: number; z: number }>> }) => void): void;
      send(i: { image: HTMLVideoElement }): Promise<void>;
    };
    Camera: new (v: HTMLVideoElement, c: { onFrame: () => Promise<void>; width: number; height: number }) => { start(): void; stop(): void };
    drawConnectors(ctx: CanvasRenderingContext2D, lm: unknown[], conn: unknown, s: object): void;
    drawLandmarks(ctx: CanvasRenderingContext2D, lm: unknown[], s: object): void;
    HAND_CONNECTIONS: unknown[];
    ort: {
      InferenceSession: { create(path: string, opts: object): Promise<OrtSession> };
      Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
    };
  }
}
"""
pathlib.Path("signtutor/components/StaticSignPlayer.tsx").write_text(STATIC.lstrip(), encoding="utf-8")
print("header ok")
