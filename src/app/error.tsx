"use client";

import { useEffect } from "react";

// SECURITY: Only show detailed errors in development
const isDevelopment = process.env.NODE_ENV === "development";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error for debugging (server-side logs only in production)
    console.error("App Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-lg p-6 border border-border">
        <h2 className="text-xl font-bold text-destructive mb-4">Something went wrong</h2>
        <div className="space-y-2 text-sm text-foreground">
          {/* SECURITY: Only show error details in development */}
          {isDevelopment ? (
            <>
              <p><strong>Message:</strong> {error.message}</p>
              {error.digest && <p><strong>Digest:</strong> {error.digest}</p>}
            </>
          ) : (
            <p>An unexpected error occurred. Please try again or contact support if the problem persists.</p>
          )}
          {error.digest && !isDevelopment && (
            <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
          )}
        </div>
        {/* SECURITY: Only show stack trace in development */}
        {isDevelopment && (
          <pre className="mt-4 p-3 bg-muted rounded text-xs overflow-auto max-h-48 text-muted-foreground">
            {error.stack}
          </pre>
        )}
        <button
          onClick={() => reset()}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
