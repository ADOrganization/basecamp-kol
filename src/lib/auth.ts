import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
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
    // KOL Portal fields
    kolId?: string;
    isKol?: boolean;
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
      // KOL Portal fields
      kolId?: string;
      isKol?: boolean;
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
    // KOL Portal fields
    kolId?: string;
    isKol?: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    // Agency/Client user credentials
    Credentials({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          const user = await db.user.findUnique({
            where: { email },
            include: {
              memberships: {
                include: {
                  organization: true,
                },
                take: 1,
              },
            },
          });

          if (!user) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

          if (!isPasswordValid) {
            return null;
          }

          const membership = user.memberships[0];

          if (!membership) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: null,
            organizationId: membership.organizationId,
            organizationType: membership.organization.type,
            organizationRole: membership.role,
            organizationName: membership.organization.name,
            isKol: false,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
    // KOL Portal credentials
    Credentials({
      id: "kol-credentials",
      name: "KOL Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          // Find KOL account by email
          const kolAccount = await db.kOLAccount.findUnique({
            where: { email },
            include: {
              kol: {
                include: {
                  organization: true,
                },
              },
            },
          });

          if (!kolAccount) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(password, kolAccount.passwordHash);

          if (!isPasswordValid) {
            return null;
          }

          // Update last login time
          await db.kOLAccount.update({
            where: { id: kolAccount.id },
            data: { lastLoginAt: new Date() },
          });

          return {
            id: kolAccount.id,
            email: kolAccount.email,
            name: kolAccount.kol.name,
            emailVerified: null,
            organizationId: kolAccount.kol.organizationId,
            organizationType: kolAccount.kol.organization.type,
            organizationRole: "MEMBER" as OrganizationRole,
            organizationName: kolAccount.kol.organization.name,
            kolId: kolAccount.kolId,
            isKol: true,
          };
        } catch (error) {
          console.error("KOL Auth error:", error);
          return null;
        }
      },
    }),
  ],
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
          token.kolId = user.kolId;
          token.isKol = user.isKol;
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
            kolId: token.kolId as string | undefined,
            isKol: token.isKol as boolean | undefined,
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
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET,
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
