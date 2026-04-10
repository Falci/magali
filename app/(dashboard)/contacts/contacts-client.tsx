"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Search, EyeOff, LayoutGrid, List } from "lucide-react";
import { contactAvatarStyle } from "@/lib/contact-color";

type Tag = { id: string; name: string; color: string | null };
type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  jobTitle: string | null;
  photo: string | null;
  staleDays: number | null;
  emails: { label: string; value: string }[];
  phones: { label: string; value: string }[];
  tags: { tag: Tag }[];
  _count: { interactions: number };
};

export default function ContactsClient({
  initialContacts,
  tags,
}: {
  initialContacts: Contact[];
  tags: Tag[];
}) {
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showDeprioritized, setShowDeprioritized] = useState(false);
  const [view, setView] = useState<"cards" | "list">("cards");

  useEffect(() => {
    const saved = localStorage.getItem("contacts-view");
    if (saved === "list" || saved === "cards") setView(saved);
  }, []);

  function setViewAndPersist(v: "cards" | "list") {
    setView(v);
    localStorage.setItem("contacts-view", v);
  }

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return initialContacts.filter((c) => {
      // staleDays === 0 means stale notification disabled → deprioritized
      if (!showDeprioritized && c.staleDays === 0) return false;

      const matchesQ =
        !q ||
        c.firstName.toLowerCase().includes(lower) ||
        (c.lastName ?? "").toLowerCase().includes(lower) ||
        (c.nickname ?? "").toLowerCase().includes(lower) ||
        (c.jobTitle ?? "").toLowerCase().includes(lower) ||
        c.emails.some((e) => e.value.toLowerCase().includes(lower));

      const matchesTag =
        !activeTag || c.tags.some((t) => t.tag.id === activeTag);

      return matchesQ && matchesTag;
    });
  }, [initialContacts, q, activeTag, showDeprioritized]);

  const deprioritizedCount = initialContacts.filter((c) => c.staleDays === 0).length;

  function initials(c: Contact) {
    return `${c.firstName[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} people</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {deprioritizedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeprioritized((v) => !v)}
              className="text-muted-foreground"
              title={showDeprioritized ? "Hide deprioritized" : `${deprioritizedCount} deprioritized hidden`}
            >
              <EyeOff className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">
                {showDeprioritized ? "Hide deprioritized" : `+${deprioritizedCount} hidden`}
              </span>
            </Button>
          )}
          <div className="flex rounded-md border overflow-hidden">
            <Button
              variant={view === "cards" ? "default" : "ghost"}
              size="sm"
              className="rounded-none border-0"
              onClick={() => setViewAndPersist("cards")}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none border-0 border-l"
              onClick={() => setViewAndPersist("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button render={<Link href="/contacts/new" />} size="sm">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Add contact</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={activeTag === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveTag(null)}
            >
              All
            </Badge>
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={activeTag === tag.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setActiveTag(tag.id === activeTag ? null : tag.id)}
                style={tag.color ? { borderColor: tag.color, color: activeTag === tag.id ? undefined : tag.color } : {}}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {q || activeTag ? "No contacts match your filter." : (
            <div className="space-y-2">
              <p className="text-4xl">👋</p>
              <p className="font-medium">No contacts yet</p>
              <p className="text-sm">Add your first contact to get started.</p>
            </div>
          )}
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => (
            <Link key={contact.id} href={`/contacts/${contact.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      {contact.photo ? (
                        <img src={contact.photo} alt="" className="h-full w-full object-cover rounded-full" />
                      ) : (
                        <AvatarFallback className="text-sm" style={contactAvatarStyle(contact.firstName, contact.lastName)}>{initials(contact)}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {contact.firstName} {contact.lastName}
                        {contact.nickname && (
                          <span className="text-muted-foreground text-sm font-normal"> "{contact.nickname}"</span>
                        )}
                      </p>
                      {contact.jobTitle && (
                        <p className="text-sm text-muted-foreground truncate">{contact.jobTitle}</p>
                      )}
                      {contact.emails[0] && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{contact.emails[0].value}</p>
                      )}
                      {contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {contact.tags.slice(0, 3).map(({ tag }) => (
                            <Badge key={tag.id} variant="secondary" className="text-xs px-1.5 py-0">
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {filtered.map((contact) => (
            <Link key={contact.id} href={`/contacts/${contact.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors">
              <Avatar className="h-7 w-7 shrink-0">
                {contact.photo ? (
                  <img src={contact.photo} alt="" className="h-full w-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="text-xs" style={contactAvatarStyle(contact.firstName, contact.lastName)}>{initials(contact)}</AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0 flex-1 flex items-center gap-4">
                <p className="font-medium text-sm truncate min-w-32">
                  {contact.firstName} {contact.lastName}
                  {contact.nickname && (
                    <span className="text-muted-foreground font-normal"> "{contact.nickname}"</span>
                  )}
                </p>
                {contact.jobTitle && (
                  <p className="text-sm text-muted-foreground truncate hidden sm:block">{contact.jobTitle}</p>
                )}
                {contact.emails[0] && (
                  <p className="text-xs text-muted-foreground truncate hidden md:block">{contact.emails[0].value}</p>
                )}
              </div>
              {contact.tags.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {contact.tags.slice(0, 2).map(({ tag }) => (
                    <Badge key={tag.id} variant="secondary" className="text-xs px-1.5 py-0">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
