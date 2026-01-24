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
    redirect("/agency/dashboard");
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
          organization: {
            select: { name: true },
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

  return (
    <div className="flex h-screen bg-background">
      <ClientSidebar
        user={{
          name: userName,
          email: userEmail,
          avatarUrl: userAvatarUrl,
          organizationName: orgName,
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
