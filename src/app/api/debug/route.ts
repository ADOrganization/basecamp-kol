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
    debugInfo.session = session ? {
      userId: session.user?.id,
      email: session.user?.email,
      name: session.user?.name,
      organizationId: session.user?.organizationId,
      organizationType: session.user?.organizationType,
    } : null;
  } catch (e) {
    debugInfo.authError = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  }

  try {
    // Test DB connection
    const orgCount = await db.organization.count();
    debugInfo.dbConnected = true;
    debugInfo.orgCount = orgCount;
  } catch (e) {
    debugInfo.dbError = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  }

  try {
    // Test post query with hiddenFromReview
    const postCount = await db.post.count({
      where: { hiddenFromReview: false },
    });
    debugInfo.postCountWithHiddenFilter = postCount;
  } catch (e) {
    debugInfo.postQueryError = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  }

  // Test dashboard data fetch simulation
  try {
    const testOrg = await db.organization.findFirst({ where: { type: "AGENCY" } });
    if (testOrg) {
      const kols = await db.kOL.count({ where: { organizationId: testOrg.id } });
      const campaigns = await db.campaign.count({ where: { agencyId: testOrg.id } });
      const posts = await db.post.count({
        where: { campaign: { agencyId: testOrg.id } },
      });
      debugInfo.dashboardTest = { orgId: testOrg.id, kols, campaigns, posts };
    }
  } catch (e) {
    debugInfo.dashboardTestError = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  }

  return NextResponse.json(debugInfo);
}
