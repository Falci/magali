"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ContactOption = {
  id: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
};

type Props = {
  contacts: ContactOption[];
  value: string | null; // contact id, or null
  onChange: (contactId: string | null, isNew: false) => void;
  onCreateNew: (firstName: string) => void;
  placeholder?: string;
};

export function ContactCombobox({ contacts, value, onChange, onCreateNew, placeholder = "Search contacts…" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = contacts.find((c) => c.id === value);

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const full = `${c.firstName} ${c.lastName ?? ""}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  const trimmed = search.trim();
  const exactMatch = contacts.some(
    (c) => `${c.firstName} ${c.lastName ?? ""}`.toLowerCase() === trimmed.toLowerCase()
  );
  const canCreate = trimmed !== "" && !exactMatch;

  function select(id: string) {
    onChange(id, false);
    setOpen(false);
    setSearch("");
  }

  function handleCreate() {
    onCreateNew(trimmed);
    setOpen(false);
    setSearch("");
  }

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const displayName = selected
    ? `${selected.firstName}${selected.lastName ? " " + selected.lastName : ""}`
    : null;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger
        type="button"
        className="flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className={cn("flex-1 truncate text-left", !displayName && "text-muted-foreground")}>
          {displayName ?? placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-1">
        <div className="p-1 pb-1.5">
          <Input
            ref={inputRef}
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-sm"
          />
        </div>
        <div className="max-h-52 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-muted"
              onClick={() => select(c.id)}
            >
              <Check className={cn("size-3.5 shrink-0", c.id === value ? "opacity-100" : "opacity-0")} />
              {c.firstName} {c.lastName}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-muted text-muted-foreground"
              onClick={handleCreate}
            >
              <UserPlus className="size-3.5 shrink-0" />
              Add new: <span className="font-medium text-foreground ml-1">{trimmed}</span>
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <p className="py-3 text-center text-sm text-muted-foreground">No contacts found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
