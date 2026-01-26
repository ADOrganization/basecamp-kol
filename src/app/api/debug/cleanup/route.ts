import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// DEBUG ENDPOINT - Cleans up empty/demo organizations
// Keeps only organizations with actual data
export async function POST() {
  try {
    // Get all organizations with their data counts
    const organizations = await db.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        _count: {
          select: {
            kols: true,
            agencyCampaigns: true,
            clientCampaigns: true,
            members: true,
          },
        },
      },
    });

    const toDelete: string[] = [];
    const toKeep: string[] = [];

    for (const org of organizations) {
      const totalData = org._count.kols + org._count.agencyCampaigns + org._count.clientCampaigns;

      // Delete organizations that are:
      // 1. Empty (no KOLs, no campaigns) OR
      // 2. Demo data (name contains "Demo")
      if (totalData === 0 || org.name.toLowerCase().includes("demo")) {
        toDelete.push(org.id);
      } else {
        toKeep.push(org.name);
      }
    }

    // Delete empty/demo organizations
    if (toDelete.length > 0) {
      await db.organization.deleteMany({
        where: {
          id: {
            in: toDelete,
          },
        },
      });
    }

    return NextResponse.json({
      deleted: toDelete.length,
      kept: toKeep,
      message: `Cleaned up ${toDelete.length} organizations`,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
