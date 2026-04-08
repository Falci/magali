"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function LabelCombobox({
  value,
  onChange,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = suggestions.filter(
    (s) => !search || s.toLowerCase().includes(search.toLowerCase())
  );
  const canCreate =
    search.trim() !== "" &&
    !suggestions.some((s) => s.toLowerCase() === search.trim().toLowerCase());

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger
        type="button"
        className="flex h-8 w-28 shrink-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex-1 truncate text-left">{value}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-44 p-1">
        <div className="p-1 pb-1.5">
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-sm"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-muted"
              onClick={() => select(s)}
            >
              <Check
                className={cn(
                  "size-3.5 shrink-0",
                  s === value ? "opacity-100" : "opacity-0"
                )}
              />
              {s}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-muted text-muted-foreground"
              onClick={() => select(search.trim())}
            >
              <Plus className="size-3.5 shrink-0" />
              Create &ldquo;{search.trim()}&rdquo;
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              No options found
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
