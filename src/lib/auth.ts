import NextAuth from "next-auth";
import { db } from "./db";
import type { OrganizationRole, OrganizationType } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string | null;
    emailVerified?: Date | null;
    organizationId: string;
    organizationType: OrganizationType;
    organizationRole: OrganizationRole;
    organizationName: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      organizationId: string;
      organizationType: OrganizationType;
      organizationRole: OrganizationRole;
      organizationName: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    email?: string;
    name?: string | null;
    organizationId?: string;
    organizationType?: OrganizationType;
    organizationRole?: OrganizationRole;
    organizationName?: string;
    lastActivity?: number; // Unix timestamp of last activity
  }
}

// SECURITY: Idle timeout configuration (in seconds)
// Clients are logged out after 30 minutes of inactivity
// Agency users get 2 hours (they work longer sessions)
export const IDLE_TIMEOUT = {
  CLIENT: 30 * 60, // 30 minutes for clients
  AGENCY: 2 * 60 * 60, // 2 hours for agency users
} as const;

/**
 * NextAuth configuration for Basecamp
 *
 * Authentication is handled via magic links (passwordless).
 * Sessions are created by the magic link callback routes:
 * - /api/auth/callback/magic (for Agency/Client users)
 * - /api/auth/accept-invite (for invited users)
 *
 * This configuration is used for:
 * - Session validation in middleware
 * - JWT token verification
 * - Sign out functionality
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger }) {
      try {
        if (user) {
          // Initial login - set all user data and activity timestamp
          token.id = user.id;
          token.email = user.email as string;
          token.name = user.name;
          token.organizationId = user.organizationId;
          token.organizationType = user.organizationType;
          token.organizationRole = user.organizationRole;
          token.organizationName = user.organizationName;
          token.lastActivity = Math.floor(Date.now() / 1000);
        }

        // Update lastActivity on session refresh (triggered by client-side activity tracker)
        if (trigger === "update" && token.id) {
          token.lastActivity = Math.floor(Date.now() / 1000);
        }

        // SECURITY: Check idle timeout
        if (token.lastActivity && token.organizationType) {
          const now = Math.floor(Date.now() / 1000);
          const idleTime = now - (token.lastActivity as number);
          const maxIdleTime = token.organizationType === "CLIENT"
            ? IDLE_TIMEOUT.CLIENT
            : IDLE_TIMEOUT.AGENCY;

          if (idleTime > maxIdleTime) {
            // Session expired due to inactivity - return empty token to force re-login
            console.log(`[Auth] Session expired due to inactivity for ${token.email} (idle: ${idleTime}s, max: ${maxIdleTime}s)`);
            return {
              ...token,
              id: undefined,
              email: undefined,
              organizationId: undefined,
              organizationType: undefined,
              expired: true,
            };
          }
        }

        return token;
      } catch (error) {
        console.error("JWT callback error:", error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
        // Check if token was marked as expired
        if ((token as any).expired) {
          // Return a minimal session that will trigger re-login
          return {
            ...session,
            user: {
              id: "",
              email: "",
              name: null,
              organizationId: "",
              organizationType: "AGENCY" as OrganizationType,
              organizationRole: "MEMBER" as OrganizationRole,
              organizationName: "",
            },
            expired: true,
          };
        }

        // Validate token has required fields
        if (!token.id || !token.email || !token.organizationId || !token.organizationType) {
          // Return a minimal session that will trigger re-login
          return {
            ...session,
            user: {
              id: "",
              email: "",
              name: null,
              organizationId: "",
              organizationType: "AGENCY" as OrganizationType,
              organizationRole: "MEMBER" as OrganizationRole,
              organizationName: "",
            },
          };
        }

        return {
          ...session,
          user: {
            id: token.id as string,
            email: token.email as string,
            name: (token.name as string | null) ?? null,
            organizationId: token.organizationId as string,
            organizationType: token.organizationType as OrganizationType,
            organizationRole: (token.organizationRole as OrganizationRole) ?? "MEMBER",
            organizationName: (token.organizationName as string) ?? "",
          },
        };
      } catch (error) {
        console.error("Session callback error:", error);
        return {
          ...session,
          user: {
            id: "",
            email: "",
            name: null,
            organizationId: "",
            organizationType: "AGENCY" as OrganizationType,
            organizationRole: "MEMBER" as OrganizationRole,
            organizationName: "",
          },
        };
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth-error",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days (reduced for security)
  },
  secret: process.env.AUTH_SECRET,
});
