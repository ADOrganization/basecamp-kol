import { NextRequest, NextResponse } from "next/server";

/**
 * Public registration is disabled.
 * Users join organizations via invitation links sent by admins.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Registration is disabled",
      message: "Please ask your organization administrator to send you an invitation link.",
    },
    { status: 400 }
  );
}
