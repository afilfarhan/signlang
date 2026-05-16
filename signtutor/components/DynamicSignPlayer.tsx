"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { normalizeSequence } from "@/lib/seqNormalize";
import { DYNAMIC_SIGNS, DYNAMIC_LABELS } from "@/lib/curriculum";
import { getPrefs, recordAttempt } from "@/lib/progress";

const T_FRAMES = 45;
const N_LANDMARKS = 21;
const FEATURE_DIM = N_LANDMARKS * 3 * 2;

type VerdictType = "match" | "close" | "miss" | null;
interface RankedResult { label: string; prob: number; }
import type { OrtSession, MediaPipeHandsInstance } from "@/lib/mediapipe.d";

export default function DynamicSignPlayer({ initialSign }: { initialSign: string }) {
  const [target, setTarget] = useState(initialSign);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [modelStatus, setModelStatus] = useState("loading...");
  const [bufLen, setBufLen] = useState(0);
  const [detected, setDetected] = useState("--");
  const [confidence, setConfidence] = useState(0);
  const [verdict, setVerdict] = useState<VerdictType>(null);
  const [ranked, setRanked] = useState<RankedResult[]>([]);
  const [tip, setTip] = useState("Click <b>Start camera</b>, pick a target sign, then click <b>Record attempt</b>.");
  const [handDetected, setHandDetected] = useState(false);
  const [fps, setFps] = useState(0);
  const [inferMs, setInferMs] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState<Array<{ msg: string; cls: string }>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<OrtSession | null>(null);
  const labelsRef = useRef<string[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<{ stop(): void } | null>(null);
  const handsRef = useRef<MediaPipeHandsInstance | null>(null);
  const bufferRef = useRef<Float32Array[]>([]);
  const fpsRef = useRef({ frames: 0, t0: performance.now() });
  const framesSinceInferRef = useRef(0);
  const recordingRef = useRef(false);
  const continuousRef = useRef(false);
  const targetRef = useRef(initialSign);

  const addLog = useCallback((msg: string, cls = "") => {
    setLogs(prev => [...prev.slice(-50), { msg: "[" + new Date().toLocaleTimeString() + "] " + msg, cls }]);
  }, []);

  useEffect(() => { const p = getPrefs(); setMirror(p.mirror); }, []);
  useEffect(() => { if (typeof window !== "undefined") setShowDebug(new URLSearchParams(window.location.search).get("debug") === "1"); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadModel(); }, []);

  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);
  useEffect(() => { targetRef.current = target; }, [target]);

  const loadModel = useCallback(async () => {
    if (typeof window === "undefined" || !window.ort) { setModelStatus("ort.js unavailable"); addLog("onnxruntime-web not loaded.", "err"); return; }
    try {
      const session = await window.ort.InferenceSession.create("/models/dynamic_signs_transformer.onnx", { executionProviders: ["wasm"] });
      const meta = await fetch("/models/dynamic_labels.json").then(r => r.json());
      sessionRef.current = session; labelsRef.current = meta.labels;
      setModelStatus("Transformer " + meta.labels.length + " signs seq=" + meta.seq_len);
      addLog("Loaded ONNX Transformer (" + meta.labels.length + " classes)", "ok");
    } catch (e: unknown) { setModelStatus("failed to load"); addLog("Failed: " + (e instanceof Error ? e.message : String(e)), "err"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);
  const startCamera = useCallback(async () => {
    if (running) return;
    if (!window.Hands) { addLog("MediaPipe Hands not available.", "err"); return; }
    const hands = new window.Hands({ locateFile: f => "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/" + f });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
    hands.onResults(onResults);
    handsRef.current = hands;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      streamRef.current = stream;
    } catch (e: unknown) { addLog("Camera unavailable: " + (e instanceof Error ? e.message : String(e)), "err"); return; }
    const video = videoRef.current!;
    video.srcObject = streamRef.current; await video.play();
    if (overlayRef.current) { overlayRef.current.width = video.videoWidth || 640; overlayRef.current.height = video.videoHeight || 480; }
    const cam = new window.Camera(video, { onFrame: async () => { await handsRef.current!.send({ image: video }); }, width: 640, height: 480 });
    cam.start(); cameraRef.current = cam; setRunning(true);
    addLog("Camera started on-device", "ok");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, addLog]);

  const stopCamera = useCallback(() => {
    if (!running) return;
    try { cameraRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    setRunning(false); setHandDetected(false); addLog("Camera stopped");
  }, [running, addLog]);

  const startRecording = useCallback(() => {
    bufferRef.current = []; setBufLen(0); setRecording(true);
    setTip("Recording <b>" + targetRef.current + "</b>... perform the sign now.");
  }, []);

  const onResults = useCallback((results: { multiHandLandmarks?: Array<Array<{ x: number; y: number; z: number }>> }) => {
    const lmRaw = results.multiHandLandmarks?.[0] ?? null;
    const ctx = overlayRef.current?.getContext("2d");
    if (ctx && overlayRef.current) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    if (lmRaw) {
      setHandDetected(true);
      if (ctx && window.drawConnectors && window.HAND_CONNECTIONS) {
        window.drawConnectors(ctx, lmRaw, window.HAND_CONNECTIONS, { color: "#7c9cff", lineWidth: 3 });
        window.drawLandmarks(ctx, lmRaw, { color: "#5ee0c1", lineWidth: 1, radius: 3 });
      }
      pushFrame(lmRaw);
    } else { setHandDetected(false); }
    const fc = fpsRef.current; fc.frames++;
    const now = performance.now();
    if (now - fc.t0 > 1000) { setFps(Math.round(fc.frames * 1000 / (now - fc.t0))); fc.frames = 0; fc.t0 = now; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushFrame = useCallback((lmRaw: Array<{ x: number; y: number; z: number }>) => {
    const arr = new Float32Array(N_LANDMARKS * 3);
    for (let i = 0; i < N_LANDMARKS; i++) { arr[i*3] = lmRaw[i].x; arr[i*3+1] = lmRaw[i].y; arr[i*3+2] = lmRaw[i].z || 0; }
    bufferRef.current.push(arr);
    if (bufferRef.current.length > T_FRAMES) bufferRef.current.shift();
    setBufLen(bufferRef.current.length);
    framesSinceInferRef.current++;
    if (recordingRef.current && bufferRef.current.length >= T_FRAMES) {
      runInference().finally(() => setRecording(false));
    } else if (continuousRef.current && bufferRef.current.length >= T_FRAMES && framesSinceInferRef.current >= 10) {
      framesSinceInferRef.current = 0; runInference();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runInference = useCallback(async () => {
    if (!sessionRef.current) return;
    const t0 = performance.now();
    const flat = normalizeSequence(bufferRef.current);
    const tensor = new window.ort.Tensor("float32", flat, [1, T_FRAMES, FEATURE_DIM]);
    const out = await sessionRef.current.run({ input: tensor });
    const logits = out.logits.data;
    const max = Math.max(...logits);
    const exps = Array.from(logits, v => Math.exp(v - max));
    const sumE = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(e => e / sumE);
    const rankedResult = probs.map((prob, i) => ({ label: labelsRef.current[i], prob })).sort((a, b) => b.prob - a.prob);
    setInferMs(performance.now() - t0);
    renderResult(rankedResult);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderResult = useCallback((rankedResult: RankedResult[]) => {
    const top = rankedResult[0];
    const tgt = targetRef.current;
    setDetected(top.label); setConfidence(top.prob); setRanked(rankedResult);
    let v: VerdictType;
    if (top.prob < 0.50) v = "miss";
    else if (top.label === tgt && top.prob >= 0.75) v = "match";
    else v = "close";
    setVerdict(v);
    if (v === "match") recordAttempt("asl-dynamic-" + tgt, tgt, "dynamic", 2);
    else if (v === "close") recordAttempt("asl-dynamic-" + tgt, tgt, "dynamic", 1);
    let tipText: string;
    if (v === "match") tipText = "<b>Nice - that is " + tgt + ".</b> Try once more to confirm.";
    else if (v === "miss") tipText = "Couldn't read your sign clearly - try again with the hand fully in frame.";
    else if (top.label === tgt) tipText = "Looks like " + tgt + " but confidence is only " + (top.prob * 100 | 0) + "%. Slow down and exaggerate the motion.";
    else tipText = "That came out closer to <b>" + top.label + "</b>. Re-watch the demo: <i>" + DYNAMIC_SIGNS[tgt] + "</i>";
    setTip(tipText);
  }, []);
  const vBg = verdict === "match" ? "rgba(94,224,193,.10)" : verdict === "close" ? "rgba(255,184,107,.10)" : verdict === "miss" ? "rgba(255,122,144,.10)" : "rgba(124,156,255,.06)";
  const vBorder = verdict === "match" ? "rgba(94,224,193,.45)" : verdict === "close" ? "rgba(255,184,107,.45)" : verdict === "miss" ? "rgba(255,122,144,.45)" : "var(--line)";
  const vColor = verdict === "match" ? "var(--ok)" : verdict === "close" ? "var(--warn)" : verdict === "miss" ? "var(--bad)" : "var(--ink)";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,#0d1430,#0b1020)", position: "sticky", top: 0, zIndex: 5, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>SignTutor <small style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>Dynamic signs Transformer</small></h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="badge">{modelStatus}</span>
          {showDebug && <span className="badge">{fps}fps {inferMs.toFixed(0)}ms</span>}
          <span className="badge badge-ok" aria-label="On-device privacy guarantee">&#x1F512; On-device</span>
        </div>
      </header>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--panel)", marginBottom: 16 }}>
          <Link href="/learn/asl/words" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>&#8592; All signs</Link>
          <span style={{ color: "var(--line)" }}>|</span>
          <button onClick={startCamera} disabled={running} style={{ background: "var(--accent)", color: "#0a0f24", border: "none", padding: "8px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.5 : 1 }}>Start camera</button>
          <button onClick={startRecording} disabled={!running || recording || continuous} style={{ background: "var(--panel2)", color: recording ? "var(--bad)" : "var(--ink)", border: "1px solid var(--line)", padding: "8px 14px", borderRadius: 8, fontSize: 14, cursor: (!running || recording || continuous) ? "not-allowed" : "pointer", opacity: (!running || recording || continuous) ? 0.5 : 1 }}>
            {recording ? "Recording..." : "Record attempt (1.5s)"}
          </button>
          <button onClick={stopCamera} disabled={!running} style={{ background: "var(--panel2)", color: "var(--ink)", border: "1px solid var(--line)", padding: "8px 14px", borderRadius: 8, fontSize: 14, cursor: !running ? "not-allowed" : "pointer", opacity: !running ? 0.5 : 1 }}>Stop</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={continuous} onChange={e => setContinuous(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
              Continuous mode
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
              Mirror
            </label>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Demo pane */}
          <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }} aria-labelledby="demo-dyn-heading">
            <div style={{ padding: "12px 14px", fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
              <span id="demo-dyn-heading">Target sign mock demo</span>
              <span style={{ background: "rgba(11,16,32,.75)", padding: "4px 10px", borderRadius: 999, fontSize: 12, border: "1px solid var(--line)" }}>Target: {target}</span>
            </div>
            <div style={{ position: "relative", aspectRatio: "4/3", background: "radial-gradient(ellipse at center,#1a2350 0%,#0b1020 70%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,var(--accent2),transparent 70%)", opacity: 0.45, animation: "pulse 1.6s ease-in-out infinite" }} aria-hidden="true" />
              <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: ".05em", textShadow: "0 4px 20px rgba(124,156,255,.4)", position: "absolute" }} aria-label={"Demo of sign " + target}>{target}</div>
              <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, fontSize: 13, color: "var(--muted)", background: "rgba(11,16,32,.7)", padding: "8px 12px", borderRadius: 8, textAlign: "center" }}>{DYNAMIC_SIGNS[target]}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 14px" }} role="group" aria-label="Select target sign">
              {DYNAMIC_LABELS.map(s => (
                <button key={s} onClick={() => setTarget(s)} aria-pressed={s === target} aria-label={"Practice sign " + s}
                  style={{ padding: "6px 10px", fontSize: 13, background: s === target ? "var(--accent)" : "var(--panel2)", color: s === target ? "#0a0f24" : "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer", fontWeight: s === target ? 600 : 400 }}>
                  {s}
                </button>
              ))}
            </div>
          </section>
          {/* Webcam pane */}
          <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }} aria-labelledby="webcam-dyn-heading">
            <div style={{ padding: "12px 14px", fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
              <span id="webcam-dyn-heading">Your attempt</span>
              {showDebug && <span style={{ background: "rgba(11,16,32,.75)", padding: "4px 10px", borderRadius: 999, fontSize: 12, border: "1px solid var(--line)" }}>{inferMs.toFixed(0)}ms</span>}
            </div>
            <div style={{ position: "relative", aspectRatio: "4/3", background: "#000" }}>
              <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: mirror ? "scaleX(-1)" : "none" }} aria-label="Your webcam feed" />
              <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: mirror ? "scaleX(-1)" : "none" }} aria-hidden="true" />
              <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", gap: 8, pointerEvents: "none" }}>
                <span style={{ background: "rgba(11,16,32,.75)", padding: "4px 10px", borderRadius: 999, fontSize: 12, border: "1px solid var(--line)" }} aria-live="polite">{handDetected ? "Hand detected" : "No hand"}</span>
                <span style={{ background: "rgba(11,16,32,.75)", padding: "4px 10px", borderRadius: 999, fontSize: 12, border: "1px solid var(--line)" }} aria-live="polite">Buffer: {bufLen}/{T_FRAMES}</span>
              </div>
            </div>
            <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Recording window</span>
              <progress value={bufLen} max={T_FRAMES} style={{ flex: 1, height: 8, accentColor: "var(--accent2)" }} aria-label={"Buffer: " + bufLen + " of " + T_FRAMES + " frames"} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{bufLen}/{T_FRAMES}</span>
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 10, border: "1px solid " + vBorder, background: vBg }} role="status" aria-live="polite">
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>Top prediction</div>
                  <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, marginTop: 2, color: vColor }}>{detected}</div>
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "right" }}>
                  confidence<strong style={{ display: "block", fontSize: 22, color: "var(--ink)", marginTop: 2 }}>{confidence > 0 ? (confidence * 100).toFixed(0) + "%" : "--"}</strong>
                </div>
              </div>
              {ranked.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }} aria-label="Top 5 predictions">
                  {ranked.slice(0, 5).map((r, i) => (
                    <div key={r.label} style={{ display: "grid", gridTemplateColumns: "80px 1fr 50px", gap: 8, alignItems: "center", fontSize: 13 }}>
                      <div style={{ fontWeight: i === 0 ? 700 : 400 }}>{r.label}</div>
                      <div style={{ height: 8, background: "var(--line)", borderRadius: 999, overflow: "hidden" }} role="progressbar" aria-valuenow={Math.round(r.prob * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={r.label + ": " + Math.round(r.prob * 100) + "%"}>
                        <div style={{ height: "100%", width: (r.prob * 100).toFixed(0) + "%", background: i === 0 ? "var(--accent2)" : "var(--accent)", transition: "width .2s" }} />
                      </div>
                      <div style={{ color: "var(--muted)", textAlign: "right" }}>{(r.prob * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: 12, border: "1px dashed var(--line)", borderRadius: 10, background: "rgba(124,156,255,.04)", fontSize: 14 }} aria-live="polite" dangerouslySetInnerHTML={{ __html: tip }} />
            </div>
            {showDebug && (
              <div style={{ maxHeight: 120, overflow: "auto", fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, color: "var(--muted)", padding: "10px 14px", borderTop: "1px solid var(--line)", background: "var(--panel2)" }} role="log" aria-label="Debug log">
                {logs.map((l, i) => <div key={i} style={{ margin: "2px 0", color: l.cls === "err" ? "var(--bad)" : l.cls === "ok" ? "var(--ok)" : l.cls === "warn" ? "var(--warn)" : "var(--muted)" }}>{l.msg}</div>)}
              </div>
            )}
          </section>
        </div>
        <div style={{ marginTop: 18, padding: 14, border: "1px solid var(--line)", borderRadius: 12, background: "var(--panel)", color: "var(--muted)", fontSize: 13 }}>
          <strong style={{ color: "var(--ink)" }}>Architecture (PDR 7.1 S-06):</strong> webcam MediaPipe Hands 45-frame buffer normalizeSequence() anchors on first frame to preserve trajectory ONNX Transformer 360KB top-5 confidence-gated verdict. All on-device.
          {!showDebug && <span> <button onClick={() => setShowDebug(true)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, padding: 0 }}>Show debug HUD</button></span>}
        </div>
      </main>
    </div>
  );
}