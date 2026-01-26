import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// DEBUG ENDPOINT - Cleans up orphaned users without organizations
export async function POST() {
  try {
    // Find users without any organization memberships
    const orphanedUsers = await db.user.findMany({
      where: {
        memberships: {
          none: {},
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (orphanedUsers.length > 0) {
      await db.user.deleteMany({
        where: {
          id: {
            in: orphanedUsers.map((u) => u.id),
          },
        },
      });
    }

    return NextResponse.json({
      deleted: orphanedUsers.length,
      deletedUsers: orphanedUsers.map((u) => u.email),
      message: `Cleaned up ${orphanedUsers.length} orphaned users`,
    });
  } catch (error) {
    console.error("Cleanup users error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
