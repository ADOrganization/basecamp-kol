import { NextRequest, NextResponse } from "next/server";
import { auth, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createClientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.organizationType !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const validatedData = createClientSchema.parse(body);

    // Check if campaign exists and belongs to user's org
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        agencyId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Check if client is already assigned
    if (campaign.clientId) {
      return NextResponse.json(
        { error: "Campaign already has a client assigned" },
        { status: 400 }
      );
    }

    // Check if email is already taken
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Generate slug from organization name
    const baseSlug = validatedData.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check for unique slug
    let slug = baseSlug;
    let counter = 1;
    while (await db.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Hash password
    const passwordHash = await hashPassword(validatedData.password);

    // Create organization, user, and membership in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create client organization
      const organization = await tx.organization.create({
        data: {
          name: validatedData.organizationName,
          slug,
          type: "CLIENT",
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
          passwordHash,
        },
      });

      // Create membership
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      // Update campaign with client
      await tx.campaign.update({
        where: { id: campaignId },
        data: { clientId: organization.id },
      });

      return {
        organization,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    });

    return NextResponse.json({
      message: "Client account created successfully",
      client: {
        organizationId: result.organization.id,
        organizationName: result.organization.name,
        userId: result.user.id,
        userEmail: result.user.email,
        userName: result.user.name,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating client account:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create client account" },
      { status: 500 }
    );
  }
}
