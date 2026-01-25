import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        twitterApiKey: true,
      },
    });

    return NextResponse.json({
      orgId: session.user.organizationId,
      orgName: org?.name,
      hasApiKey: !!org?.twitterApiKey,
      apiKeyPreview: org?.twitterApiKey ? `${org.twitterApiKey.slice(0, 15)}...${org.twitterApiKey.slice(-4)}` : null,
      apiKeyLength: org?.twitterApiKey?.length || 0,
    });
  } catch (error) {
    console.error("Test API key error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
