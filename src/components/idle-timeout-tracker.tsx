"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useCallback, useState } from "react";
import { IDLE_TIMEOUT } from "@/lib/auth";

// How often to check for activity and refresh session (5 minutes)
const ACTIVITY_CHECK_INTERVAL = 5 * 60 * 1000;

// Show warning this many seconds before timeout
const WARNING_BEFORE_TIMEOUT = 2 * 60; // 2 minutes warning

interface IdleTimeoutTrackerProps {
  children: React.ReactNode;
}

export function IdleTimeoutTracker({ children }: IdleTimeoutTrackerProps) {
  const { data: session, update } = useSession();
  const lastActivityRef = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Get timeout based on organization type
  const getTimeoutMs = useCallback(() => {
    if (!session?.user?.organizationType) return IDLE_TIMEOUT.AGENCY * 1000;
    return session.user.organizationType === "CLIENT"
      ? IDLE_TIMEOUT.CLIENT * 1000
      : IDLE_TIMEOUT.AGENCY * 1000;
  }, [session?.user?.organizationType]);

  // Track user activity
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
    }
  }, [showWarning]);

  // Refresh session to update lastActivity on server
  const refreshSession = useCallback(async () => {
    if (session?.user?.id) {
      try {
        await update();
      } catch (error) {
        console.error("Failed to refresh session:", error);
      }
    }
  }, [session?.user?.id, update]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    await signOut({ callbackUrl: "/login?reason=idle" });
  }, []);

  // Extend session (user clicked "Stay logged in")
  const handleExtendSession = useCallback(() => {
    handleActivity();
    refreshSession();
  }, [handleActivity, refreshSession]);

  // Set up activity listeners
  useEffect(() => {
    if (!session?.user?.id) return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

    // Throttled activity handler (max once per second)
    let lastUpdate = 0;
    const throttledHandler = () => {
      const now = Date.now();
      if (now - lastUpdate > 1000) {
        lastUpdate = now;
        handleActivity();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, throttledHandler, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledHandler);
      });
    };
  }, [session?.user?.id, handleActivity]);

  // Check for idle timeout and refresh session periodically
  useEffect(() => {
    if (!session?.user?.id) return;

    const timeoutMs = getTimeoutMs();
    const warningMs = WARNING_BEFORE_TIMEOUT * 1000;

    const checkActivity = () => {
      const idleTime = Date.now() - lastActivityRef.current;
      const remaining = timeoutMs - idleTime;

      // If past timeout, log out
      if (remaining <= 0) {
        handleLogout();
        return;
      }

      // If within warning window, show warning
      if (remaining <= warningMs && !showWarning) {
        setShowWarning(true);
      }

      // Update time remaining for warning display
      if (showWarning) {
        setTimeRemaining(Math.ceil(remaining / 1000));
      }

      // If user was active recently, refresh session
      if (idleTime < ACTIVITY_CHECK_INTERVAL) {
        refreshSession();
      }
    };

    // Check immediately
    checkActivity();

    // Check periodically
    const intervalId = setInterval(checkActivity, showWarning ? 1000 : ACTIVITY_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [session?.user?.id, getTimeoutMs, refreshSession, handleLogout, showWarning]);

  // Don't show warning for agency users (they have longer timeout and are working)
  const shouldShowWarning = showWarning && session?.user?.organizationType === "CLIENT";

  return (
    <>
      {children}
      {shouldShowWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
              Session Expiring Soon
            </h2>
            <p className="mb-4 text-zinc-600 dark:text-zinc-400">
              You will be logged out in{" "}
              <span className="font-mono font-bold text-orange-600">
                {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
              </span>{" "}
              due to inactivity.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleExtendSession}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Stay Logged In
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
