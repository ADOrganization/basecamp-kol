"use client";

// SECURITY: Only show detailed errors in development
const isDevelopment = process.env.NODE_ENV === "development";

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
        <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ color: "#dc2626" }}>Something went wrong!</h2>
          {/* SECURITY: Only show error details in development */}
          {isDevelopment ? (
            <>
              <p><strong>Error:</strong> {error.message}</p>
              {error.digest && <p><strong>Digest:</strong> {error.digest}</p>}
              <pre style={{
                background: "#f0f0f0",
                padding: "10px",
                overflow: "auto",
                maxWidth: "100%",
                fontSize: "12px"
              }}>
                {error.stack}
              </pre>
            </>
          ) : (
            <>
              <p>An unexpected error occurred. Please try again or contact support if the problem persists.</p>
              {error.digest && (
                <p style={{ fontSize: "12px", color: "#666" }}>Error ID: {error.digest}</p>
              )}
            </>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: "16px",
              padding: "8px 16px",
              backgroundColor: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
