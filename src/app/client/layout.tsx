import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientSidebar } from "@/components/client/sidebar";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.organizationType !== "CLIENT") {
    redirect("/dashboard");
  }

  // Fetch fresh user data from database for sidebar (not cached in JWT)
  const freshUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      avatarUrl: true,
      memberships: {
        select: {
          organizationId: true,
          organization: {
            select: { name: true, logoUrl: true },
          },
        },
        take: 1,
      },
    },
  });

  const userName = freshUser?.name ?? session.user.name;
  const userEmail = freshUser?.email ?? session.user.email;
  const userAvatarUrl = freshUser?.avatarUrl ?? null;
  const orgName = freshUser?.memberships[0]?.organization.name ?? session.user.organizationName;
  const orgId = freshUser?.memberships[0]?.organizationId ?? session.user.organizationId;

  // Fetch the client's primary campaign to use its X profile picture and name as branding
  const clientCampaign = await db.campaign.findFirst({
    where: {
      OR: [
        { clientId: orgId },
        { campaignClients: { some: { clientId: orgId } } },
      ],
    },
    select: {
      name: true,
      projectAvatarUrl: true,
    },
    orderBy: [
      { status: "asc" }, // ACTIVE campaigns first
      { createdAt: "desc" },
    ],
  });

  const brandingName = clientCampaign?.name ?? orgName;
  const brandingLogo = clientCampaign?.projectAvatarUrl ?? null;

  return (
    <div className="flex h-screen bg-background">
      <ClientSidebar
        user={{
          name: userName,
          email: userEmail,
          avatarUrl: userAvatarUrl,
          organizationName: orgName,
        }}
        brandingName={brandingName}
        brandingLogo={brandingLogo}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
