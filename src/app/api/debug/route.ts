import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const debugInfo: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasAuthSecret: !!process.env.AUTH_SECRET,
      nodeEnv: process.env.NODE_ENV,
    },
  };

  try {
    // Test auth
    const session = await auth();
    debugInfo.session = session ? { userId: session.user?.id, email: session.user?.email } : null;
  } catch (e) {
    debugInfo.authError = e instanceof Error ? e.message : String(e);
  }

  try {
    // Test DB connection
    const orgCount = await db.organization.count();
    debugInfo.dbConnected = true;
    debugInfo.orgCount = orgCount;
  } catch (e) {
    debugInfo.dbError = e instanceof Error ? e.message : String(e);
  }

  try {
    // Test post query with hiddenFromReview
    const postCount = await db.post.count({
      where: { hiddenFromReview: false },
    });
    debugInfo.postCountWithHiddenFilter = postCount;
  } catch (e) {
    debugInfo.postQueryError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(debugInfo);
}
