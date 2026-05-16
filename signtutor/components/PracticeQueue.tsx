﻿"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getReviewQueue, getMasteredCount, getTotalAttempted, getProgress, type SignProgress } from "@/lib/progress";

export default function PracticeQueue() {
  const [queue, setQueue] = useState<SignProgress[]>([]);
  const [mastered, setMastered] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [allSigns, setAllSigns] = useState<SignProgress[]>([]);

  useEffect(() => {
    setQueue(getReviewQueue());
    setMastered(getMasteredCount());
    setAttempted(getTotalAttempted());
    const store = getProgress();
    setAllSigns(Object.values(store.signs).sort((a, b) => (b.attempts - a.attempts)));
  }, []);

  const getSignUrl = (s: SignProgress) =>
    s.type === "static"
      ? `/learn/asl/fingerspelling/${s.label}`
      : `/learn/asl/words/${s.label.toLowerCase()}`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,#0d1430,#0b1020)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>? Home</Link>
          <span style={{ color: "var(--line)" }}>|</span>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Practice - Spaced Repetition</h1>
        </div>
        <span className="badge badge-ok">?? On-device - no upload</span>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Signs mastered", value: mastered },
            { label: "Signs attempted", value: attempted },
            { label: "Due for review", value: queue.length },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".1em", textTransform: "uppercase" }}>{stat.label}</div>
              <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Review queue */}
        <section aria-labelledby="queue-heading">
          <h2 id="queue-heading" style={{ fontSize: 16, marginBottom: 12 }}>
            Due for review {queue.length > 0 && <span className="badge badge-warn" style={{ marginLeft: 8 }}>{queue.length}</span>}
          </h2>
          {queue.length === 0 ? (
            <div style={{ padding: "24px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--muted)", textAlign: "center" }}>
              <p style={{ margin: "0 0 12px", fontSize: 16 }}>No signs due for review right now.</p>
              <p style={{ margin: 0, fontSize: 14 }}>
                {attempted === 0
                  ? <>Start practicing to build your review queue. <Link href="/learn/asl/fingerspelling" style={{ color: "var(--accent)" }}>Begin with fingerspelling ?</Link></>
                  : "Check back later - your next review will appear here."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {queue.map((s) => (
                <Link key={s.id} href={getSignUrl(s)}
                  style={{ background: "var(--panel)", border: "1px solid rgba(255,184,107,.45)", borderRadius: 12, padding: "14px", textDecoration: "none", color: "var(--ink)", display: "flex", flexDirection: "column", gap: 6 }}
                  aria-label={`Review ${s.label} - ${s.successes}/${s.attempts} correct`}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "var(--warn)" }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>{s.type}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.successes}/{s.attempts} correct</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* All attempted signs */}
        {allSigns.length > 0 && (
          <section aria-labelledby="history-heading" style={{ marginTop: 32 }}>
            <h2 id="history-heading" style={{ fontSize: 16, marginBottom: 12 }}>All practiced signs</h2>
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Sign", "Type", "Attempts", "Successes", "Mastered", "Next review"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", borderBottom: "1px solid var(--line)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allSigns.map((s) => (
                    <tr key={s.id}>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                        <Link href={getSignUrl(s)} style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>{s.label}</Link>
                      </td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>{s.type}</td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{s.attempts}</td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>{s.successes}</td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                        {s.mastered ? <span className="badge badge-ok">? mastered</span> : <span className="badge">in progress</span>}
                      </td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                        {s.nextReview ? new Date(s.nextReview).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Start practicing CTA */}
        {attempted === 0 && (
          <div style={{ marginTop: 32, padding: "24px", background: "rgba(124,156,255,.06)", border: "1px solid rgba(124,156,255,.30)", borderRadius: 14, textAlign: "center" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>Start practicing to build your queue</h2>
            <p style={{ margin: "0 0 20px", color: "var(--muted)" }}>
              Practice signs in the lesson players and they will appear here for spaced repetition review.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/learn/asl/fingerspelling" style={{ background: "var(--accent)", color: "#0a0f24", padding: "10px 20px", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>
                Fingerspelling ?
              </Link>
              <Link href="/learn/asl/words" style={{ background: "var(--panel)", color: "var(--ink)", padding: "10px 20px", borderRadius: 8, fontWeight: 600, textDecoration: "none", border: "1px solid var(--line)" }}>
                Common signs ?
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
