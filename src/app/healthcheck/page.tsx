// Simple static page with no server components
export default function HealthCheck() {
  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>Health Check</h1>
      <p>If you can see this, basic rendering works.</p>
      <p>Timestamp: {new Date().toISOString()}</p>
    </div>
  );
}
