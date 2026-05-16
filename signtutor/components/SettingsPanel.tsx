"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { isEnabled, enableFlag, disableFlag, getAllFlags, type FeatureFlag } from "@/lib/featureFlags";
import { PersonalAdapter } from "@/lib/personalAdapter";

export default function SettingsPanel() {
  const [flags, setFlags] = useState<Record<FeatureFlag, boolean>>({ nmm: false, personalization: false, bsl: false, continuous: false, webgpu: false });
  const [adapterInfo, setAdapterInfo] = useState<{ attempts: number; lastUpdated: string } | null>(null);
  const [nmmConsentShown, setNmmConsentShown] = useState(false);

  useEffect(() => {
    setFlags(getAllFlags());
    // Load adapter info
    const adapter = PersonalAdapter.load(64, 10);
    if (adapter.confirmedAttempts > 0) {
      setAdapterInfo({ attempts: adapter.confirmedAttempts, lastUpdated: adapter.lastUpdated });
    }
  }, []);

  const toggle = (flag: FeatureFlag) => {
    if (flag === "nmm" && !flags.nmm) {
      setNmmConsentShown(true);
      return;
    }
    if (flags[flag]) { disableFlag(flag); } else { enableFlag(flag); }
    setFlags(getAllFlags());
  };

  const confirmNmm = () => {
    enableFlag("nmm");
    setFlags(getAllFlags());
    setNmmConsentShown(false);
  };

  const resetAdapter = () => {
    if (confirm("Reset personalization? This cannot be undone.")) {
      PersonalAdapter.reset();
      setAdapterInfo(null);
    }
  };

  const FLAG_INFO: Record<FeatureFlag, { label: string; desc: string; badge?: string }> = {
    nmm:             { label: "Score facial expression (NMM)", desc: "Adds a 5th feedback component for brow and mouth position. Requires a face in frame. Nothing is uploaded.", badge: "W4" },
    personalization: { label: "On-device personalization", desc: "Adapts the model to your hand size and signing style using confirmed attempts. All data stays on your device.", badge: "W5" },
    bsl:             { label: "BSL beta", desc: "British Sign Language beta tier. Accuracy is lower than ASL.", badge: "W7 beta" },
    continuous:      { label: "Continuous SLR research preview", desc: "Sentence-level recognition. Much lower accuracy than isolated signs. See /research/continuous.", badge: "W8 research" },
    webgpu:          { label: "WebGPU acceleration", desc: "Use WebGPU execution provider for faster inference on supported browsers. Falls back to WASM.", badge: "Stretch" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,#0d1430,#0b1020)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>Back to Home</Link>
          <span style={{ color: "var(--line)" }}>|</span>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Settings</h1>
        </div>
      </header>

      {/* NMM consent modal */}
      {nmmConsentShown && (
        <div role="dialog" aria-modal="true" aria-labelledby="nmm-consent-heading"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: 28, maxWidth: 480, width: "100%" }}>
            <h2 id="nmm-consent-heading" style={{ margin: "0 0 12px", fontSize: 20 }}>Enable facial expression scoring?</h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
              When enabled, SignTutor will analyse your <strong style={{ color: "var(--ink)" }}>brow position and mouth shape</strong> to score non-manual markers (NMM) - the facial expressions that carry grammatical meaning in ASL.
            </p>
            <ul style={{ color: "var(--muted)", fontSize: 14, paddingLeft: 18, marginBottom: 20 }}>
              <li>Face landmarks are processed entirely on your device</li>
              <li>No facial data is uploaded or stored</li>
              <li>You can turn this off at any time in Settings</li>
            </ul>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={confirmNmm}
                style={{ background: "var(--accent)", color: "#0a0f24", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer", flex: 1 }}>
                Enable NMM scoring
              </button>
              <button onClick={() => setNmmConsentShown(false)}
                style={{ background: "var(--panel2)", color: "var(--ink)", border: "1px solid var(--line)", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
        <section aria-labelledby="prefs-heading" style={{ marginBottom: 32 }}>
          <h2 id="prefs-heading" style={{ fontSize: 18, marginBottom: 16 }}>Preferences</h2>
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20 }}>
            <p style={{ color: "var(--muted)", margin: 0, fontSize: 14 }}>
              Camera preferences (mirror, handedness, language) are set in the{" "}
              <Link href="/setup" style={{ color: "var(--accent)" }}>setup wizard</Link>.
            </p>
          </div>
        </section>

        <section aria-labelledby="flags-heading" style={{ marginBottom: 32 }}>
          <h2 id="flags-heading" style={{ fontSize: 18, marginBottom: 4 }}>Experimental features</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>These features are in development. They may be less accurate or stable.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(Object.entries(FLAG_INFO) as [FeatureFlag, typeof FLAG_INFO[FeatureFlag]][]).map(([flag, info]) => (
              <div key={flag} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <strong style={{ fontSize: 15 }}>{info.label}</strong>
                    {info.badge && (
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(124,156,255,.15)", color: "var(--accent)", border: "1px solid rgba(124,156,255,.3)", letterSpacing: ".06em" }}>
                        {info.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>{info.desc}</p>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}>
                  <input type="checkbox" checked={flags[flag]} onChange={() => toggle(flag)}
                    style={{ accentColor: "var(--accent)", width: 18, height: 18 }}
                    aria-label={"Toggle " + info.label} />
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{flags[flag] ? "On" : "Off"}</span>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Personalization data section (W5) */}
        <section aria-labelledby="data-heading" id="data">
          <h2 id="data-heading" style={{ fontSize: 18, marginBottom: 16 }}>Your data</h2>
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Personalization adapter</h3>
            {adapterInfo ? (
              <>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 12px" }}>
                  Trained on <strong style={{ color: "var(--ink)" }}>{adapterInfo.attempts}</strong> confirmed attempts.
                  Last updated: {new Date(adapterInfo.lastUpdated).toLocaleDateString()}.
                </p>
                <button onClick={resetAdapter}
                  style={{ background: "rgba(255,122,144,.1)", color: "var(--bad)", border: "1px solid rgba(255,122,144,.45)", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                  Reset personalization
                </button>
              </>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
                No personalization data yet. Enable personalization above and practice to build your adapter.
              </p>
            )}
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 16, marginBottom: 0 }}>
              All data is stored in your browser localStorage. Nothing is uploaded.
              To delete everything, clear localStorage for this site in your browser DevTools.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}