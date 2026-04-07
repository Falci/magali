import { notFound } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatBirthday } from "@/lib/birthday";
import type {
  ContactEmail, ContactPhone, ContactAddress, Interaction,
  Relationship, Contact, Tag, ContactTag,
} from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, Briefcase, Cake, Edit, ArrowLeft } from "lucide-react";
import DeleteContactButton from "./delete-contact-button";
import AddInteractionForm from "./add-interaction-form";
import RelationshipsSection from "./relationships-section";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      emails: true,
      phones: true,
      addresses: true,
      tags: { include: { tag: true } },
      interactions: { orderBy: { date: "desc" }, take: 20 },
      events: { orderBy: { date: "asc" } },
      relationshipsFrom: { include: { to: true } },
      relationshipsTo: { include: { from: true } },
    },
  });

  if (!contact) notFound();

  const allContacts = await prisma.contact.findMany({
    where: { id: { not: id } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const initials = `${contact.firstName[0] ?? ""}${contact.lastName?.[0] ?? ""}`.toUpperCase();
  const lastInteraction = contact.interactions[0];
  const relationships = [
    ...contact.relationshipsFrom.map((r) => ({ ...r, other: r.to, direction: "from" as const })),
    ...contact.relationshipsTo.map((r) => ({ ...r, other: r.from, direction: "to" as const })),
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/contacts" />}>
          <ArrowLeft className="h-4 w-4 mr-1" />Contacts
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 shrink-0">
          {contact.photo ? (
            <img src={contact.photo} alt="" className="h-full w-full object-cover rounded-full" />
          ) : (
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          )}
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold">
            {contact.firstName} {contact.lastName}
            {contact.nickname && (
              <span className="text-muted-foreground text-lg font-normal ml-2">"{contact.nickname}"</span>
            )}
          </h1>
          {(contact.jobTitle || contact.company) && (
            <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
              <Briefcase className="h-3.5 w-3.5" />
              {[contact.jobTitle, contact.company].filter(Boolean).join(" at ")}
            </p>
          )}
          {contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {contact.tags.map(({ tag }) => (
                <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" render={<Link href={`/contacts/${id}/edit`} />}>
            <Edit className="h-4 w-4 mr-1" />Edit
          </Button>
          <DeleteContactButton contactId={id} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Contact info */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Contact info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {formatBirthday(contact) && (
              <div className="flex items-center gap-2">
                <Cake className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{formatBirthday(contact)}</span>
              </div>
            )}
            {contact.emails.map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${e.value}`} className="hover:underline truncate">{e.value}</a>
                <span className="text-xs text-muted-foreground ml-auto">{e.label}</span>
              </div>
            ))}
            {contact.phones.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`tel:${p.value}`} className="hover:underline">{p.value}</a>
                <span className="text-xs text-muted-foreground ml-auto">{p.label}</span>
              </div>
            ))}
            {contact.addresses.map((a) => (
              <div key={a.id} className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  {a.street && <div>{a.street}</div>}
                  {(a.city || a.state || a.zip) && (
                    <div>{[a.city, a.state, a.zip].filter(Boolean).join(", ")}</div>
                  )}
                  {a.country && <div>{a.country}</div>}
                </div>
                <span className="text-xs text-muted-foreground ml-auto">{a.label}</span>
              </div>
            ))}
            {!formatBirthday(contact) && !contact.emails.length && !contact.phones.length && !contact.addresses.length && (
              <p className="text-muted-foreground">No contact info yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Relationships */}
        <RelationshipsSection
          contactId={id}
          relationships={relationships}
          allContacts={allContacts}
        />
      </div>

      {/* Notes */}
      {contact.notes && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Interaction log */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Interaction log</CardTitle>
            {lastInteraction && (
              <span className="text-xs text-muted-foreground">
                Last: {formatDistanceToNow(new Date(lastInteraction.date), { addSuffix: true })}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddInteractionForm contactId={id} />
          <Separator />
          {contact.interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
          ) : (
            <div className="space-y-3">
              {contact.interactions.map((interaction) => (
                <div key={interaction.id} className="flex gap-3 text-sm">
                  <div className="shrink-0 text-xs text-muted-foreground w-24 pt-0.5">
                    {format(new Date(interaction.date), "MMM d, yyyy")}
                  </div>
                  <div>
                    <span className="font-medium capitalize">{interaction.type}</span>
                    {interaction.notes && (
                      <p className="text-muted-foreground mt-0.5">{interaction.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
