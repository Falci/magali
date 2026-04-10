"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Calendar,
  Settings,
  LogOut,
  Network,
  Tag,
  Menu,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/graph", label: "Graph", icon: Network },
];

const settingsSubItems = [
  { href: "/settings/general", label: "General" },
  { href: "/settings/field-types", label: "Field types" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/dav", label: "CalDAV / CardDAV" },
  { href: "/settings/import", label: "Import" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const onSettingsPath = pathname?.startsWith("/settings") ?? false;
  const [settingsExpanded, setSettingsExpanded] = useState(onSettingsPath);

  // Close sheet on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      <button
        id="mobile-nav-trigger"
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-64 p-0 gap-0 bg-card">
          {/* Header */}
          <div className="h-12 border-b flex items-center px-4 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg" onClick={() => setOpen(false)}>
              <span className="text-2xl">🍉</span>
              <span>Magali</span>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {mainNavItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
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
                {label}
              </Link>
            ))}

            {/* Settings with collapsible sub-items */}
            <div>
              <button
                type="button"
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

          {/* Sign out */}
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
        </SheetContent>
      </Sheet>
    </>
  );
}
