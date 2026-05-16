"use client";
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
import type { OrtSession, MediaPipeHandsInstance } from "@/lib/mediapipe.d";
export default function StaticSignPlayer({ initialLetter }: { initialLetter: string }) {
  const [target, setTarget] = useState(initialLetter);
  const [mode, setMode] = useState<ClassifierMode>("ml");
  const [modelReady, setModelReady] = useState(false);
  const [modelStatus, setModelStatus] = useState("loading...");
  const [mirror, setMirror] = useState(true);
  const [leftHanded, setLeftHanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [detected, setDetected] = useState("--");
  const [confidence, setConfidence] = useState(0);
  const [verdict, setVerdict] = useState<VerdictType>(null);
  const [ranked, setRanked] = useState<RankedResult[]>([]);
  const [components, setComponents] = useState<ComponentScores | null>(null);
  const [fingers, setFingers] = useState<FingerStates | null>(null);
  const [tip, setTip] = useState("Click <b>Start camera</b> and choose a target letter to begin.");
  const [handDetected, setHandDetected] = useState(false);
  const [fps, setFps] = useState(0);
  const [mpLatency, setMpLatency] = useState(0);
  const [clfLatency, setClfLatency] = useState(0);
  const [logs, setLogs] = useState<Array<{ msg: string; cls: string }>>([]);
  const [fallbackActive, setFallbackActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<OrtSession | null>(null);
  const labelsRef = useRef<string[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<{ stop(): void } | null>(null);
  const handsRef = useRef<MediaPipeHandsInstance | null>(null);
  const moveBufRef = useRef<Array<{ x: number; y: number }>>([]);
  const fpsRef = useRef({ frames: 0, t0: performance.now() });

  const addLog = useCallback((msg: string, cls = "") => {
    setLogs(prev => [...prev.slice(-50), { msg: "[" + new Date().toLocaleTimeString() + "] " + msg, cls }]);
  }, []);

  useEffect(() => { const p = getPrefs(); setMirror(p.mirror); setLeftHanded(p.handedness === "left"); }, []);
  useEffect(() => { if (typeof window !== "undefined") setShowDebug(new URLSearchParams(window.location.search).get("debug") === "1"); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadModel(); }, []);

  const loadModel = useCallback(async () => {
    if (typeof window === "undefined" || !window.ort) {
      setModelStatus("ort.js unavailable"); setMode("rule"); setFallbackActive(true);
      addLog("onnxruntime-web not loaded. Falling back to rule-based.", "warn"); return;
    }
    try {
      const session = await window.ort.InferenceSession.create("/models/fingerspell_mlp.onnx", { executionProviders: ["wasm"] });
      const meta = await fetch("/models/labels.json").then(r => r.json());
      sessionRef.current = session; labelsRef.current = meta.labels;
      setModelReady(true); setModelStatus("MLP " + meta.labels.length + " classes");
      addLog("Loaded ONNX MLP (" + meta.labels.length + " classes)", "ok");
      await runSelfTest(session, meta.labels);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setModelStatus("failed -- rule mode"); setMode("rule"); setFallbackActive(true);
      addLog("Failed to load ONNX: " + msg, "err");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  const runSelfTest = useCallback(async (session: OrtSession, labels: string[]) => {
    try {
      const parity = await fetch("/models/parity_samples.json").then(r => r.json());
      const tol = 1e-3; let featPass = 0, featFail = 0, predPass = 0, predFail = 0;
      const failedPreds: string[] = [];
      for (const [letter, sample] of Object.entries(parity as Record<string, { landmarks: number[][], expected_normalized_first6: number[], expected_normalized_l2: number }>)) {
        const lm = (sample.landmarks as number[][]).map(pt => ({ x: pt[0], y: pt[1], z: pt[2] }));
        const feats = normalize(lm);
        let drift = 0;
        for (let i = 0; i < 6; i++) drift = Math.max(drift, Math.abs(feats[i] - sample.expected_normalized_first6[i]));
        let l2 = 0; for (let i = 0; i < feats.length; i++) l2 += feats[i] * feats[i]; l2 = Math.sqrt(l2);
        if (drift < tol && Math.abs(l2 - sample.expected_normalized_l2) < tol) featPass++; else featFail++;
        const pred = await runModelOnLandmarks(session, labels, lm);
        if (pred && pred[0].label === letter) predPass++; else { predFail++; failedPreds.push(letter + "->" + (pred?.[0]?.label ?? "?")); }
      }
      const total = Object.keys(parity).length;
      if (featFail === 0 && predFail === 0) addLog("Self-test OK features:" + featPass + "/" + total + " predictions:" + predPass + "/" + total, "ok");
      else {
        if (featFail > 0) addLog("Self-test WARN " + featFail + "/" + total + " features drifted from Python", "warn");
        if (predFail > 0) addLog("Self-test WARN " + predFail + "/" + total + " predictions wrong: " + failedPreds.join(", "), "warn");
      }
    } catch { addLog("Self-test skipped: parity_samples.json unavailable.", "warn"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  const runModelOnLandmarks = useCallback(async (session: OrtSession, labels: string[], lm: Array<{ x: number; y: number; z: number }>): Promise<RankedResult[] | null> => {
    const t0 = performance.now();
    const feats = normalize(lm);
    const tensor = new window.ort.Tensor("float32", feats, [1, 63]);
    const out = await session.run({ input: tensor });
    setClfLatency(performance.now() - t0);
    const probs = out.probabilities.data;
    return Array.from(probs).map((prob, i) => ({ label: labels[i], prob: prob as number })).sort((a, b) => b.prob - a.prob);
  }, []);
  const startCamera = useCallback(async () => {
    if (running) return;
    if (!window.Hands) { addLog("MediaPipe Hands not available.", "err"); return; }
    try {
      const hands = new window.Hands({ locateFile: f => "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/" + f });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
      handsRef.current = hands;
    } catch (e: unknown) { addLog("Failed to init MediaPipe: " + (e instanceof Error ? e.message : String(e)), "err"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      streamRef.current = stream;
    } catch (e: unknown) { addLog("Camera unavailable: " + (e instanceof Error ? e.message : String(e)), "err"); return; }
    const video = videoRef.current!;
    video.srcObject = streamRef.current;
    await video.play();
    if (overlayRef.current) { overlayRef.current.width = video.videoWidth || 640; overlayRef.current.height = video.videoHeight || 480; }
    const cam = new window.Camera(video, {
      onFrame: async () => { const t0 = performance.now(); await handsRef.current!.send({ image: video }); setMpLatency(performance.now() - t0); },
      width: 640, height: 480,
    });
    cam.start(); cameraRef.current = cam; setRunning(true);
    addLog("Camera started on-device", "ok");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, addLog]);

  const stopCamera = useCallback(() => {
    if (!running) return;
    try { cameraRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    setRunning(false); setHandDetected(false);
    addLog("Camera stopped");
  }, [running, addLog]);

  const onResults = useCallback(async (results: { multiHandLandmarks?: Array<Array<{ x: number; y: number; z: number }>> }) => {
    const ctx = overlayRef.current?.getContext("2d");
    if (ctx && overlayRef.current) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    const lmRaw = results.multiHandLandmarks?.[0] ?? null;
    if (lmRaw) {
      setHandDetected(true);
      if (ctx && window.drawConnectors && window.HAND_CONNECTIONS) {
        window.drawConnectors(ctx, lmRaw, window.HAND_CONNECTIONS, { color: "#7c9cff", lineWidth: 3 });
        window.drawLandmarks(ctx, lmRaw, { color: "#5ee0c1", lineWidth: 1, radius: 3 });
      }
      moveBufRef.current.push({ x: lmRaw[0].x, y: lmRaw[0].y });
      if (moveBufRef.current.length > 30) moveBufRef.current.shift();
      await classifyAndScore(lmRaw);
    } else {
      setHandDetected(false); moveBufRef.current.length = 0;
      setDetected("--"); setConfidence(0); setVerdict(null); setRanked([]);
    }
    const fc = fpsRef.current; fc.frames++;
    const now = performance.now();
    if (now - fc.t0 > 1000) { setFps(Math.round(fc.frames * 1000 / (now - fc.t0))); fc.frames = 0; fc.t0 = now; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, mode, modelReady]);

  const classifyAndScore = useCallback(async (lmRaw: Array<{ x: number; y: number; z: number }>) => {
    const states = fingerStates(lmRaw);
    const orient = palmFacingCamera(lmRaw);
    const loc = locationLabel(lmRaw);
    const buf = moveBufRef.current;
    let movement = 0;
    for (let i = 1; i < buf.length; i++) { const dx = buf[i].x - buf[i-1].x, dy = buf[i].y - buf[i-1].y; movement += Math.hypot(dx, dy); }
    let rankedResult: RankedResult[] | null = null;
    if (mode === "ml" && modelReady && sessionRef.current) {
      try { rankedResult = await runModelOnLandmarks(sessionRef.current, labelsRef.current, lmRaw); }
      catch (e: unknown) { addLog("Inference error: " + (e instanceof Error ? e.message : String(e)), "warn"); }
    }
    if (!rankedResult) { const r = classifyRule(lmRaw); rankedResult = r.ranked; setClfLatency(0); }
    const top = rankedResult[0];
    const targetEntry = rankedResult.find(r => r.label === target);
    const modelTopProbForTarget = targetEntry?.prob ?? 0;
    const comps: ComponentScores = {
      shape: modelTopProbForTarget,
      orient: orient.facing ? 1 : 0.4,
      loc: loc.startsWith("middle") ? 1 : 0.6,
      move: movement < 0.05 ? 1 : movement < 0.15 ? 0.6 : 0.2,
    };
    const conf = comps.shape * 0.55 + comps.orient * 0.15 + comps.loc * 0.10 + comps.move * 0.20;
    let v: VerdictType = "close";
    if (top.label === target && comps.shape >= 0.50 && conf >= 0.65) v = "match";
    else if (inSameGroup(top.label, target) && comps.shape >= 0.30) v = "close";
    else if (conf < 0.30 || comps.shape < 0.10) v = "miss";
    setDetected(top.label); setConfidence(conf); setVerdict(v); setRanked(rankedResult);
    setComponents(comps); setFingers(states);
    setTip(chooseTip(comps, top, target, orient, states));
    if (v === "match") recordAttempt("asl-static-" + target, target, "static", 2);
    else if (v === "close") recordAttempt("asl-static-" + target, target, "static", 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, mode, modelReady, addLog]);
  const dotColor = (s: number) => s >= 0.7 ? "var(--ok)" : s >= 0.4 ? "var(--warn)" : "var(--bad)";
  const vBg = verdict === "match" ? "rgba(94,224,193,.10)" : verdict === "close" ? "rgba(255,184,107,.10)" : verdict === "miss" ? "rgba(255,122,144,.10)" : "rgba(124,156,255,.06)";
  const vBorder = verdict === "match" ? "rgba(94,224,193,.45)" : verdict === "close" ? "rgba(255,184,107,.45)" : verdict === "miss" ? "rgba(255,122,144,.45)" : "var(--line)";
  const vColor = verdict === "match" ? "var(--ok)" : verdict === "close" ? "var(--warn)" : verdict === "miss" ? "var(--bad)" : "var(--ink)";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,#0d1430,#0b1020)", position: "sticky", top: 0, zIndex: 5, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          SignTutor <small style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>Static signs ONNX MLP</small>
        </h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="badge">{modelStatus}</span>
          {showDebug && <span className="badge">mp {mpLatency.toFixed(0)}ms clf {clfLatency.toFixed(0)}ms {fps}fps</span>}
          {fallbackActive && <span className="badge badge-warn">Rule-based fallback active</span>}
          <span className="badge badge-ok" aria-label="On-device privacy guarantee">&#x1F512; On-device no upload</span>
        </div>
      </header>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: 20 }}>
        {/* Toolbar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--panel)", marginBottom: 16 }}>
          <Link href="/learn/asl/fingerspelling" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>&#8592; All letters</Link>
          <span style={{ color: "var(--line)" }}>|</span>
          <div role="radiogroup" aria-label="Classifier mode" style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "var(--panel2)" }}>
            {(["ml", "rule"] as ClassifierMode[]).map(m => (
              <button key={m} role="radio" aria-checked={mode === m}
                onClick={() => { if (m === "ml" && !modelReady) { addLog("ML mode unavailable.", "warn"); return; } setMode(m); }}
                disabled={m === "ml" && !modelReady}
                style={{ border: "none", borderRadius: 0, padding: "7px 12px", fontSize: 13, background: mode === m ? "var(--accent)" : "transparent", color: mode === m ? "#0a0f24" : "var(--muted)", fontWeight: mode === m ? 600 : 400, cursor: (m === "ml" && !modelReady) ? "not-allowed" : "pointer", opacity: (m === "ml" && !modelReady) ? 0.5 : 1 }}>
                {m === "ml" ? "ML (ONNX)" : "Rule-based"}
              </button>
            ))}
          </div>
          <button onClick={startCamera} disabled={running} style={{ background: "var(--accent)", color: "#0a0f24", border: "none", padding: "8px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.5 : 1 }}>Start camera</button>
          <button onClick={stopCamera} disabled={!running} style={{ background: "var(--panel2)", color: "var(--ink)", border: "1px solid var(--line)", padding: "8px 14px", borderRadius: 8, fontSize: 14, cursor: !running ? "not-allowed" : "pointer", opacity: !running ? 0.5 : 1 }}>Stop</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
              Mirror webcam
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={leftHanded} onChange={e => setLeftHanded(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
              Left-handed
            </label>
          </div>
        </div>
        {/* Two-pane layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Demo pane */}
          <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }} aria-labelledby="demo-heading">
            <div style={{ padding: "12px 14px", fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span id="demo-heading">Demo Native signer</span>
              <span style={{ background: "rgba(11,16,32,.75)", padding: "4px 10px", borderRadius: 999, fontSize: 12, border: "1px solid var(--line)" }}>Target: {target}</span>
            </div>
            <div style={{ position: "relative", aspectRatio: "4/3", background: "radial-gradient(ellipse at center,#1a2350 0%,#0b1020 70%)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <span style={{ fontSize: 200, fontWeight: 700, letterSpacing: ".05em", textShadow: "0 4px 20px rgba(124,156,255,.4)", transform: leftHanded ? "scaleX(-1)" : "none" }} aria-label={"Demo of letter " + target}>{target}</span>
              <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, fontSize: 13, color: "var(--muted)", background: "rgba(11,16,32,.7)", padding: "8px 12px", borderRadius: 8 }}>{LETTER_DESCRIPTIONS[target]}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 14px" }} role="group" aria-label="Select target letter">
              {STATIC_LETTERS.map(l => (
                <button key={l} onClick={() => setTarget(l)} aria-pressed={l === target} aria-label={"Practice letter " + l}
                  style={{ padding: "6px 10px", fontSize: 13, background: l === target ? "var(--accent)" : "var(--panel2)", color: l === target ? "#0a0f24" : "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer", fontWeight: l === target ? 600 : 400 }}>
                  {l}
                </button>
              ))}
            </div>
          </section>
          {/* Webcam pane */}
          <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }} aria-labelledby="webcam-heading">
            <div style={{ padding: "12px 14px", fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span id="webcam-heading">You Webcam</span>
              <span className="badge badge-ok">&#x1F512; On-device</span>
            </div>
            <div style={{ position: "relative", aspectRatio: "4/3", background: "#000" }}>
              <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: mirror ? "scaleX(-1)" : "none" }} aria-label="Your webcam feed" />
              <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: mirror ? "scaleX(-1)" : "none" }} aria-hidden="true" />
              <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", gap: 8, pointerEvents: "none" }}>
                <span style={{ background: "rgba(11,16,32,.75)", padding: "4px 10px", borderRadius: 999, fontSize: 12, border: "1px solid var(--line)" }} aria-live="polite">{handDetected ? "Hand detected" : "No hand detected"}</span>
                {showDebug && <span style={{ background: "rgba(11,16,32,.75)", padding: "4px 10px", borderRadius: 999, fontSize: 12, border: "1px solid var(--line)" }}>mp {mpLatency.toFixed(0)}ms clf {clfLatency.toFixed(0)}ms</span>}
              </div>
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Verdict */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 10, border: "1px solid " + vBorder, background: vBg }} role="status" aria-live="polite">
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>Detected ({mode === "ml" ? "ML" : "rule"})</div>
                  <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, marginTop: 2, color: vColor }}>{detected}</div>
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "right" }}>
                  confidence<strong style={{ display: "block", fontSize: 22, color: "var(--ink)", marginTop: 2 }}>{confidence > 0 ? (confidence * 100).toFixed(0) + "%" : "--"}</strong>
                </div>
              </div>
              {/* Top-5 bars */}
              {mode === "ml" && ranked.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }} aria-label="Top 5 predictions">
                  {ranked.slice(0, 5).map((r, i) => (
                    <div key={r.label} style={{ display: "grid", gridTemplateColumns: "50px 1fr 50px", gap: 8, alignItems: "center", fontSize: 13 }}>
                      <div style={{ fontWeight: i === 0 ? 700 : 400 }}>{r.label}</div>
                      <div style={{ height: 8, background: "var(--line)", borderRadius: 999, overflow: "hidden" }} role="progressbar" aria-valuenow={Math.round(r.prob * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={r.label + ": " + Math.round(r.prob * 100) + "%"}>
                        <div style={{ height: "100%", width: (r.prob * 100).toFixed(0) + "%", background: i === 0 ? "var(--accent2)" : "var(--accent)", transition: "width .2s" }} />
                      </div>
                      <div style={{ color: "var(--muted)", textAlign: "right" }}>{(r.prob * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              )}
              {/* Per-finger panel — rule layer, always visible (Architectural Decision 7) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--panel2)" }} aria-label="Per-finger handshape match">
                {(["thumb","index","middle","ring","pinky"] as const).map(f => {
                  const ref = PATTERNS[target]; const youExt = fingers ? fingers[f] : false; const want = ref?.[f];
                  const ok = want !== undefined ? youExt === want : null;
                  return (
                    <div key={f} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 4px", borderRadius: 8, background: ok === true ? "rgba(94,224,193,.10)" : ok === false ? "rgba(255,122,144,.10)" : "transparent" }}>
                      <span style={{ fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{f}</span>
                      <span style={{ fontSize: 18, lineHeight: 1, color: ok === true ? "var(--ok)" : ok === false ? "var(--bad)" : "var(--muted)" }} aria-label={f + ": " + (ok === true ? "correct" : ok === false ? "incorrect" : "unknown")}>{fingers ? (youExt ? "✓" : "✗") : "·"}</span>
                      <span style={{ fontSize: 10, color: ok === true ? "var(--ok)" : ok === false ? "var(--bad)" : "var(--muted)" }}>{ok === true ? (want ? "extend ✓" : "curl ✓") : ok === false ? (want ? "should extend" : "should curl") : "--"}</span>
                    </div>
                  );
                })}
              </div>
              {/* Component scores */}
              {components && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {([["Handshape", components.shape, (components.shape * 100 | 0) + "% prob of " + target], ["Orientation", components.orient, components.orient > 0.5 ? "palm forward ✓" : "rotate palm toward camera"], ["Location", components.loc, components.loc >= 0.9 ? "neutral space ✓" : "adjust position"], ["Movement", components.move, components.move >= 0.9 ? "steady ✓" : "hold still"]] as [string, number, string][]).map(([label, score, text]) => (
                    <div key={label} style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--panel2)", display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)", letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</span>
                      <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor(score), display: "inline-block", flexShrink: 0 }} aria-hidden="true" />
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* Actionable tip */}
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
          <strong style={{ color: "var(--ink)" }}>Architecture (PDR 7.1 S-05):</strong> webcam MediaPipe Hands 21x3 landmarks normalize() ONNX MLP top-5 confidence-gated verdict. Rule layer drives per-finger panel and tips. All on-device.
          {!showDebug && <span> <button onClick={() => setShowDebug(true)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, padding: 0 }}>Show debug HUD</button></span>}
        </div>
      </main>
    </div>
  );
}