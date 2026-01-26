export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a1a2e]/80 via-[#0A0A0F] to-[#16213e]/50 -z-10"></div>
      {children}
    </div>
  );
}
