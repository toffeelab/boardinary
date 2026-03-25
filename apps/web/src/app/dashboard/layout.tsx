import { Topbar } from "@/components/dashboard/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
