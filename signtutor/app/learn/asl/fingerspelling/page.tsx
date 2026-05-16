import type { Metadata } from "next";
import Link from "next/link";
import { ALL_LETTERS, LETTER_DESCRIPTIONS, isMotionLetter } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "ASL Fingerspelling",
  description: "Learn all 26 ASL letters. J and Z are motion letters handled by the dynamic Transformer.",
};

export default function FingerspellingIndexPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,#0d1430,#0b1020)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>Back to Home</Link>
          <span style={{ color: "var(--line)" }}>|</span>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>ASL Fingerspelling</h1>
        </div>
        <span className="badge badge-ok">On-device no upload</span>
      </header>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px" }}>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          All 26 letters. J and Z are motion letters and use the dynamic Transformer.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}
          role="list" aria-label="ASL alphabet letters">
          {ALL_LETTERS.map((letter) => {
            const motion = isMotionLetter(letter);
            const href = motion
              ? "/learn/asl/words/" + letter.toLowerCase()
              : "/learn/asl/fingerspelling/" + letter;
            return (
              <Link key={letter} href={href} role="listitem"
                style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 12px", textDecoration: "none", color: "var(--ink)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                aria-label={"Practice letter " + letter + (motion ? " (motion letter)" : "") + ": " + LETTER_DESCRIPTIONS[letter]}>
                <span style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, color: motion ? "var(--accent2)" : "var(--accent)" }} aria-hidden="true">{letter}</span>
                {motion && (
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(94,224,193,.15)", color: "var(--accent2)", border: "1px solid rgba(94,224,193,.3)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                    Motion
                  </span>
                )}
                <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.3 }}>
                  {LETTER_DESCRIPTIONS[letter].split(" - ")[0].split(".")[0]}
                </span>
              </Link>
            );
          })}
        </div>
        <div style={{ marginTop: 24, padding: "12px 16px", background: "rgba(94,224,193,.06)", border: "1px solid rgba(94,224,193,.3)", borderRadius: 10, fontSize: 13, color: "var(--muted)" }}>
          <strong style={{ color: "var(--ok)" }}>J and Z</strong> are motion letters in ASL - they require tracing a path in the air. They use the dynamic Transformer model instead of the static MLP.
        </div>
      </main>
    </div>
  );
}