"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const sections = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["D"], description: "Dashboard" },
      { keys: ["C"], description: "Contacts" },
      { keys: ["E"], description: "Events" },
      { keys: ["G"], description: "Graph" },
      { keys: ["T"], description: "Tags" },
      { keys: ["S"], description: "Settings" },
      { keys: ["M"], description: "Side menu" },
    ],
  },
  {
    title: "Lists (Contacts & Tags)",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navigate items" },
      { keys: ["↵"], description: "Open highlighted item" },
      { keys: ["Esc"], description: "Clear highlight" },
    ],
  },
  {
    title: "Settings",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navigate sub-items" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { keys: ["?"], description: "Show this dialog" },
    ],
  },
];

export default function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-1">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {section.title}
              </p>
              <div className="space-y-1.5">
                {section.shortcuts.map(({ keys, description }) => (
                  <div key={keys.join("+")} className="flex items-center justify-between gap-4">
                    <span className="text-sm">{description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-[11px] text-muted-foreground">/</span>
                          )}
                          <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded border border-border bg-muted text-xs font-mono font-medium">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
