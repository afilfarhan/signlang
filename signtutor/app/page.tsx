import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SignTutor — Learn Sign Language",
  description:
    "Start learning ASL fingerspelling and common signs in under 60 seconds. On-device AI — your webcam never leaves your device.",
};

export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--ink)",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(180deg,#0d1430,#0b1020)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg,var(--accent),var(--accent2))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0a0f24",
              fontWeight: 800,
              fontSize: 16,
            }}
            aria-hidden="true"
          >
            S
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>SignTutor</span>
        </div>
        <nav aria-label="Main navigation" style={{ display: "flex", gap: 8 }}>
          <Link
            href="/learn/asl/fingerspelling"
            style={{
              color: "var(--muted)",
              textDecoration: "none",
              fontSize: 14,
              padding: "6px 12px",
              borderRadius: 8,
            }}
          >
            Learn
          </Link>
          <Link
            href="/practice"
            style={{
              color: "var(--muted)",
              textDecoration: "none",
              fontSize: 14,
              padding: "6px 12px",
              borderRadius: 8,
            }}
          >
            Practice
          </Link>
          <Link
            href="/about"
            style={{
              color: "var(--muted)",
              textDecoration: "none",
              fontSize: 14,
              padding: "6px 12px",
              borderRadius: 8,
            }}
          >
            About
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "60px 24px 40px",
            textAlign: "center",
          }}
          aria-labelledby="hero-heading"
        >
          <div
            style={{
              display: "inline-block",
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: 16,
            }}
          >
            Vision-based sign language tutor
          </div>
          <h1
            id="hero-heading"
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 800,
              lineHeight: 1.1,
              margin: "0 0 20px",
              background: "linear-gradient(135deg, var(--ink) 60%, var(--accent))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Learn sign language
            <br />
            with real-time feedback
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "var(--muted)",
              maxWidth: "52ch",
              margin: "0 auto 32px",
              lineHeight: 1.6,
            }}
          >
            Watch a native signer demonstrate, then sign on your webcam and get
            instant, specific corrections — all on your device, no uploads.
          </p>

          {/* Privacy badges */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: 40,
            }}
            aria-label="Key features"
          >
            <span className="badge badge-ok">🔒 On-device · no upload</span>
            <span className="badge">No account required</span>
            <span className="badge">ASL fingerspelling + signs</span>
            <span className="badge">WCAG 2.2 AA</span>
          </div>

          {/* Primary CTA */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/setup"
              style={{
                background: "var(--accent)",
                color: "#0a0f24",
                padding: "14px 28px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 16,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
              aria-label="Start your first lesson — takes less than 60 seconds"
            >
              Start your first lesson →
            </Link>
            <Link
              href="/learn/asl/fingerspelling"
              style={{
                background: "var(--panel)",
                color: "var(--ink)",
                padding: "14px 28px",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 16,
                textDecoration: "none",
                border: "1px solid var(--line)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Browse lessons
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <section
          style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 60px" }}
          aria-labelledby="features-heading"
        >
          <h2
            id="features-heading"
            style={{
              fontSize: 13,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 20,
            }}
          >
            What you can learn
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {/* Fingerspelling card */}
            <Link
              href="/learn/asl/fingerspelling"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "22px",
                textDecoration: "none",
                color: "var(--ink)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transition: "border-color 0.15s",
              }}
              aria-label="Fingerspelling — learn all 24 static ASL letters"
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--accent2)",
                }}
              >
                PDR S-05
              </span>
              <h3 style={{ margin: "4px 0 0", fontSize: 20 }}>
                Fingerspelling →
              </h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, flex: 1 }}>
                All 24 static ASL letters with per-finger feedback. The ONNX MLP
                runs entirely on your device.
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(124,156,255,.10)",
                    color: "var(--accent)",
                    border: "1px solid rgba(124,156,255,.30)",
                  }}
                >
                  24 letters
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(124,156,255,.10)",
                    color: "var(--accent)",
                    border: "1px solid rgba(124,156,255,.30)",
                  }}
                >
                  Per-finger panel
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(124,156,255,.10)",
                    color: "var(--accent)",
                    border: "1px solid rgba(124,156,255,.30)",
                  }}
                >
                  72 KB model
                </span>
              </div>
            </Link>

            {/* Dynamic signs card */}
            <Link
              href="/learn/asl/words"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "22px",
                textDecoration: "none",
                color: "var(--ink)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
              aria-label="Common signs — learn dynamic ASL words like HELLO, THANKS, PLEASE"
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--accent2)",
                }}
              >
                PDR S-06
              </span>
              <h3 style={{ margin: "4px 0 0", fontSize: 20 }}>
                Common signs →
              </h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, flex: 1 }}>
                Dynamic signs like HELLO, THANKS, PLEASE using a Transformer
                model over 45-frame landmark windows.
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(124,156,255,.10)",
                    color: "var(--accent)",
                    border: "1px solid rgba(124,156,255,.30)",
                  }}
                >
                  8 signs
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(124,156,255,.10)",
                    color: "var(--accent)",
                    border: "1px solid rgba(124,156,255,.30)",
                  }}
                >
                  Transformer
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(124,156,255,.10)",
                    color: "var(--accent)",
                    border: "1px solid rgba(124,156,255,.30)",
                  }}
                >
                  360 KB model
                </span>
              </div>
            </Link>

            {/* Practice card */}
            <Link
              href="/practice"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "22px",
                textDecoration: "none",
                color: "var(--ink)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
              aria-label="Spaced repetition practice — review signs you are forgetting"
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--accent2)",
                }}
              >
                S-16
              </span>
              <h3 style={{ margin: "4px 0 0", fontSize: 20 }}>
                Spaced repetition →
              </h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, flex: 1 }}>
                Review queue surfaces signs you&apos;re forgetting first. Progress
                saved locally — no account needed.
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(124,156,255,.10)",
                    color: "var(--accent)",
                    border: "1px solid rgba(124,156,255,.30)",
                  }}
                >
                  FSRS algorithm
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(124,156,255,.10)",
                    color: "var(--accent)",
                    border: "1px solid rgba(124,156,255,.30)",
                  }}
                >
                  Local storage
                </span>
              </div>
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section
          style={{
            background: "var(--panel)",
            borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)",
            padding: "48px 24px",
          }}
          aria-labelledby="how-heading"
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <h2
              id="how-heading"
              style={{
                fontSize: 24,
                fontWeight: 700,
                marginBottom: 32,
                textAlign: "center",
              }}
            >
              How it works
            </h2>
            <ol
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 24,
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {[
                {
                  n: "1",
                  title: "Watch the demo",
                  desc: "See a native signer demonstrate the sign with a written description.",
                },
                {
                  n: "2",
                  title: "Sign on your webcam",
                  desc: "Your camera runs MediaPipe Hands locally — no frames are uploaded.",
                },
                {
                  n: "3",
                  title: "Get instant feedback",
                  desc: "The AI tells you exactly which finger is wrong and what to fix.",
                },
                {
                  n: "4",
                  title: "Track your progress",
                  desc: "Spaced repetition surfaces signs you're forgetting before they fade.",
                },
              ].map((step) => (
                <li
                  key={step.n}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: "20px",
                    background: "var(--panel2)",
                    borderRadius: 12,
                    border: "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,var(--accent),var(--accent2))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#0a0f24",
                      fontWeight: 800,
                      fontSize: 16,
                    }}
                    aria-hidden="true"
                  >
                    {step.n}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{step.title}</h3>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                    {step.desc}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Privacy section */}
        <section
          style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}
          aria-labelledby="privacy-heading"
        >
          <div
            style={{
              padding: "24px",
              borderRadius: 14,
              background: "rgba(94,224,193,.06)",
              border: "1px solid rgba(94,224,193,.30)",
            }}
          >
            <h2
              id="privacy-heading"
              style={{ margin: "0 0 12px", fontSize: 20, color: "var(--ok)" }}
            >
              🔒 Your privacy is the default
            </h2>
            <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 15 }}>
              Webcam frames and hand landmarks are processed entirely in your
              browser using WebAssembly. They are{" "}
              <strong style={{ color: "var(--ink)" }}>never transmitted</strong>{" "}
              to any server. The &quot;🔒 On-device&quot; badge is visible whenever your
              camera is active.
            </p>
            <Link
              href="/privacy"
              style={{ color: "var(--accent)", fontSize: 14 }}
            >
              Read our privacy policy →
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "24px",
          color: "var(--muted)",
          fontSize: 13,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
        role="contentinfo"
      >
        <div>
          <strong style={{ color: "var(--ink)" }}>SignTutor</strong> — built for
          the Deaf community and hearing learners alike.
        </div>
        <nav aria-label="Footer navigation" style={{ display: "flex", gap: 16 }}>
          <Link href="/about" style={{ color: "var(--muted)", textDecoration: "none" }}>
            About
          </Link>
          <Link href="/privacy" style={{ color: "var(--muted)", textDecoration: "none" }}>
            Privacy
          </Link>
          <Link href="/setup" style={{ color: "var(--muted)", textDecoration: "none" }}>
            Setup
          </Link>
        </nav>
      </footer>
    </div>
  );
}
