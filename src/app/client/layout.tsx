import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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

  return (
    <div className="flex h-screen bg-background">
      <ClientSidebar
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
