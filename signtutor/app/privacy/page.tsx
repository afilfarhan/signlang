import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "SignTutor privacy policy - your webcam data never leaves your device.",
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,#0d1430,#0b1020)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>Back to Home</Link>
          <span style={{ color: "var(--line)" }}>|</span>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Privacy Policy</h1>
        </div>
        <span className="badge badge-ok">On-device no upload</span>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ padding: "16px 20px", background: "rgba(94,224,193,.06)", border: "1px solid rgba(94,224,193,.30)", borderRadius: 12, marginBottom: 32 }}>
          <strong style={{ color: "var(--ok)", fontSize: 16 }}>The short version:</strong>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
            Your webcam frames and hand landmarks are processed entirely in your browser. They are <strong style={{ color: "var(--ink)" }}>never transmitted to any server</strong>. We do not collect, store, or share your biometric data.
          </p>
        </div>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>What data we process</h2>
        <ul style={{ color: "var(--muted)", lineHeight: 1.8, paddingLeft: 20 }}>
          <li><strong style={{ color: "var(--ink)" }}>Webcam video:</strong> Processed locally in your browser by MediaPipe Hands (WebAssembly). Frames are never stored or transmitted.</li>
          <li><strong style={{ color: "var(--ink)" }}>Hand landmarks:</strong> 21 (x, y, z) coordinates per frame, computed on-device. Never transmitted.</li>
          <li><strong style={{ color: "var(--ink)" }}>Progress data:</strong> Stored in your browser localStorage under the key <code style={{ background: "rgba(124,156,255,.1)", color: "var(--accent)", padding: "1px 6px", borderRadius: 5 }}>signtutor.progress</code>. Never synced to a server in v1.</li>
          <li><strong style={{ color: "var(--ink)" }}>Preferences:</strong> Stored in localStorage under <code style={{ background: "rgba(124,156,255,.1)", color: "var(--accent)", padding: "1px 6px", borderRadius: 5 }}>signtutor.prefs</code>. Never synced.</li>
        </ul>
        <h2 style={{ fontSize: 22, marginBottom: 12, marginTop: 32 }}>What we do not collect</h2>
        <ul style={{ color: "var(--muted)", lineHeight: 1.8, paddingLeft: 20 }}>
          <li>No webcam frames or video recordings</li>
          <li>No hand landmark data</li>
          <li>No biometric identifiers</li>
          <li>No account information (no accounts in v1)</li>
          <li>No analytics or telemetry (v1)</li>
        </ul>
        <h2 style={{ fontSize: 22, marginBottom: 12, marginTop: 32 }}>Content Security Policy</h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          Lesson pages enforce a Content Security Policy that restricts outbound network connections to the same origin only (model files served from <code style={{ background: "rgba(124,156,255,.1)", color: "var(--accent)", padding: "1px 6px", borderRadius: 5 }}>/models/</code>). This is a technical guarantee that no webcam data can be exfiltrated.
        </p>
        <h2 style={{ fontSize: 22, marginBottom: 12, marginTop: 32 }}>Clearing your data</h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          To delete all locally stored progress and preferences, clear your browser localStorage for this site. In Chrome: DevTools - Application - Local Storage - right-click - Clear.
        </p>
        <p style={{ color: "var(--muted)", marginTop: 32, fontSize: 13 }}>Last updated: 2025</p>
      </main>
    </div>
  );
}