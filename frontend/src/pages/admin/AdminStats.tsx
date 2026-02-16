import { useEffect, useState } from "react";

type Alert = {
  user_id: string;
  cheating_score: number;
  flags: string[];
  at: string;
};

export default function AdminStats() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setAlerts((prev) => [data, ...prev]);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error", err);
    };

    return () => ws.close();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>🚨 Live Cheating Alerts</h2>

      {alerts.length === 0 && <p>No alerts yet</p>}

      {alerts.map((a, i) => (
        <div
          key={i}
          style={{
            border: "1px solid red",
            padding: 10,
            marginBottom: 10,
          }}
        >
          <strong>User:</strong> {a.user_id} <br />
          <strong>Score:</strong> {a.cheating_score} <br />
          <strong>Time:</strong> {new Date(a.at).toLocaleTimeString()}
          <pre>{JSON.stringify(a.flags, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
