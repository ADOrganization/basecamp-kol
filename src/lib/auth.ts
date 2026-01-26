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
  }
}

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
    async jwt({ token, user }) {
      try {
        if (user) {
          token.id = user.id;
          token.email = user.email as string;
          token.name = user.name;
          token.organizationId = user.organizationId;
          token.organizationType = user.organizationType;
          token.organizationRole = user.organizationRole;
          token.organizationName = user.organizationName;
        }
        return token;
      } catch (error) {
        console.error("JWT callback error:", error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
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
