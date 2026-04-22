import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { streamResult } from "./api";

type Problem = {
  id: string;
  title: string;
  description: string;
  sample_input: string;
  sample_output: string;
};

type Contest = {
  id: number;
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  problems: Problem[];
  status: string;
};

type LeaderboardEntry = {
  rank: number;
  username: string;
  solved: number;
  total_time_seconds: number;
  submissions: number;
};

type Props = { token: string; username: string };

const STARTER: Record<string, string> = {
  python: `# Write your solution here\n`,
  cpp: `#include <iostream>\nusing namespace std;\nint main() {\n    \n    return 0;\n}`,
  java: `public class solution {\n    public static void main(String[] args) {\n        \n    }\n}`,
};

function useCountdown(endTime: string) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return timeLeft;
}

export default function ContestPage({ token, username }: Props) {
  const [contests, setContests] = useState<Contest[]>([]);
  const [selected, setSelected] = useState<Contest | null>(null);
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(STARTER["python"]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [view, setView] = useState<"problems" | "leaderboard">("problems");
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const timeLeft = useCountdown(selected?.end_time || "");

  useEffect(() => {
    fetch("http://localhost:8000/api/contests")
      .then(r => r.json())
      .then(setContests);
  }, []);

  const selectContest = (c: Contest) => {
    setSelected(c);
    setActiveProblem(c.problems[0]);
    fetchLeaderboard(c.id);
  };

  const fetchLeaderboard = (contestId: number) => {
    fetch(`http://localhost:8000/api/contests/${contestId}/leaderboard`)
      .then(r => r.json())
      .then(setLeaderboard);
  };

  const handleSubmit = async () => {
    if (!selected || !activeProblem) return;
    setLoading(true);
    setResult({ status: "running", stdout: "", stderr: "" });

    try {
      const res = await fetch("http://localhost:8000/api/contests/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contest_id: selected.id,
          problem_id: activeProblem.id,
          code,
          language,
        }),
      });
      const data = await res.json();

      streamResult(
        data.job_id,
        (update) => setResult(update),
        (final) => {
          setResult(final);
          setLoading(false);
          if (final.status === "success") {
            setSolved(prev => new Set(Array.from(prev).concat(activeProblem.id)));
            fetchLeaderboard(selected.id);
          }
        }
      );
    } catch (e) {
      setResult({ status: "error", stdout: "", stderr: "Submission failed" });
      setLoading(false);
    }
  };

  if (!selected) {
    return (
      <div style={s.container}>
        <div style={s.header}>🏁 Contests</div>
        {contests.length === 0 && (
          <div style={s.empty}>No contests available yet.</div>
        )}
        {contests.map(c => (
          <div key={c.id} style={s.contestCard} onClick={() => selectContest(c)}>
            <div style={s.contestName}>{c.name}</div>
            <div style={s.contestDesc}>{c.description}</div>
            <div style={s.contestMeta}>
              <span style={{
                ...s.statusBadge,
                background: c.status === "live" ? "#166534" : c.status === "upcoming" ? "#1e3a5f" : "#3f3f46"
              }}>
                {c.status === "live" ? "🔴 LIVE" : c.status === "upcoming" ? "⏳ Upcoming" : "✅ Ended"}
              </span>
              <span style={s.metaText}>{c.problems.length} problems</span>
              <span style={s.metaText}>Ends {new Date(c.end_time).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={s.fullPage}>
      <div style={s.contestHeader}>
        <button style={s.backBtn} onClick={() => setSelected(null)}>← Back</button>
        <span style={s.contestTitle}>{selected.name}</span>
        <span style={s.countdown}>⏱ {timeLeft}</span>
        <div style={s.viewTabs}>
          <button
            style={{ ...s.viewTab, ...(view === "problems" ? s.viewTabActive : {}) }}
            onClick={() => setView("problems")}
          >Problems</button>
          <button
            style={{ ...s.viewTab, ...(view === "leaderboard" ? s.viewTabActive : {}) }}
            onClick={() => { setView("leaderboard"); fetchLeaderboard(selected.id); }}
          >🏆 Leaderboard</button>
        </div>
      </div>

      {view === "leaderboard" && (
        <div style={s.leaderboardContainer}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Rank", "User", "Solved", "Time", "Submissions"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(e => (
                <tr key={e.username} style={{
                  ...s.tr,
                  ...(e.username === username ? s.trHighlight : {})
                }}>
                  <td style={s.td}>{e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : `#${e.rank}`}</td>
                  <td style={s.td}>{e.username}</td>
                  <td style={s.td}>{e.solved}/{selected.problems.length}</td>
                  <td style={s.td}>{Math.floor(e.total_time_seconds / 60)}m {Math.floor(e.total_time_seconds % 60)}s</td>
                  <td style={s.td}>{e.submissions}</td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr><td colSpan={5} style={{ ...s.td, textAlign: "center", color: "#8b949e" }}>
                  No submissions yet. Be first!
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === "problems" && (
        <div style={s.problemLayout}>
          <div style={s.problemSidebar}>
            {selected.problems.map((p, i) => (
              <div
                key={p.id}
                style={{
                  ...s.problemItem,
                  ...(activeProblem?.id === p.id ? s.problemItemActive : {}),
                }}
                onClick={() => { setActiveProblem(p); setResult(null); }}
              >
                <span style={{ color: solved.has(p.id) ? "#4ade80" : "#8b949e" }}>
                  {solved.has(p.id) ? "✅" : `${i + 1}.`}
                </span>
                <span style={{ marginLeft: "8px" }}>{p.title}</span>
              </div>
            ))}
          </div>

          {activeProblem && (
            <div style={s.problemMain}>
              <div style={s.problemDesc}>
                <div style={s.problemTitle}>{activeProblem.title}</div>
                <div style={s.problemBody}>{activeProblem.description}</div>
                {activeProblem.sample_input && (
                  <div style={s.sampleBox}>
                    <div style={s.sampleLabel}>Sample Input</div>
                    <pre style={s.samplePre}>{activeProblem.sample_input}</pre>
                  </div>
                )}
                <div style={s.sampleBox}>
                  <div style={s.sampleLabel}>Sample Output</div>
                  <pre style={s.samplePre}>{activeProblem.sample_output}</pre>
                </div>
              </div>

              <div style={s.editorSection}>
                <div style={s.editorToolbar}>
                  {["python", "cpp", "java"].map(lang => (
                    <button
                      key={lang}
                      style={{ ...s.langBtn, ...(language === lang ? s.langBtnActive : {}) }}
                      onClick={() => { setLanguage(lang); setCode(STARTER[lang]); }}
                    >{lang}</button>
                  ))}
                  <button
                    style={{ ...s.runBtn, ...(loading ? s.runBtnDisabled : {}) }}
                    onClick={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? "⏳ Running..." : "▶ Submit"}
                  </button>
                </div>

                <Editor
                  height="40vh"
                  language={language}
                  value={code}
                  onChange={val => setCode(val || "")}
                  theme="vs-dark"
                  options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true }}
                />

                {result && (
                  <div style={s.resultBox}>
                    <span style={{
                      fontWeight: 600,
                      color: result.status === "success" ? "#4ade80"
                        : result.status === "wrong_answer" ? "#f87171"
                        : result.status === "running" ? "#facc15" : "#f87171"
                    }}>
                      ● {result.status === "wrong_answer" ? "WRONG ANSWER" : result.status.toUpperCase()}
                    </span>
                    {result.stdout && <pre style={s.resultPre}>{result.stdout}</pre>}
                    {result.stderr && <pre style={{ ...s.resultPre, color: "#f87171" }}>{result.stderr}</pre>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { padding: "24px", color: "#e6edf3" },
  header: { fontSize: "20px", fontWeight: 700, marginBottom: "20px", color: "#58a6ff" },
  empty: { color: "#8b949e", textAlign: "center", marginTop: "40px" },
  contestCard: { background: "#161b22", border: "1px solid #30363d", borderRadius: "10px", padding: "20px", marginBottom: "12px", cursor: "pointer" },
  contestName: { fontSize: "16px", fontWeight: 600, marginBottom: "6px" },
  contestDesc: { fontSize: "13px", color: "#8b949e", marginBottom: "12px" },
  contestMeta: { display: "flex", gap: "12px", alignItems: "center" },
  statusBadge: { padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, color: "#fff" },
  metaText: { fontSize: "12px", color: "#8b949e" },
  fullPage: { display: "flex", flexDirection: "column", height: "calc(100vh - 57px)" },
  contestHeader: { display: "flex", alignItems: "center", gap: "16px", padding: "10px 20px", background: "#161b22", borderBottom: "1px solid #21262d" },
  backBtn: { background: "transparent", border: "1px solid #30363d", color: "#8b949e", borderRadius: "6px", padding: "4px 10px", cursor: "pointer" },
  contestTitle: { fontWeight: 600, fontSize: "15px" },
  countdown: { marginLeft: "auto", color: "#facc15", fontWeight: 600, fontSize: "14px" },
  viewTabs: { display: "flex", gap: "4px" },
  viewTab: { padding: "5px 14px", borderRadius: "6px", border: "1px solid #30363d", background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: "13px" },
  viewTabActive: { background: "#21262d", color: "#e6edf3" },
  leaderboardContainer: { padding: "24px", overflowY: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 16px", borderBottom: "1px solid #21262d", color: "#8b949e", fontSize: "12px", textTransform: "uppercase" },
  tr: { borderBottom: "1px solid #21262d" },
  trHighlight: { background: "#1f2937" },
  td: { padding: "12px 16px", fontSize: "14px", color: "#e6edf3" },
  problemLayout: { display: "flex", flex: 1, overflow: "hidden" },
  problemSidebar: { width: "220px", borderRight: "1px solid #21262d", overflowY: "auto", padding: "12px 0" },
  problemItem: { padding: "10px 16px", cursor: "pointer", fontSize: "13px", color: "#e6edf3" },
  problemItemActive: { background: "#21262d", borderLeft: "3px solid #58a6ff" },
  problemMain: { flex: 1, display: "flex", overflow: "hidden" },
  problemDesc: { width: "340px", padding: "20px", borderRight: "1px solid #21262d", overflowY: "auto", fontSize: "14px" },
  problemTitle: { fontSize: "16px", fontWeight: 700, marginBottom: "12px", color: "#58a6ff" },
  problemBody: { color: "#e6edf3", lineHeight: 1.6, marginBottom: "16px" },
  sampleBox: { background: "#0d1117", border: "1px solid #21262d", borderRadius: "6px", padding: "12px", marginBottom: "12px" },
  sampleLabel: { fontSize: "11px", color: "#8b949e", textTransform: "uppercase", marginBottom: "6px" },
  samplePre: { margin: 0, fontSize: "13px", color: "#e6edf3", fontFamily: "monospace" },
  editorSection: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  editorToolbar: { display: "flex", gap: "8px", padding: "8px 12px", background: "#161b22", borderBottom: "1px solid #21262d", alignItems: "center" },
  langBtn: { padding: "4px 12px", borderRadius: "6px", border: "1px solid #30363d", background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: "12px" },
  langBtnActive: { background: "#1f6feb", border: "1px solid #1f6feb", color: "#fff" },
  runBtn: { marginLeft: "auto", padding: "5px 16px", borderRadius: "6px", border: "none", background: "#238636", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600 },
  runBtnDisabled: { background: "#21262d", color: "#8b949e", cursor: "not-allowed" },
  resultBox: { padding: "12px 16px", borderTop: "1px solid #21262d", background: "#0d1117" },
  resultPre: { margin: "8px 0 0", fontSize: "13px", color: "#e6edf3", fontFamily: "monospace", whiteSpace: "pre-wrap" },
};