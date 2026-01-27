import { NextRequest, NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateClientSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required").optional(),
  userName: z.string().min(1, "Contact name is required").optional(),
  userEmail: z.string().email("Valid email is required").optional(),
});

// GET - Get single client details
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
              },
            },
          },
        },
        clientCampaigns: {
          where: {
            agencyId: authContext.organizationId,
          },
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

// PUT - Update client details
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const validatedData = updateClientSchema.parse(body);

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
            user: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const user = client.members[0]?.user;
    if (!user) {
      return NextResponse.json({ error: "Client user not found" }, { status: 404 });
    }

    // Check if new email is already in use by another user
    if (validatedData.userEmail && validatedData.userEmail !== user.email) {
      const existingUser = await db.user.findUnique({
        where: { email: validatedData.userEmail },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }
    }

    // Update in transaction
    await db.$transaction(async (tx) => {
      // Update organization name if provided
      if (validatedData.organizationName) {
        await tx.organization.update({
          where: { id },
          data: { name: validatedData.organizationName },
        });
      }

      // Update user details
      const userUpdateData: { name?: string; email?: string } = {};

      if (validatedData.userName) {
        userUpdateData.name = validatedData.userName;
      }

      if (validatedData.userEmail) {
        userUpdateData.email = validatedData.userEmail;
      }

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: userUpdateData,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}

// DELETE - Delete client account
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
        members: true,
        clientCampaigns: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      // Unassign campaigns from client
      await tx.campaign.updateMany({
        where: { clientId: id },
        data: { clientId: null },
      });

      // Delete organization members
      await tx.organizationMember.deleteMany({
        where: { organizationId: id },
      });

      // Delete users associated with this org (if they have no other memberships)
      for (const member of client.members) {
        const otherMemberships = await tx.organizationMember.count({
          where: {
            userId: member.userId,
            organizationId: { not: id },
          },
        });

        if (otherMemberships === 0) {
          await tx.user.delete({
            where: { id: member.userId },
          });
        }
      }

      // Delete the organization
      await tx.organization.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
