"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsNav = [
  { href: "/settings/general", label: "General" },
  { href: "/settings/field-types", label: "Field types" },
  { href: "/settings/tags", label: "Tags" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/dav", label: "CalDAV / CardDAV" },
  { href: "/settings/import", label: "Import" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full gap-0">
      {/* Left sidebar nav */}
      <aside className="w-48 shrink-0 border-r pr-2">
        <div className="mb-3 px-3 pt-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings</h2>
        </div>
        <nav className="space-y-0.5">
          {settingsNav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto pl-6">
        {children}
      </div>
    </div>
  );
}
