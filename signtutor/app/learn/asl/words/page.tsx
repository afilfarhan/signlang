import Link from "next/link";
import type { Metadata } from "next";
import { DYNAMIC_SIGNS } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "ASL Common Signs",
  description: "Learn dynamic ASL signs like HELLO, THANKS, PLEASE with on-device Transformer recognition.",
};

export default function WordsIndexPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,#0d1430,#0b1020)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>Back to Home</Link>
          <span style={{ color: "var(--line)" }}>|</span>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>ASL Common Signs</h1>
        </div>
        <span className="badge badge-ok">On-device no upload</span>
      </header>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px" }}>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          Dynamic signs recognized using a Transformer over 45-frame landmark windows.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }} role="list" aria-label="ASL common signs">
          {Object.entries(DYNAMIC_SIGNS).map(([word, desc]) => (
            <Link key={word} href={"/learn/asl/words/" + word.toLowerCase()} role="listitem"
              style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px", textDecoration: "none", color: "var(--ink)", display: "flex", flexDirection: "column", gap: 8 }}
              aria-label={"Practice sign " + word + ": " + desc}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--accent)" }}>{word}</span>
              <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.4 }}>{desc}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}