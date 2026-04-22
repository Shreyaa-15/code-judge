import { useState } from "react";
import { api } from "./api";

type Props = {
  onAuth: (token: string, username: string) => void;
};

export default function AuthPage({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError("");
    setLoading(true);
    try {
      const data =
        mode === "login"
          ? await api.login(username, password)
          : await api.register(username, email, password);
      onAuth(data.access_token, data.username);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.bg}>
      <div style={s.card}>
        <div style={s.logo}>⚡ Code Judge</div>
        <div style={s.subtitle}>Distributed Execution Engine</div>

        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(mode === "login" ? s.tabActive : {}) }}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Login
          </button>
          <button
            style={{ ...s.tab, ...(mode === "register" ? s.tabActive : {}) }}
            onClick={() => { setMode("register"); setError(""); }}
          >
            Register
          </button>
        </div>

        <div style={s.form}>
          <input
            style={s.input}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handle()}
          />
          {mode === "register" && (
            <input
              style={s.input}
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handle()}
            />
          )}
          <input
            style={s.input}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handle()}
          />

          {error && <div style={s.error}>{error}</div>}

          <button
            style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }}
            onClick={handle}
            disabled={loading}
          >
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    background: "#0d1117",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "12px",
    padding: "40px",
    width: "360px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  logo: { fontSize: "24px", fontWeight: 700, color: "#58a6ff", textAlign: "center" },
  subtitle: { fontSize: "13px", color: "#8b949e", textAlign: "center", marginTop: "-8px" },
  tabs: { display: "flex", gap: "8px" },
  tab: {
    flex: 1, padding: "8px", borderRadius: "6px",
    border: "1px solid #30363d", background: "transparent",
    color: "#8b949e", cursor: "pointer", fontSize: "14px",
  },
  tabActive: { background: "#1f6feb", border: "1px solid #1f6feb", color: "#fff" },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  input: {
    padding: "10px 12px", borderRadius: "6px",
    border: "1px solid #30363d", background: "#0d1117",
    color: "#e6edf3", fontSize: "14px", outline: "none",
  },
  btn: {
    padding: "10px", borderRadius: "6px", border: "none",
    background: "#238636", color: "#fff", cursor: "pointer",
    fontSize: "14px", fontWeight: 600,
  },
  btnDisabled: { background: "#21262d", color: "#8b949e", cursor: "not-allowed" },
  error: { color: "#f87171", fontSize: "13px", textAlign: "center" },
};