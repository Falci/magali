"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Calendar,
  Settings,
  LogOut,
  Network,
  Tag,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "D" },
  { href: "/contacts", label: "Contacts", icon: Users, shortcut: "C" },
  { href: "/tags", label: "Tags", icon: Tag, shortcut: "T" },
  { href: "/events", label: "Events", icon: CalendarDays, shortcut: "E" },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/graph", label: "Graph", icon: Network, shortcut: "G" },
];

const settingsSubItems = [
  { href: "/settings/general", label: "General" },
  { href: "/settings/field-types", label: "Field types" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/dav", label: "CalDAV / CardDAV" },
  { href: "/settings/import", label: "Import / Export" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const onSettingsPath = pathname?.startsWith("/settings") ?? false;
  const [settingsExpanded, setSettingsExpanded] = useState(onSettingsPath);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex flex-col w-56 border-r bg-card shrink-0">
      <div className="h-12 border-b flex items-center px-4 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg">
          <span className="text-2xl">🍉</span>
          <span>Magali</span>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainNavItems.map(({ href, label, icon: Icon, shortcut }, index) => (
          <Link
            key={href}
            href={href}
            data-sidebar-item="true"
            {...(index === 0 ? { "data-sidebar-first-nav": "true" } : {})}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              href !== "/dashboard" && (pathname?.startsWith(href) ?? false)
                ? "bg-primary text-primary-foreground"
                : pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {shortcut && (
              <kbd className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border border-current/20 bg-current/10 text-[10px] font-mono opacity-60">
                {shortcut}
              </kbd>
            )}
          </Link>
        ))}

        {/* Settings with collapsible sub-items */}
        <div>
          <button
            type="button"
            data-sidebar-item="true"
            onClick={() => setSettingsExpanded((v) => !v)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left",
              onSettingsPath
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="flex-1">Settings</span>
            <kbd className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border border-current/20 bg-current/10 text-[10px] font-mono opacity-60 mr-1">
              S
            </kbd>
            {settingsExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
          </button>

          {settingsExpanded && (
            <div className="mt-0.5 space-y-0.5">
              {settingsSubItems.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center pl-9 pr-3 py-1.5 rounded-md text-xs transition-colors",
                    pathname === href
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
      <div className="p-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
