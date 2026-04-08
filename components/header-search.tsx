"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type ContactResult = {
  id: string;
  firstName: string;
  lastName: string | null;
  company: string | null;
};

export default function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length === 0) { setResults([]); return; }
    const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data: ContactResult[] = await res.json();
      setResults(data.slice(0, 6));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard shortcut: /
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const items = results;
  const totalItems = items.length + 1; // +1 for "add new contact"

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < items.length) {
        router.push(`/contacts/${items[activeIdx].id}`);
        setOpen(false);
        setQuery("");
      } else if (activeIdx === items.length) {
        router.push(`/contacts/new`);
        setOpen(false);
        setQuery("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search contacts… (/)"
          className="h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50"
        />
      </div>

      {open && (query.trim().length > 0 || results.length > 0) && (
        <div className="absolute top-full mt-1 w-full rounded-md border bg-popover shadow-md z-50 overflow-hidden">
          {results.length === 0 && query.trim().length > 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No contacts found</div>
          ) : (
            results.map((c, i) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                onClick={() => { setOpen(false); setQuery(""); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent",
                  activeIdx === i && "bg-accent"
                )}
              >
                <span className="font-medium">{c.firstName} {c.lastName}</span>
                {c.company && <span className="text-muted-foreground text-xs truncate">{c.company}</span>}
              </Link>
            ))
          )}
          <Link
            href={query.trim() ? `/contacts/new?name=${encodeURIComponent(query.trim())}` : "/contacts/new"}
            onClick={() => { setOpen(false); setQuery(""); }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm border-t hover:bg-accent text-muted-foreground",
              activeIdx === items.length && "bg-accent"
            )}
          >
            <UserPlus className="h-3.5 w-3.5 shrink-0" />
            {query.trim() ? `Add "${query.trim()}" as new contact` : "Add new contact"}
          </Link>
        </div>
      )}
    </div>
  );
}
