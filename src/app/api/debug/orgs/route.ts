import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// DEBUG ENDPOINT - Remove in production
// Shows all organizations and their members to diagnose auth issues
export async function GET() {
  try {
    // Get all organizations with their members
    const organizations = await db.organization.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            kols: true,
            agencyCampaigns: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Get all admin users
    const adminUsers = await db.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    // Get all users
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type,
        createdAt: org.createdAt,
        memberCount: org.members.length,
        kolCount: org._count.kols,
        campaignCount: org._count.agencyCampaigns,
        members: org.members.map((m) => ({
          role: m.role,
          user: m.user,
        })),
      })),
      adminUsers,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        organizations: u.memberships.map((m) => ({
          orgId: m.organization.id,
          orgName: m.organization.name,
          orgType: m.organization.type,
          role: m.role,
        })),
      })),
    });
  } catch (error) {
    console.error("Debug orgs error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
