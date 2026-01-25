"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-lg p-6 text-white">
        <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Message:</strong> {error.message}</p>
          {error.digest && <p><strong>Digest:</strong> {error.digest}</p>}
        </div>
        <pre className="mt-4 p-3 bg-slate-900 rounded text-xs overflow-auto max-h-48 text-slate-300">
          {error.stack}
        </pre>
        <button
          onClick={() => reset()}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
