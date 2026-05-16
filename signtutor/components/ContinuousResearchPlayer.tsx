"use client";
/**
 * ContinuousResearchPlayer (W8)
 * Research preview for continuous (sentence-level) sign recognition.
 * IMPORTANT: This is NOT a product feature. The disclaimer is load-bearing.
 * The route is noindex,nofollow and excluded from sitemap.
 */
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function ContinuousResearchPlayer() {
  const [accepted, setAccepted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 5-second timer before accept button is enabled (W8: disclaimer cannot be skipped)
  useEffect(() => {
    if (accepted) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [accepted]);

  if (!accepted) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 560, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: 32 }}>
          <div style={{ display: "inline-block", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--warn)", background: "rgba(255,184,107,.1)", border: "1px solid rgba(255,184,107,.4)", padding: "4px 10px", borderRadius: 6, marginBottom: 16 }}>
            Research preview
          </div>
          <h1 style={{ margin: "0 0 16px", fontSize: 24 }}>Continuous Sign Language Recognition</h1>
          <div style={{ background: "rgba(255,184,107,.08)", border: "1px solid rgba(255,184,107,.4)", borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
            <p style={{ margin: "0 0 10px", fontWeight: 600, color: "var(--warn)" }}>Please read before continuing</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", lineHeight: 1.7, fontSize: 14 }}>
              <li>This is a <strong style={{ color: "var(--ink)" }}>research preview</strong>, not a finished product.</li>
              <li>Accuracy is <strong style={{ color: "var(--ink)" }}>much lower</strong> than our trained isolated-sign recognition.</li>
              <li>Treat all outputs as <strong style={{ color: "var(--ink)" }}>suggestions, not corrections</strong>.</li>
              <li>This surface does <strong style={{ color: "var(--ink)" }}>not score or judge</strong> your signing.</li>
              <li>All processing is on-device. No video is uploaded.</li>
            </ul>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
            The model used here (CTC Transformer over landmark sequences) is trained on limited data and has a Word Error Rate above 50% on held-out signers. It is published for transparency and stakeholder feedback only.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => setAccepted(true)}
              disabled={secondsLeft > 0}
              aria-disabled={secondsLeft > 0}
              style={{ background: secondsLeft > 0 ? "var(--panel2)" : "var(--accent)", color: secondsLeft > 0 ? "var(--muted)" : "#0a0f24", border: "1px solid var(--line)", padding: "10px 20px", borderRadius: 8, fontWeight: 600, cursor: secondsLeft > 0 ? "not-allowed" : "pointer", fontSize: 14 }}>
              {secondsLeft > 0 ? "I understand (" + secondsLeft + "s)" : "I understand, continue"}
            </button>
            <Link href="/" style={{ color: "var(--muted)", fontSize: 14, textDecoration: "none" }}>Cancel</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,#0d1430,#0b1020)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>Back to Home</Link>
          <span style={{ color: "var(--line)" }}>|</span>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Continuous SLR</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(255,184,107,.4)", color: "var(--warn)", background: "rgba(255,184,107,.08)" }}>Research preview</span>
          <span className="badge badge-ok">On-device no upload</span>
        </div>
      </header>
      <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <div style={{ background: "rgba(255,184,107,.06)", border: "1px solid rgba(255,184,107,.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--muted)" }}>
          <strong style={{ color: "var(--warn)" }}>Research preview.</strong> Accuracy is much lower than isolated-sign recognition. Outputs are suggestions only - this surface does not score your signing.
        </div>

        {/* Model not yet trained notice */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">🔬</div>
          <h2 style={{ margin: "0 0 12px", fontSize: 22 }}>CTC model training in progress</h2>
          <p style={{ color: "var(--muted)", maxWidth: "50ch", margin: "0 auto 20px", lineHeight: 1.6 }}>
            The continuous SLR model (CTC Transformer over landmark sequences, trained on How2Sign) is being trained. This page will activate once the model passes the WER gate (WER &lt; 0.50 on held-out test set).
          </p>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            See <code style={{ background: "rgba(124,156,255,.1)", color: "var(--accent)", padding: "1px 6px", borderRadius: 4 }}>ml/models/continuous_eval_report.md</code> for training progress.
          </p>
        </div>
      </main>
    </div>
  );
}