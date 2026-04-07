"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Search } from "lucide-react";

type Tag = { id: string; name: string; color: string | null };
type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  company: string | null;
  photo: string | null;
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

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return initialContacts.filter((c) => {
      const matchesQ =
        !q ||
        c.firstName.toLowerCase().includes(lower) ||
        (c.lastName ?? "").toLowerCase().includes(lower) ||
        (c.nickname ?? "").toLowerCase().includes(lower) ||
        (c.company ?? "").toLowerCase().includes(lower) ||
        c.emails.some((e) => e.value.toLowerCase().includes(lower));

      const matchesTag =
        !activeTag || c.tags.some((t) => t.tag.id === activeTag);

      return matchesQ && matchesTag;
    });
  }, [initialContacts, q, activeTag]);

  function initials(c: Contact) {
    return `${c.firstName[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} people</p>
        </div>
        <Button render={<Link href="/contacts/new" />}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add contact
        </Button>
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
      ) : (
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
                        <AvatarFallback className="text-sm">{initials(contact)}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {contact.firstName} {contact.lastName}
                        {contact.nickname && (
                          <span className="text-muted-foreground text-sm font-normal"> "{contact.nickname}"</span>
                        )}
                      </p>
                      {contact.company && (
                        <p className="text-sm text-muted-foreground truncate">{contact.company}</p>
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
      )}
    </div>
  );
}
