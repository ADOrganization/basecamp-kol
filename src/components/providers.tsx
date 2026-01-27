"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { IdleTimeoutTracker } from "./idle-timeout-tracker";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={true}
        disableTransitionOnChange
      >
        <IdleTimeoutTracker>{children}</IdleTimeoutTracker>
      </ThemeProvider>
    </SessionProvider>
  );
}
