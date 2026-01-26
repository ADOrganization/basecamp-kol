import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Password management is disabled.
 * This application uses magic link (passwordless) authentication.
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { error: "Password management is not available. This application uses passwordless authentication via email links." },
    { status: 400 }
  );
}
