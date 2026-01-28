import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import crypto from "crypto";
import { sendClientPortalAccessEmail } from "@/lib/email";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const addMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
});

// POST - Add a new member to a client organization
export async function POST(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = addMemberSchema.parse(body);

    // Verify client belongs to this agency's campaigns
    const client = await db.organization.findFirst({
      where: {
        id,
        type: "CLIENT",
        clientCampaigns: {
          some: {
            agencyId: authContext.organizationId,
          },
        },
      },
      include: {
        clientCampaigns: {
          where: { agencyId: authContext.organizationId },
          take: 1,
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const campaignName = client.clientCampaigns[0]?.name || client.name;

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
      include: {
        memberships: {
          where: { organizationId: id },
        },
      },
    });

    // If user already exists and is a member of this organization
    if (existingUser && existingUser.memberships.length > 0) {
      return NextResponse.json(
        { error: "This user is already a member of this client organization." },
        { status: 400 }
      );
    }

    // Create user and membership in a transaction
    const result = await db.$transaction(async (tx) => {
      let user;

      if (existingUser) {
        // User exists but is not a member of this org - use existing user
        user = existingUser;
        // Update name if not set
        if (!existingUser.name && validatedData.name) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { name: validatedData.name },
          });
        }
      } else {
        // Create new user
        user = await tx.user.create({
          data: {
            email: validatedData.email.toLowerCase(),
            name: validatedData.name,
          },
        });
      }

      // Create the membership
      await tx.organizationMember.create({
        data: {
          organizationId: id,
          userId: user.id,
          role: "MEMBER",
        },
      });

      // Create verification token for magic link
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await tx.verificationToken.create({
        data: {
          identifier: validatedData.email.toLowerCase(),
          token,
          expires,
        },
      });

      return {
        user: {
          id: user.id,
          email: validatedData.email.toLowerCase(),
          name: validatedData.name,
        },
        token,
      };
    });

    // Send invitation email with magic link
    const emailResult = await sendClientPortalAccessEmail(
      validatedData.email.toLowerCase(),
      result.token,
      campaignName,
      validatedData.name
    );

    return NextResponse.json({
      success: true,
      user: result.user,
      emailSent: emailResult.success,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error adding member:", error);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}

// GET - List all members of a client organization
export async function GET(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Apply rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.standard);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authContext = await getApiAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (authContext.organizationType !== "AGENCY" && !authContext.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify client belongs to this agency's campaigns
    const client = await db.organization.findFirst({
      where: {
        id,
        type: "CLIENT",
        clientCampaigns: {
          some: {
            agencyId: authContext.organizationId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                emailVerified: true,
                lastLoginAt: true,
              },
            },
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(client.members);
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}
