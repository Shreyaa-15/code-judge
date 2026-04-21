import { useState } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";

const LANGUAGES = ["python", "cpp", "java"];

const STARTER_CODE: Record<string, string> = {
  python: `# Write your Python code here
print("Hello, World!")`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`,
  java: `public class solution {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
};

type Result = {
  status: string;
  stdout: string;
  stderr: string;
};

function App() {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(STARTER_CODE["python"]);
  const [stdin, setStdin] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setCode(STARTER_CODE[lang]);
    setResult(null);
  };

  const pollResult = async (jobId: string) => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await axios.get(
        `http://localhost:8000/api/result/${jobId}`
      );
      if (res.data.status !== "queued" && res.data.status !== "running") {
        setResult(res.data);
        setLoading(false);
        return;
      }
    }
    setError("Timed out waiting for result");
    setLoading(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await axios.post("http://localhost:8000/api/submit", {
        code,
        language,
        stdin,
      });
      await pollResult(res.data.job_id);
    } catch (e) {
      setError("Failed to submit. Is the API running?");
      setLoading(false);
    }
  };

  const statusColor = () => {
    if (!result) return "#888";
    if (result.status === "success") return "#4ade80";
    return "#f87171";
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>⚡ Code Judge</span>
        <span style={styles.subtitle}>Distributed Execution Engine</span>
      </div>

      <div style={styles.main}>
        {/* Left panel - Editor */}
        <div style={styles.editorPanel}>
          {/* Language selector */}
          <div style={styles.toolbar}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                style={{
                  ...styles.langBtn,
                  ...(language === lang ? styles.langBtnActive : {}),
                }}
              >
                {lang}
              </button>
            ))}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                ...styles.runBtn,
                ...(loading ? styles.runBtnDisabled : {}),
              }}
            >
              {loading ? "⏳ Running..." : "▶ Run Code"}
            </button>
          </div>

          {/* Monaco Editor */}
          <Editor
            height="65vh"
            language={language === "cpp" ? "cpp" : language}
            value={code}
            onChange={(val) => setCode(val || "")}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on",
            }}
          />

          {/* Stdin */}
          <div style={styles.stdinBox}>
            <label style={styles.label}>stdin (optional)</label>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Input for your program..."
              style={styles.textarea}
              rows={3}
            />
          </div>
        </div>

        {/* Right panel - Results */}
        <div style={styles.resultPanel}>
          <div style={styles.resultHeader}>Output</div>

          {!result && !loading && !error && (
            <div style={styles.placeholder}>
              Run your code to see output here
            </div>
          )}

          {loading && (
            <div style={styles.placeholder}>
              ⏳ Executing in sandbox...
            </div>
          )}

          {error && <div style={styles.errorText}>{error}</div>}

          {result && (
            <>
              <div style={{ ...styles.statusBadge, color: statusColor() }}>
                ● {result.status.toUpperCase()}
              </div>

              {result.stdout && (
                <div style={styles.outputBox}>
                  <div style={styles.label}>stdout</div>
                  <pre style={styles.pre}>{result.stdout}</pre>
                </div>
              )}

              {result.stderr && (
                <div style={styles.outputBox}>
                  <div style={{ ...styles.label, color: "#f87171" }}>
                    stderr
                  </div>
                  <pre style={{ ...styles.pre, color: "#f87171" }}>
                    {result.stderr}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#0d1117",
    minHeight: "100vh",
    color: "#e6edf3",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    padding: "16px 24px",
    borderBottom: "1px solid #21262d",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  logo: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#58a6ff",
  },
  subtitle: {
    fontSize: "13px",
    color: "#8b949e",
  },
  main: {
    display: "flex",
    gap: "0",
    height: "calc(100vh - 57px)",
  },
  editorPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #21262d",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    background: "#161b22",
    borderBottom: "1px solid #21262d",
  },
  langBtn: {
    padding: "5px 14px",
    borderRadius: "6px",
    border: "1px solid #30363d",
    background: "transparent",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: "13px",
    textTransform: "capitalize",
  },
  langBtnActive: {
    background: "#1f6feb",
    border: "1px solid #1f6feb",
    color: "#fff",
  },
  runBtn: {
    marginLeft: "auto",
    padding: "6px 18px",
    borderRadius: "6px",
    border: "none",
    background: "#238636",
    color: "#fff",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
  },
  runBtnDisabled: {
    background: "#21262d",
    color: "#8b949e",
    cursor: "not-allowed",
  },
  stdinBox: {
    padding: "12px 16px",
    borderTop: "1px solid #21262d",
    background: "#161b22",
  },
  label: {
    fontSize: "11px",
    color: "#8b949e",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "6px",
    display: "block",
  },
  textarea: {
    width: "100%",
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: "6px",
    color: "#e6edf3",
    padding: "8px",
    fontSize: "13px",
    resize: "vertical",
    fontFamily: "monospace",
    boxSizing: "border-box",
  },
  resultPanel: {
    width: "380px",
    padding: "16px",
    background: "#161b22",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  resultHeader: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#8b949e",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  placeholder: {
    color: "#8b949e",
    fontSize: "14px",
    marginTop: "32px",
    textAlign: "center",
  },
  statusBadge: {
    fontSize: "14px",
    fontWeight: 600,
  },
  outputBox: {
    background: "#0d1117",
    border: "1px solid #21262d",
    borderRadius: "8px",
    padding: "12px",
  },
  pre: {
    margin: 0,
    fontSize: "13px",
    color: "#e6edf3",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    fontFamily: "monospace",
  },
  errorText: {
    color: "#f87171",
    fontSize: "14px",
  },
};

export default App;