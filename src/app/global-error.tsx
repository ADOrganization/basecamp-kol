"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: "20px", fontFamily: "monospace" }}>
          <h2>Something went wrong!</h2>
          <p><strong>Error:</strong> {error.message}</p>
          <p><strong>Digest:</strong> {error.digest}</p>
          <pre style={{
            background: "#f0f0f0",
            padding: "10px",
            overflow: "auto",
            maxWidth: "100%"
          }}>
            {error.stack}
          </pre>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
