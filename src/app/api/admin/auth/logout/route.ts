import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

export async function POST(request: NextRequest) {
  // SECURITY: Apply rate limiting to prevent logout flooding
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  const cookieStore = await cookies();
  cookieStore.delete("admin_token");

  return NextResponse.json({ success: true });
}
