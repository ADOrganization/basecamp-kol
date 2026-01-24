import { NextRequest, NextResponse } from "next/server";
import { auth, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is owner or admin
    const membership = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can invite members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = inviteSchema.parse(body);

    // Check if user already exists
    let user = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (user) {
      // Check if already a member of this organization
      const existingMembership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: session.user.organizationId,
            userId: user.id,
          },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: "User is already a member of this organization" },
          { status: 400 }
        );
      }
    } else {
      // Create new user with temporary password
      const tempPassword = Math.random().toString(36).slice(-12);
      const passwordHash = await hashPassword(tempPassword);

      user = await db.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
          passwordHash,
        },
      });

      // TODO: In production, send email with password reset link
      console.log(`Created user ${validatedData.email} with temp password: ${tempPassword}`);
    }

    // Add user to organization
    const newMembership = await db.organizationMember.create({
      data: {
        organizationId: session.user.organizationId,
        userId: user.id,
        role: validatedData.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: newMembership.id,
      userId: newMembership.userId,
      role: newMembership.role,
      user: newMembership.user,
    });
  } catch (error) {
    console.error("Error inviting member:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to invite member" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const members = await db.organizationMember.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}
