const BASE = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

export const api = {
  async register(username: string, email: string, password: string) {
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Registration failed");
    }
    return res.json();
  },

  async login(username: string, password: string) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Login failed");
    }
    return res.json();
  },

  async submit(code: string, language: string, stdin: string, token: string) {
    const res = await fetch(`${BASE}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, language, stdin }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Submission failed");
    }
    return res.json();
  },

  async getResult(jobId: string) {
    const res = await fetch(`${BASE}/result/${jobId}`);
    return res.json();
  },

  async getLeaderboard() {
    const res = await fetch(`${BASE}/leaderboard`);
    return res.json();
  },

  async getHistory(token: string) {
    const res = await fetch(`${BASE}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },
};

export function streamResult(
  jobId: string,
  onUpdate: (data: any) => void,
  onDone: (data: any) => void
): WebSocket {
  const ws = new WebSocket(`ws://localhost:8000/api/ws/${jobId}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onUpdate(data);
    if (data.status !== "queued" && data.status !== "running") {
      onDone(data);
      ws.close();
    }
  };

  ws.onerror = () => {
    onDone({ status: "error", stdout: "", stderr: "WebSocket connection failed" });
  };

  return ws;
}