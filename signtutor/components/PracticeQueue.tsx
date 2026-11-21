"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getReviewQueue,
  getMasteredCount,
  getTotalAttempted,
  getProgress,
  getFSRSConfig,
  simulateReviewSchedule,
  type SignProgress,
} from "@/lib/progress";

export default function PracticeQueue() {
  const [queue, setQueue] = useState<SignProgress[]>([]);
  const [mastered, setMastered] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [allSigns, setAllSigns] = useState<SignProgress[]>([]);
  const [fsrsConfig, setFsrsConfig] = useState<{ desiredRetention: number }>({ desiredRetention: 0.9 });
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationData, setSimulationData] = useState<Array<{ date: string; count: number }>>([]);

  useEffect(() => {
    setQueue(getReviewQueue());
    setMastered(getMasteredCount());
    setAttempted(getTotalAttempted());
    const store = getProgress();
    setAllSigns(Object.values(store.signs).sort((a, b) => (b.attempts - a.attempts)));
    setFsrsConfig({ desiredRetention: getFSRSConfig().desiredRetention });
  }, []);

  const getSignUrl = (s: SignProgress) =>
    s.type === "static"
      ? `/learn/asl/fingerspelling/${s.label}`
      : `/learn/asl/words/${s.label.toLowerCase()}`;

  const handleSimulate = async () => {
    const data = await simulateReviewSchedule(30);
    setSimulationData(data);
    setShowSimulation(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,#0d1430,#0b1020)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>← Home</Link>
          <span style={{ color: "var(--line)" }}>|</span>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Practice - Spaced Repetition (FSRS-5)</h1>
        </div>
        <span className="badge badge-ok">🔒 On-device - no upload</span>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Signs mastered", value: mastered },
            { label: "Signs attempted", value: attempted },
            { label: "Due for review", value: queue.length },
            { label: "Target retention", value: Math.round(fsrsConfig.desiredRetention * 100) + "%" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".1em", textTransform: "uppercase" }}>{stat.label}</div>
              <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <button
            onClick={handleSimulate}
            style={{
              background: "var(--panel)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            📊 Simulate 30-day review load
          </button>
          <Link
            href="/settings"
            style={{
              background: "var(--panel)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ⚙️ Adjust retention target
          </Link>
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
                  ? <>Start practicing to build your review queue. <Link href="/learn/asl/fingerspelling" style={{ color: "var(--accent)" }}>Begin with fingerspelling →</Link></>
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
                  <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                    Interval: {s.scheduled_days}d · Stability: {s.stability.toFixed(1)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Simulation Modal */}
        {showSimulation && (
          <div role="dialog" aria-modal="true" aria-labelledby="sim-title"
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: 28, maxWidth: 600, width: "100%", maxHeight: "80vh", overflow: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 id="sim-title" style={{ margin: 0, fontSize: 20 }}>30-Day Review Load Simulation</h2>
                <button onClick={() => setShowSimulation(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--muted)" }}>×</button>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
                Based on current FSRS-5 parameters (target retention: {Math.round(fsrsConfig.desiredRetention * 100)}%).
                Higher retention = more reviews. Adjust in Settings.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflow: "auto" }}>
                {simulationData.length === 0 ? (
                  <p style={{ color: "var(--muted)", textAlign: "center", padding: 24 }}>No upcoming reviews scheduled.</p>
                ) : (
                  simulationData.map((d) => (
                    <div key={d.date} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--panel2)", borderRadius: 8, border: "1px solid var(--line)" }}>
                      <span>{new Date(d.date).toLocaleDateString()}</span>
                      <span style={{ fontWeight: 700, color: d.count > 10 ? "var(--warn)" : "var(--ok)" }}>{d.count} reviews</span>
                    </div>
                  ))
                )}
              </div>
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button onClick={() => setShowSimulation(false)} style={{ background: "var(--accent)", color: "#0a0f24", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* All attempted signs */}
        {allSigns.length > 0 && (
          <section aria-labelledby="history-heading" style={{ marginTop: 32 }}>
            <h2 id="history-heading" style={{ fontSize: 16, marginBottom: 12 }}>All practiced signs</h2>
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Sign", "Type", "Attempts", "Successes", "Mastered", "Next review", "Stability", "Difficulty"].map((h) => (
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
                        {s.mastered ? <span className="badge badge-ok">✓ mastered</span> : <span className="badge">in progress</span>}
                      </td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                        {s.nextReview ? new Date(s.nextReview).toLocaleDateString() : "-"}
                      </td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontFamily: "monospace" }}>
                        {s.stability.toFixed(1)}
                      </td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontFamily: "monospace" }}>
                        {s.difficulty.toFixed(2)}
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
                Fingerspelling →
              </Link>
              <Link href="/learn/asl/words" style={{ background: "var(--panel)", color: "var(--ink)", padding: "10px 20px", borderRadius: 8, fontWeight: 600, textDecoration: "none", border: "1px solid var(--line)" }}>
                Common signs →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}