"use client";

import Link from "next/link";
import { contactAvatarStyle } from "@/lib/contact-color";

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  photo: string | null;
  jobTitle: string | null;
};

export function RecentlyViewedStrip({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {contacts.map((c) => {
        const initials = `${c.firstName[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase();
        const style = contactAvatarStyle(c.firstName, c.lastName);
        return (
          <Link key={c.id} href={`/contacts/${c.id}`} className="relative group">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold select-none shrink-0 transition-transform group-hover:scale-110"
              style={c.photo ? undefined : style}
            >
              {c.photo ? (
                <img
                  src={c.photo}
                  alt=""
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                initials
              )}
            </div>
            {/* Hover card */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-sm whitespace-nowrap">
                <p className="font-medium">
                  {c.firstName} {c.lastName}
                </p>
                {c.jobTitle && (
                  <p className="text-xs text-muted-foreground">{c.jobTitle}</p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
