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
    id: string;
    email: string;
    name: string | null;
    organizationId: string;
    organizationType: OrganizationType;
    organizationRole: OrganizationRole;
    organizationName: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
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
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          id: token.id as string,
          email: token.email as string,
          name: token.name as string | null,
          organizationId: token.organizationId as string,
          organizationType: token.organizationType as OrganizationType,
          organizationRole: token.organizationRole as OrganizationRole,
          organizationName: token.organizationName as string,
        },
      };
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
  secret: process.env.NEXTAUTH_SECRET,
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
