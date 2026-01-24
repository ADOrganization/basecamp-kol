import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const organizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = organizationSchema.parse(body);

    // Check if user has permission to update organization
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have permission to update organization settings" },
        { status: 403 }
      );
    }

    const updatedOrg = await db.organization.update({
      where: { id: session.user.organizationId },
      data: { name: validatedData.name },
      select: { id: true, name: true, slug: true },
    });

    return NextResponse.json(updatedOrg);
  } catch (error) {
    console.error("Error updating organization:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}
