import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Portal | Basecamp Network",
  description: "Secure admin portal for Basecamp Network",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a1a2e]/80 via-[#0A0A0F] to-[#16213e]/50"></div>
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-[#6366F1]/8 rounded-full blur-[120px]"></div>
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-[#8B5CF6]/6 rounded-full blur-[100px]"></div>
      <main className="relative z-10 w-full">
        {children}
      </main>
    </div>
  );
}
