import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

const organizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export async function PUT(request: NextRequest) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = organizationSchema.parse(body);

    // Check if user has permission to update organization (admins bypass)
    if (!authContext.isAdmin) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: authContext.userId,
          organizationId: authContext.organizationId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: "You don't have permission to update organization settings" },
          { status: 403 }
        );
      }
    }

    const updatedOrg = await db.organization.update({
      where: { id: authContext.organizationId },
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
