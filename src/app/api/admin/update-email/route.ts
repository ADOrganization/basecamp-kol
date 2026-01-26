import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// One-time endpoint to update admin email
// Protected by ADMIN_SETUP_SECRET
export async function POST(req: NextRequest) {
  try {
    const { setupSecret, oldEmail, newEmail } = await req.json();

    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    if (!expectedSecret || setupSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!oldEmail || !newEmail) {
      return NextResponse.json({ error: "Both oldEmail and newEmail are required" }, { status: 400 });
    }

    const admin = await db.adminUser.update({
      where: { email: oldEmail.toLowerCase() },
      data: { email: newEmail.toLowerCase() },
      select: { id: true, email: true, role: true },
    });

    return NextResponse.json({
      success: true,
      message: "Admin email updated",
      admin,
    });
  } catch (error) {
    console.error("Update email error:", error);
    return NextResponse.json({ error: "Failed to update email" }, { status: 500 });
  }
}
