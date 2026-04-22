import { useState } from "react";
import Editor from "@monaco-editor/react";
import AuthPage from "./AuthPage";
import Leaderboard from "./Leaderboard";
import ContestPage from "./ContestPage";
import { api, streamResult } from "./api";

const LANGUAGES = ["python", "cpp", "java"];

const STARTER_CODE: Record<string, string> = {
  python: `# Write your Python code here\nprint("Hello, World!")`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
  java: `public class solution {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
};

type Result = { status: string; stdout: string; stderr: string };

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "");
  const [page, setPage] = useState<"editor" | "leaderboard" | "contests">("editor");
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(STARTER_CODE["python"]);
  const [stdin, setStdin] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = (t: string, u: string) => {
    localStorage.setItem("token", t);
    localStorage.setItem("username", u);
    setToken(t);
    setUsername(u);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken("");
    setUsername("");
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setCode(STARTER_CODE[lang]);
    setResult(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResult(null);
    setError("");
    setResult({ status: "running", stdout: "", stderr: "" });

    try {
      const res = await api.submit(code, language, stdin, token);
      const jobId = res.job_id;

      streamResult(
        jobId,
        (data) => setResult(data),
        (data) => {
          setResult(data);
          setLoading(false);
        }
      );
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  if (!token) return <AuthPage onAuth={handleAuth} />;

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.logo}>⚡ Code Judge</span>
        <div style={s.nav}>
          <button
            style={{ ...s.navBtn, ...(page === "editor" ? s.navBtnActive : {}) }}
            onClick={() => setPage("editor")}
          >Editor</button>
          <button
            style={{ ...s.navBtn, ...(page === "leaderboard" ? s.navBtnActive : {}) }}
            onClick={() => setPage("leaderboard")}
          >🏆 Leaderboard</button>
          <button
            style={{ ...s.navBtn, ...(page === "contests" ? s.navBtnActive : {}) }}
            onClick={() => setPage("contests")}
          >🏁 Contests</button>
        </div>
        <div style={s.userArea}>
          <span style={s.userBadge}>👤 {username}</span>
          <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {page === "leaderboard" && (
        <Leaderboard token={token} currentUser={username} />
      )}

      {page === "contests" && (
        <ContestPage token={token} username={username} />
      )}

      {page === "editor" && (
        <div style={s.main}>
          <div style={s.editorPanel}>
            <div style={s.toolbar}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  style={{ ...s.langBtn, ...(language === lang ? s.langBtnActive : {}) }}
                >{lang}</button>
              ))}
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{ ...s.runBtn, ...(loading ? s.runBtnDisabled : {}) }}
              >
                {loading ? "⏳ Running..." : "▶ Run Code"}
              </button>
            </div>

            <Editor
              height="65vh"
              language={language}
              value={code}
              onChange={(val) => setCode(val || "")}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
              }}
            />

            <div style={s.stdinBox}>
              <label style={s.label}>stdin (optional)</label>
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Input for your program..."
                style={s.textarea}
                rows={3}
              />
            </div>
          </div>

          <div style={s.resultPanel}>
            <div style={s.resultHeader}>Output</div>
            {!result && !loading && !error && (
              <div style={s.placeholder}>Run your code to see output here</div>
            )}
            {loading && result?.status === "running" && (
              <div style={s.placeholder}>
                <div style={{ marginBottom: "8px" }}>⚡ Executing in sandbox...</div>
                <div style={{ fontSize: "12px", color: "#58a6ff" }}>● Live via WebSocket</div>
              </div>
            )}
            {loading && result?.status === "queued" && (
              <div style={s.placeholder}>⏳ Waiting in queue...</div>
            )}
            {error && <div style={s.errorText}>{error}</div>}
            {result && !loading && (
              <>
                <div style={{
                  ...s.statusBadge,
                  color: result.status === "success" ? "#4ade80" : "#f87171"
                }}>
                  ● {result.status.toUpperCase()}
                </div>
                {result.stdout && (
                  <div style={s.outputBox}>
                    <div style={s.label}>stdout</div>
                    <pre style={s.pre}>{result.stdout}</pre>
                  </div>
                )}
                {result.stderr && (
                  <div style={s.outputBox}>
                    <div style={{ ...s.label, color: "#f87171" }}>stderr</div>
                    <pre style={{ ...s.pre, color: "#f87171" }}>{result.stderr}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { background: "#0d1117", minHeight: "100vh", color: "#e6edf3", fontFamily: "'Segoe UI', system-ui, sans-serif" },
  header: { padding: "12px 24px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", gap: "16px" },
  logo: { fontSize: "20px", fontWeight: 700, color: "#58a6ff", marginRight: "8px" },
  nav: { display: "flex", gap: "4px" },
  navBtn: { padding: "6px 14px", borderRadius: "6px", border: "1px solid transparent", background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: "13px" },
  navBtnActive: { background: "#21262d", border: "1px solid #30363d", color: "#e6edf3" },
  userArea: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" },
  userBadge: { fontSize: "13px", color: "#8b949e" },
  logoutBtn: { padding: "5px 12px", borderRadius: "6px", border: "1px solid #30363d", background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: "12px" },
  main: { display: "flex", height: "calc(100vh - 57px)" },
  editorPanel: { flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #21262d" },
  toolbar: { display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", background: "#161b22", borderBottom: "1px solid #21262d" },
  langBtn: { padding: "5px 14px", borderRadius: "6px", border: "1px solid #30363d", background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: "13px" },
  langBtnActive: { background: "#1f6feb", border: "1px solid #1f6feb", color: "#fff" },
  runBtn: { marginLeft: "auto", padding: "6px 18px", borderRadius: "6px", border: "none", background: "#238636", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600 },
  runBtnDisabled: { background: "#21262d", color: "#8b949e", cursor: "not-allowed" },
  stdinBox: { padding: "12px 16px", borderTop: "1px solid #21262d", background: "#161b22" },
  label: { fontSize: "11px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" },
  textarea: { width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: "6px", color: "#e6edf3", padding: "8px", fontSize: "13px", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box" },
  resultPanel: { width: "380px", padding: "16px", background: "#161b22", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" },
  resultHeader: { fontSize: "13px", fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px" },
  placeholder: { color: "#8b949e", fontSize: "14px", marginTop: "32px", textAlign: "center" },
  statusBadge: { fontSize: "14px", fontWeight: 600 },
  outputBox: { background: "#0d1117", border: "1px solid #21262d", borderRadius: "8px", padding: "12px" },
  pre: { margin: 0, fontSize: "13px", color: "#e6edf3", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace" },
  errorText: { color: "#f87171", fontSize: "14px" },
};