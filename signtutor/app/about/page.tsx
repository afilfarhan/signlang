import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About SignTutor",
  description: "About SignTutor - a browser-based, vision-driven sign language learning platform.",
};

export default function AboutPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,#0d1430,#0b1020)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>Back to Home</Link>
          <span style={{ color: "var(--line)" }}>|</span>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>About SignTutor</h1>
        </div>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        <h2 style={{ fontSize: 28, marginBottom: 16 }}>What is SignTutor?</h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.7, marginBottom: 20 }}>
          SignTutor is a browser-based, vision-driven sign language learning platform. It uses on-device AI to give you real-time, specific feedback on your signs - no uploads, no account required.
        </p>
        <p style={{ color: "var(--muted)", lineHeight: 1.7, marginBottom: 20 }}>
          Over 400 million people worldwide live with disabling hearing loss, and sign language is the primary language of millions in the Deaf community. Existing learning resources are dominated by passive video libraries; they cannot tell a learner whether their sign was correct. SignTutor solves this with webcam-only, in-browser feedback.
        </p>
        <h2 style={{ fontSize: 22, marginBottom: 12, marginTop: 32 }}>How it works</h2>
        <ol style={{ color: "var(--muted)", lineHeight: 1.8, paddingLeft: 20 }}>
          <li>MediaPipe Hands extracts 21 hand landmarks per frame (WebAssembly, on-device)</li>
          <li>A JS feature normalization function (mirroring the Python training pipeline) prepares the features</li>
          <li>An ONNX MLP (static signs) or Transformer (dynamic signs) classifies the sign</li>
          <li>A rule-based layer provides per-finger interpretability and actionable tips</li>
        </ol>
        <h2 style={{ fontSize: 22, marginBottom: 12, marginTop: 32 }}>Accessibility</h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          SignTutor targets WCAG 2.2 AA conformance. All interactive controls have keyboard navigation, visible focus rings, and ARIA labels. Webcam mirroring is on by default. Left-handed mode flips both the demo and recognition.
        </p>
        <h2 style={{ fontSize: 22, marginBottom: 12, marginTop: 32 }}>Models</h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          The current models are trained on synthetic landmark data. Recognition accuracy improves significantly with real signer data - the CI pipeline is already in place to gate regressions when real datasets are integrated.
        </p>
        <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/learn/asl/fingerspelling" style={{ background: "var(--accent)", color: "#0a0f24", padding: "10px 20px", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>Start learning</Link>
          <Link href="/privacy" style={{ background: "var(--panel)", color: "var(--ink)", padding: "10px 20px", borderRadius: 8, fontWeight: 600, textDecoration: "none", border: "1px solid var(--line)" }}>Privacy policy</Link>
        </div>
      </main>
    </div>
  );
}