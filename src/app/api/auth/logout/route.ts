import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

export async function GET(request: NextRequest) {
  // SECURITY: Apply rate limiting to prevent logout flooding
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  const cookieStore = await cookies();

  // Clear all auth-related cookies
  const cookieNames = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.callback-url',
    '__Secure-authjs.callback-url',
    'authjs.csrf-token',
    '__Host-authjs.csrf-token',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
  ];

  for (const name of cookieNames) {
    cookieStore.delete(name);
  }

  return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'https://basecampnetwork.xyz'));
}

export async function POST(request: NextRequest) {
  return GET(request);
}
