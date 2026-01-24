import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AgencySidebar } from "@/components/agency/sidebar";

export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.organizationType !== "AGENCY") {
    redirect("/client/dashboard");
  }

  return (
    <div className="flex h-screen bg-background">
      <AgencySidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          organizationName: session.user.organizationName,
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
