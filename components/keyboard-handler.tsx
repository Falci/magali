"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import KeyboardShortcutsModal from "./keyboard-shortcuts-modal";

const settingsSubPaths = [
  "/settings/general",
  "/settings/field-types",
  "/settings/notifications",
  "/settings/dav",
  "/settings/import",
];

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

function getSidebarItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll("[data-sidebar-item]")) as HTMLElement[];
}

function isSidebarItemFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return el?.hasAttribute("data-sidebar-item") ?? false;
}

export default function KeyboardHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isInputFocused()) return;

      // Sidebar arrow navigation (when a sidebar item is focused via M)
      if (isSidebarItemFocused()) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const items = getSidebarItems();
          const idx = items.indexOf(document.activeElement as HTMLElement);
          const next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
          if (next >= 0 && next < items.length) items[next].focus();
          return;
        }
        if (e.key === "Escape") {
          (document.activeElement as HTMLElement).blur();
          return;
        }
      }

      switch (e.key) {
        case "d":
        case "D":
          router.push("/dashboard");
          break;
        case "c":
        case "C":
          router.push("/contacts");
          break;
        case "e":
        case "E":
          router.push("/events");
          break;
        case "g":
        case "G":
          router.push("/graph");
          break;
        case "t":
        case "T":
          router.push("/tags");
          break;
        case "s":
        case "S":
          router.push("/settings/general");
          break;
        case "m":
        case "M":
          if (window.innerWidth < 768) {
            (document.getElementById("mobile-nav-trigger") as HTMLElement)?.click();
          } else {
            getSidebarItems()[0]?.focus();
          }
          break;
        case "?":
          setHelpOpen(true);
          break;
        case "Backspace":
        case "Delete": {
          const tagMatch = pathname?.match(/^\/tags\/([^/]+)$/);
          if (tagMatch) { router.push("/tags"); break; }
          const contactMatch = pathname?.match(/^\/contacts\/([^/]+)$/);
          if (contactMatch) { router.push("/contacts"); break; }
          break;
        }
        case "ArrowDown":
          if (pathname?.startsWith("/settings")) {
            const idx = settingsSubPaths.indexOf(pathname);
            if (idx >= 0 && idx < settingsSubPaths.length - 1) {
              e.preventDefault();
              router.push(settingsSubPaths[idx + 1]);
            }
          }
          break;
        case "ArrowUp":
          if (pathname?.startsWith("/settings")) {
            const idx = settingsSubPaths.indexOf(pathname);
            if (idx > 0) {
              e.preventDefault();
              router.push(settingsSubPaths[idx - 1]);
            }
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, pathname]);

  return <KeyboardShortcutsModal open={helpOpen} onOpenChange={setHelpOpen} />;
}
