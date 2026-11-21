"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { isEnabled, enableFlag, disableFlag, getAllFlags, type FeatureFlag } from "@/lib/featureFlags";
import { PersonalAdapter } from "@/lib/personalAdapter";
import { getFSRSConfig, saveFSRSConfig, type FSRSConfig } from "@/lib/progress";

export default function SettingsPanel() {
  const [flags, setFlags] = useState<Record<FeatureFlag, boolean>>({ nmm: false, personalization: false, bsl: false, continuous: false, webgpu: false });
  const [adapterInfo, setAdapterInfo] = useState<{ attempts: number; lastUpdated: string } | null>(null);
  const [nmmConsentShown, setNmmConsentShown] = useState(false);
  const [fsrsConfig, setFsrsConfig] = useState<FSRSConfig>({
    desiredRetention: 0.9,
    maximumInterval: 36500,
    enableShortTerm: true,
    learningSteps: ["1m", "10m"],
    relearningSteps: ["10m"],
    enableFuzz: false,
    version: "FSRS-5",
  });

  useEffect(() => {
    setFlags(getAllFlags());
    setFsrsConfig(getFSRSConfig());
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

  const handleFsrsConfigChange = <K extends keyof FSRSConfig>(key: K, value: FSRSConfig[K]) => {
    const newConfig = { ...fsrsConfig, [key]: value };
    setFsrsConfig(newConfig);
    saveFSRSConfig(newConfig);
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

        {/* FSRS-5 Spaced Repetition Configuration */}
        <section aria-labelledby="fsrs-heading" style={{ marginBottom: 32 }}>
          <h2 id="fsrs-heading" style={{ fontSize: 18, marginBottom: 4 }}>Spaced Repetition (FSRS-5)</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
            Free Spaced Repetition Scheduler v5 — adapts to your memory. Higher retention = more reviews.
            <Link href="/practice" style={{ color: "var(--accent)", marginLeft: 8 }}>Test in Practice →</Link>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Desired Retention */}
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <strong style={{ fontSize: 15, minWidth: 180 }}>Target Retention</strong>
                <input
                  type="range"
                  min="0.85"
                  max="0.97"
                  step="0.01"
                  value={fsrsConfig.desiredRetention}
                  onChange={(e) => handleFsrsConfigChange("desiredRetention", parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--accent)" }}
                  aria-label="Target retention"
                />
                <span style={{ fontSize: 18, fontWeight: 700, minWidth: 60, textAlign: "right", color: "var(--accent)" }}>
                  {Math.round(fsrsConfig.desiredRetention * 100)}%
                </span>
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                Probability of recalling a sign at review time. 90% = you'll forget ~10% of due cards.
                Higher values increase review frequency. Recommended: 85–95%.
              </p>
            </div>

            {/* Maximum Interval */}
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <strong style={{ fontSize: 15, minWidth: 180 }}>Maximum Interval</strong>
                <input
                  type="number"
                  min="30"
                  max="36500"
                  step="30"
                  value={fsrsConfig.maximumInterval}
                  onChange={(e) => handleFsrsConfigChange("maximumInterval", parseInt(e.target.value, 10))}
                  style={{ width: 100, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)" }}
                  aria-label="Maximum interval in days"
                />
                <span style={{ color: "var(--muted)", fontSize: 13 }}>days</span>
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                Cap on how long a sign can go without review. Default: 10 years (36500 days).
              </p>
            </div>

            {/* Enable Short Term / Learning Steps */}
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={fsrsConfig.enableShortTerm}
                  onChange={(e) => handleFsrsConfigChange("enableShortTerm", e.target.checked)}
                  style={{ accentColor: "var(--accent)", width: 18, height: 18 }}
                />
                <strong style={{ fontSize: 15 }}>Enable learning steps (short-term scheduling)</strong>
              </label>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
                When on, new signs go through explicit learning steps before graduating to long-term review.
              </p>
              {fsrsConfig.enableShortTerm && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
                      Learning steps:
                      <input
                        type="text"
                        value={fsrsConfig.learningSteps.join(", ")}
                        onChange={(e) => handleFsrsConfigChange("learningSteps", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        style={{ flex: 1, padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--panel2)", color: "var(--ink)", fontSize: 12 }}
                        placeholder="e.g., 1m, 10m"
                      />
                    </label>
                  </div>
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
                      Relearning steps:
                      <input
                        type="text"
                        value={fsrsConfig.relearningSteps.join(", ")}
                        onChange={(e) => handleFsrsConfigChange("relearningSteps", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        style={{ flex: 1, padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--panel2)", color: "var(--ink)", fontSize: 12 }}
                        placeholder="e.g., 10m"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Enable Fuzz */}
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={fsrsConfig.enableFuzz}
                  onChange={(e) => handleFsrsConfigChange("enableFuzz", e.target.checked)}
                  style={{ accentColor: "var(--accent)", width: 18, height: 18 }}
                />
                <strong style={{ fontSize: 15 }}>Add interval fuzz (randomization)</strong>
              </label>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Adds small random variation to intervals to prevent cards from clumping on the same day.
              </p>
            </div>

            {/* FSRS Version */}
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <strong style={{ fontSize: 15, minWidth: 180 }}>FSRS Algorithm Version</strong>
                <select
                  value={fsrsConfig.version}
                  onChange={(e) => handleFsrsConfigChange("version", e.target.value as "FSRS-5" | "FSRS-6" | "FSRS-7")}
                  style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 13 }}
                >
                  <option value="FSRS-5">FSRS-5 (Stable, well-tested)</option>
                  <option value="FSRS-6">FSRS-6 (Improved stability modeling)</option>
                  <option value="FSRS-7">FSRS-7 (Latest, dual stability)</option>
                </select>
              </div>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Changing version resets scheduling for future reviews. Existing progress is preserved.
              </p>
            </div>
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