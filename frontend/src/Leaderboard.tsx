import { useEffect, useState } from "react";
import { api } from "./api";

type Entry = {
  rank: number;
  username: string;
  total_submissions: number;
  successful: number;
  success_rate: number;
};

type HistoryItem = {
  job_id: string;
  language: string;
  status: string;
  execution_time: number;
  created_at: string;
};

type Props = { token: string; currentUser: string };

export default function Leaderboard({ token, currentUser }: Props) {
  const [board, setBoard] = useState<Entry[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tab, setTab] = useState<"board" | "history">("board");

  useEffect(() => {
    api.getLeaderboard().then(setBoard);
    api.getHistory(token).then(setHistory);
  }, [token]);

  const statusColor = (s: string) =>
    s === "success" ? "#4ade80" : s === "queued" ? "#facc15" : "#f87171";

  return (
    <div style={s.container}>
      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(tab === "board" ? s.tabActive : {}) }}
          onClick={() => setTab("board")}
        >
          🏆 Leaderboard
        </button>
        <button
          style={{ ...s.tab, ...(tab === "history" ? s.tabActive : {}) }}
          onClick={() => setTab("history")}
        >
          📜 My History
        </button>
      </div>

      {tab === "board" && (
        <table style={s.table}>
          <thead>
            <tr>
              {["Rank", "User", "Submissions", "Solved", "Success Rate"].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.map((e) => (
              <tr
                key={e.username}
                style={{
                  ...s.tr,
                  ...(e.username === currentUser ? s.trHighlight : {}),
                }}
              >
                <td style={s.td}>
                  {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : `#${e.rank}`}
                </td>
                <td style={s.td}>{e.username}</td>
                <td style={s.td}>{e.total_submissions}</td>
                <td style={s.td}>{e.successful}</td>
                <td style={s.td}>
                  <span style={{ color: e.success_rate >= 70 ? "#4ade80" : "#f87171" }}>
                    {e.success_rate}%
                  </span>
                </td>
              </tr>
            ))}
            {board.length === 0 && (
              <tr><td colSpan={5} style={{ ...s.td, textAlign: "center", color: "#8b949e" }}>
                No submissions yet. Be the first!
              </td></tr>
            )}
          </tbody>
        </table>
      )}

      {tab === "history" && (
        <table style={s.table}>
          <thead>
            <tr>
              {["Language", "Status", "Time (s)", "Submitted"].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.job_id} style={s.tr}>
                <td style={s.td}>{h.language}</td>
                <td style={{ ...s.td, color: statusColor(h.status), fontWeight: 600 }}>
                  {h.status.toUpperCase()}
                </td>
                <td style={s.td}>{h.execution_time.toFixed(3)}</td>
                <td style={s.td}>{new Date(h.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={4} style={{ ...s.td, textAlign: "center", color: "#8b949e" }}>
                No submissions yet
              </td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { padding: "24px", overflowX: "auto" },
  tabs: { display: "flex", gap: "8px", marginBottom: "20px" },
  tab: {
    padding: "8px 20px", borderRadius: "6px",
    border: "1px solid #30363d", background: "transparent",
    color: "#8b949e", cursor: "pointer", fontSize: "14px",
  },
  tabActive: { background: "#1f6feb", border: "1px solid #1f6feb", color: "#fff" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", padding: "10px 16px",
    borderBottom: "1px solid #21262d", color: "#8b949e",
    fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px",
  },
  tr: { borderBottom: "1px solid #21262d" },
  trHighlight: { background: "#1f2937" },
  td: { padding: "12px 16px", fontSize: "14px", color: "#e6edf3" },
};