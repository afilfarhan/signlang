"use client";

/**
 * Camera setup wizard — 4 steps:
 *   1. Language selection
 *   2. Camera permission
 *   3. Lighting check (on-device, no uploads)
 *   4. Framing & handedness
 *
 * Mirrors prototype/wizard.html. Persists prefs to localStorage under
 * "signtutor.prefs". Reuses one MediaStream across steps 2-4.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { savePrefs } from "@/lib/progress";

type Step = 1 | 2 | 3 | 4;

interface LightingMetrics {
  brightness: number;
  uniformity: number;
  brightPct: number;
  uniPct: number;
  brightMsg: string;
  uniMsg: string;
}

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [language, setLanguage] = useState("asl");
  const [handedness, setHandedness] = useState<"right" | "left">("right");
  const [mirror, setMirror] = useState(true);
  const [permGranted, setPermGranted] = useState(false);
  const [permError, setPermError] = useState("");
  const [lighting, setLighting] = useState<LightingMetrics | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const video3Ref = useRef<HTMLVideoElement>(null);
  const video4Ref = useRef<HTMLVideoElement>(null);
  const lightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Attach stream to the active step's video element
  useEffect(() => {
    const v = step === 3 ? video3Ref.current : step === 4 ? video4Ref.current : null;
    if (v && streamRef.current) {
      v.srcObject = streamRef.current;
      v.play().catch(() => {});
    }
    if (step === 3) startLightingLoop();
    else stopLightingLoop();
    return () => { if (step === 3) stopLightingLoop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const startLightingLoop = useCallback(() => {
    stopLightingLoop();
    const v = video3Ref.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = 64; c.height = 48;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    lightTimerRef.current = setInterval(() => {
      if (!v.videoWidth) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const n = c.width * c.height;
      const lum = new Float32Array(n);
      let sum = 0;
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const Y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        lum[j] = Y; sum += Y;
      }
      const mean = sum / n;
      let varSum = 0;
      for (let j = 0; j < n; j++) { const d = lum[j] - mean; varSum += d * d; }
      const std = Math.sqrt(varSum / n);

      const brightPct = Math.min(1, mean / 180);
      const uniPct = Math.max(0, 1 - std / 90);

      const brightMsg =
        mean < 70 ? "Too dark — add more front light" :
        mean > 200 ? "Too bright — reduce direct light" : "Good";
      const uniMsg =
        std > 80 ? "Uneven — try diffuse light" :
        std > 50 ? "OK" : "Even ✓";

      setLighting({ brightness: mean, uniformity: std, brightPct, uniPct, brightMsg, uniMsg });
    }, 250);
  }, []);

  const stopLightingLoop = useCallback(() => {
    if (lightTimerRef.current) {
      clearInterval(lightTimerRef.current);
      lightTimerRef.current = null;
    }
  }, []);

  const requestPermission = async () => {
    setPermError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setPermGranted(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setPermError(
        `Camera unavailable: ${msg} — open this page over https or localhost, and grant camera access in browser settings.`
      );
    }
  };

  const finish = () => {
    savePrefs({
      language,
      handedness,
      mirror,
      completedAt: new Date().toISOString(),
    });
    // Stop the stream — the lesson page will start its own
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    router.push("/learn/asl/fingerspelling");
  };

  const pillClass = (pct: number) =>
    pct >= 0.7 ? "badge badge-ok" : pct >= 0.4 ? "badge badge-warn" : "badge badge-bad";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      {/* Header */}
      <header
        style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(180deg,#0d1430,#0b1020)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          SignTutor <small style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>· Camera setup</small>
        </h1>
        <span className="badge badge-ok" aria-label="On-device privacy guarantee">
          🔒 On-device · no upload
        </span>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px" }}>
        {/* Stepper */}
        <nav
          aria-label="Setup steps"
          style={{
            display: "flex",
            marginBottom: 24,
            border: "1px solid var(--line)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--panel)",
          }}
        >
          {[
            { n: 1, label: "Language" },
            { n: 2, label: "Camera permission" },
            { n: 3, label: "Lighting check" },
            { n: 4, label: "Framing & handedness" },
          ].map(({ n, label }) => (
            <div
              key={n}
              aria-current={step === n ? "step" : undefined}
              style={{
                flex: 1,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderRight: n < 4 ? "1px solid var(--line)" : "none",
                color: step === n ? "var(--ink)" : "var(--muted)",
                background: step === n ? "rgba(124,156,255,.08)" : "transparent",
                fontSize: 13,
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background:
                    n < step
                      ? "var(--ok)"
                      : step === n
                      ? "var(--accent)"
                      : "var(--panel2)",
                  border: n >= step ? "1px solid var(--line)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  color: n <= step ? "#0a0f24" : "var(--muted)",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {n < step ? "✓" : n}
              </span>
              <span style={{ display: "none" }}>Step {n}: </span>
              {label}
            </div>
          ))}
        </nav>

        {/* Step 1: Language */}
        {step === 1 && (
          <section aria-labelledby="h-1">
            <div
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 24,
                marginBottom: 16,
              }}
            >
              <h2 id="h-1" style={{ margin: "0 0 6px", fontSize: 22 }}>
                Choose your sign language
              </h2>
              <p style={{ margin: "0 0 18px", color: "var(--muted)" }}>
                You can change this later in settings. Multi-language is scaffolded; only ASL is fully shipped in this release.
              </p>
              <div
                role="radiogroup"
                aria-labelledby="h-1"
                style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}
              >
                {[
                  { value: "asl", label: "ASL — American Sign Language", sub: "Fully shipped · 200 signs", disabled: false },
                  { value: "bsl", label: "BSL — British Sign Language", sub: "Preview · 25 signs", disabled: true },
                  { value: "arsl", label: "ArSL — Arabic Sign Language", sub: "Preview · 25 signs", disabled: true },
                  { value: "other", label: "Other", sub: "Coming soon — see roadmap", disabled: true },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 14,
                      border: `1px solid ${language === opt.value ? "var(--accent)" : "var(--line)"}`,
                      borderRadius: 10,
                      background: language === opt.value ? "rgba(124,156,255,.08)" : "var(--panel2)",
                      cursor: opt.disabled ? "not-allowed" : "pointer",
                      opacity: opt.disabled ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="radio"
                      name="lang"
                      value={opt.value}
                      checked={language === opt.value}
                      disabled={opt.disabled}
                      onChange={() => setLanguage(opt.value)}
                      style={{ accentColor: "var(--accent)", width: 18, height: 18 }}
                    />
                    <span>
                      <strong style={{ display: "block", fontSize: 15 }}>{opt.label}</strong>
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>{opt.sub}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Step 1 of 4</span>
              <button
                onClick={() => setStep(2)}
                style={{
                  background: "var(--accent)",
                  color: "#0a0f24",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Next: camera permission →
              </button>
            </div>
          </section>
        )}

        {/* Step 2: Camera permission */}
        {step === 2 && (
          <section aria-labelledby="h-2">
            <div
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 24,
                marginBottom: 16,
              }}
            >
              <h2 id="h-2" style={{ margin: "0 0 6px", fontSize: 22 }}>
                Allow camera access
              </h2>
              <p style={{ margin: "0 0 18px", color: "var(--muted)" }}>
                We use your webcam to give you real-time feedback on your signs.
                Frames and hand-landmark data{" "}
                <strong>stay on this device</strong> — they are never uploaded.
              </p>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <p style={{ marginTop: 0 }}>
                    When you click below, your browser will show a camera permission prompt. Choose{" "}
                    <strong>Allow</strong>.
                  </p>
                  <ul style={{ color: "var(--muted)", fontSize: 14, paddingLeft: 18 }}>
                    <li>You can revoke camera access anytime in your browser settings.</li>
                    <li>If you deny by accident, refresh the page to try again.</li>
                    <li>We do not record audio.</li>
                  </ul>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 20,
                    border: "1px dashed var(--line)",
                    borderRadius: 10,
                    background: "var(--panel2)",
                    color: "var(--muted)",
                    fontSize: 48,
                  }}
                  aria-hidden="true"
                >
                  📷
                </div>
              </div>
              {permError && (
                <div
                  role="alert"
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    background: "rgba(255,122,144,.10)",
                    border: "1px solid rgba(255,122,144,.45)",
                    color: "var(--bad)",
                    fontSize: 14,
                  }}
                >
                  {permError}
                </div>
              )}
              {permGranted && (
                <div
                  role="status"
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    background: "rgba(94,224,193,.10)",
                    border: "1px solid rgba(94,224,193,.45)",
                    color: "var(--ok)",
                    fontSize: 14,
                  }}
                >
                  Camera permission granted ✓
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  background: "var(--panel2)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                {!permGranted && (
                  <button
                    onClick={requestPermission}
                    style={{
                      background: "var(--accent)",
                      color: "#0a0f24",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Request camera access
                  </button>
                )}
                <button
                  onClick={() => setStep(3)}
                  disabled={!permGranted}
                  style={{
                    background: "var(--accent)",
                    color: "#0a0f24",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: permGranted ? "pointer" : "not-allowed",
                    opacity: permGranted ? 1 : 0.4,
                  }}
                >
                  Next: lighting check →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Step 3: Lighting check */}
        {step === 3 && (
          <section aria-labelledby="h-3">
            <div
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 24,
                marginBottom: 16,
              }}
            >
              <h2 id="h-3" style={{ margin: "0 0 6px", fontSize: 22 }}>
                Lighting check
              </h2>
              <p style={{ margin: "0 0 18px", color: "var(--muted)" }}>
                For best accuracy, light your hand from the front. Avoid back-light from windows.
              </p>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "4/3",
                      background: "#000",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <video
                      ref={video3Ref}
                      playsInline
                      muted
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      aria-label="Camera preview for lighting check"
                    />
                  </div>
                  {/* Lighting meters */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                    {[
                      {
                        label: "Average brightness",
                        val: lighting ? `${lighting.brightness.toFixed(0)} · ${lighting.brightMsg}` : "measuring…",
                        pct: lighting?.brightPct ?? 0,
                        pillClass: lighting ? pillClass(lighting.brightPct) : "badge",
                        pillText: lighting ? (lighting.brightPct >= 0.7 ? "good" : lighting.brightPct >= 0.4 ? "ok" : "low") : "—",
                      },
                      {
                        label: "Brightness uniformity",
                        val: lighting ? `${lighting.uniformity.toFixed(0)} · ${lighting.uniMsg}` : "measuring…",
                        pct: lighting?.uniPct ?? 0,
                        pillClass: lighting ? pillClass(lighting.uniPct) : "badge",
                        pillText: lighting ? (lighting.uniPct >= 0.7 ? "good" : lighting.uniPct >= 0.4 ? "ok" : "low") : "—",
                      },
                    ].map((m) => (
                      <div
                        key={m.label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "var(--panel2)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        <div style={{ flex: 1, fontSize: 14 }}>
                          <strong style={{ display: "block", fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
                            {m.label}
                          </strong>
                          <span aria-live="polite">{m.val}</span>
                        </div>
                        <div
                          style={{
                            width: 120,
                            height: 8,
                            background: "var(--line)",
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                          role="progressbar"
                          aria-valuenow={Math.round(m.pct * 100)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={m.label}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${(m.pct * 100).toFixed(0)}%`,
                              background: "var(--accent2)",
                              transition: "width 0.2s",
                            }}
                          />
                        </div>
                        <span className={m.pillClass}>{m.pillText}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 style={{ marginTop: 0, fontSize: 15 }}>Tips</h3>
                  <ul style={{ color: "var(--muted)", fontSize: 14, paddingLeft: 18 }}>
                    <li>Face a window or lamp; don&apos;t sit with one behind you.</li>
                    <li>Plain background helps but isn&apos;t required.</li>
                    <li>Even diffuse light beats a single bright spot.</li>
                  </ul>
                  <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 18 }}>
                    You can proceed even if these aren&apos;t green — feedback may just be less accurate.
                  </p>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  background: "var(--panel2)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(4)}
                style={{
                  background: "var(--accent)",
                  color: "#0a0f24",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Next: framing →
              </button>
            </div>
          </section>
        )}

        {/* Step 4: Framing & handedness */}
        {step === 4 && (
          <section aria-labelledby="h-4">
            <div
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 24,
                marginBottom: 16,
              }}
            >
              <h2 id="h-4" style={{ margin: "0 0 6px", fontSize: 22 }}>
                Framing &amp; handedness
              </h2>
              <p style={{ margin: "0 0 18px", color: "var(--muted)" }}>
                Sit so your head and hands fit inside the guide rectangle. Pick your dominant signing hand.
              </p>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "4/3",
                      background: "#000",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <video
                      ref={video4Ref}
                      playsInline
                      muted
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: mirror ? "scaleX(-1)" : "none",
                      }}
                      aria-label="Camera preview for framing check"
                    />
                    {/* Framing guide overlay */}
                    <svg
                      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
                      viewBox="0 0 400 300"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <circle cx="200" cy="80" r="42" fill="none" stroke="#7c9cff" strokeWidth="2" strokeDasharray="6 5" opacity=".8" />
                      <rect x="80" y="130" width="240" height="150" rx="14" fill="none" stroke="#5ee0c1" strokeWidth="2" strokeDasharray="6 5" opacity=".8" />
                      <text x="200" y="78" fill="#7c9cff" fontSize="11" textAnchor="middle" fontFamily="sans-serif" opacity=".9">head</text>
                      <text x="200" y="208" fill="#5ee0c1" fontSize="11" textAnchor="middle" fontFamily="sans-serif" opacity=".9">signing space</text>
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 style={{ marginTop: 0, fontSize: 15 }}>Dominant hand</h3>
                  <div
                    role="radiogroup"
                    aria-label="Dominant hand"
                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
                  >
                    {[
                      { value: "right", label: "Right", sub: "Most common" },
                      { value: "left", label: "Left", sub: "Demos will flip" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: 14,
                          border: `1px solid ${handedness === opt.value ? "var(--accent)" : "var(--line)"}`,
                          borderRadius: 10,
                          background: handedness === opt.value ? "rgba(124,156,255,.08)" : "var(--panel2)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name="hand"
                          value={opt.value}
                          checked={handedness === opt.value}
                          onChange={() => setHandedness(opt.value as "right" | "left")}
                          style={{ accentColor: "var(--accent)", width: 18, height: 18 }}
                        />
                        <span>
                          <strong style={{ display: "block", fontSize: 15 }}>{opt.label}</strong>
                          <span style={{ color: "var(--muted)", fontSize: 13 }}>{opt.sub}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <h3 style={{ marginTop: 18, fontSize: 15 }}>Mirror webcam preview</h3>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 14,
                      border: `1px solid ${mirror ? "var(--accent)" : "var(--line)"}`,
                      borderRadius: 10,
                      background: mirror ? "rgba(124,156,255,.08)" : "var(--panel2)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={mirror}
                      onChange={(e) => setMirror(e.target.checked)}
                      style={{ accentColor: "var(--accent)", width: 18, height: 18 }}
                    />
                    <span>
                      <strong style={{ display: "block", fontSize: 15 }}>Mirror by default</strong>
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>
                        Recommended — matches the demo signer&apos;s view
                      </span>
                    </span>
                  </label>
                  <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 18 }}>
                    You can change all of these anytime in settings.
                  </p>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                onClick={() => setStep(3)}
                style={{
                  background: "var(--panel2)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
              <button
                onClick={finish}
                style={{
                  background: "var(--accent)",
                  color: "#0a0f24",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Finish setup &amp; start lesson →
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
