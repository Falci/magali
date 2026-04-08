import { requireSession } from "@/lib/session";
import Sidebar from "@/components/sidebar";
import HeaderSearch from "@/components/header-search";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="h-12 border-b flex items-center px-4 shrink-0 gap-4">
          <HeaderSearch />
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
