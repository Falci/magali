import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getUpcomingEvents, getStaleContacts, getScheduledInteractions } from "@/lib/events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, UserPlus, Clock, Eye } from "lucide-react";
import { contactAvatarStyle } from "@/lib/contact-color";

const EVENT_EMOJI: Record<string, string> = {
  birthday: "🎂",
  anniversary: "💍",
  reminder: "🔔",
  custom: "📅",
};

export default async function DashboardPage() {
  const session = await requireSession();
  const [upcomingEvents, settings, totalContacts, scheduledInteractions, recentlyViewed] = await Promise.all([
    getUpcomingEvents(30),
    prisma.settings.findUnique({ where: { id: "singleton" }, select: { staleDays: true } }),
    prisma.contact.count(),
    getScheduledInteractions(),
    prisma.contact.findMany({
      where: { lastViewedAt: { not: null } },
      orderBy: { lastViewedAt: "desc" },
      take: 6,
      select: { id: true, firstName: true, lastName: true, photo: true, jobTitle: true, lastViewedAt: true },
    }),
  ]);
  const globalStaleDays = settings?.staleDays ?? 90;
  const staleContacts = await getStaleContacts(globalStaleDays);

  const firstName = session.user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Good morning, {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You have {totalContacts} contact{totalContacts !== 1 ? "s" : ""} in Magali.
        </p>
      </div>

      {scheduledInteractions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              Scheduled interactions <span className="text-muted-foreground font-normal">({scheduledInteractions.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scheduledInteractions.slice(0, 5).map((i: import("@/lib/events").ScheduledInteraction) => (
                <div key={i.id} className="flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <Link href={`/contacts/${i.contactId}`} className="font-medium hover:underline truncate">{i.contactName}</Link>
                    <p className="text-xs text-muted-foreground capitalize">{i.type}{i.notes ? ` — ${i.notes}` : ""}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">{format(i.date, "MMM d")}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {recentlyViewed.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Recently viewed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {recentlyViewed.map((c) => (
                <Link key={c.id} href={`/contacts/${c.id}`}>
                  <div className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted transition-colors text-sm">
                    <Avatar className="h-8 w-8 shrink-0">
                      {c.photo ? (
                        <img src={c.photo} alt="" className="h-full w-full object-cover rounded-full" />
                      ) : (
                        <AvatarFallback className="text-xs" style={contactAvatarStyle(c.firstName, c.lastName)}>
                          {c.firstName[0]}{c.lastName?.[0] ?? ""}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDistanceToNow(c.lastViewedAt!, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Upcoming events <span className="text-muted-foreground font-normal">(next 30 days)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing coming up. Enjoy the quiet!</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.slice(0, 8).map((ev: import("@/lib/events").UpcomingEvent) => (
                  <div key={ev.id} className="flex items-start gap-3 text-sm">
                    <span className="text-lg shrink-0">{EVENT_EMOJI[ev.type] ?? "📅"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ev.title}</p>
                      {ev.contactName && (
                        <Link href={`/contacts/${ev.contactId}`} className="text-xs text-muted-foreground hover:underline">
                          {ev.contactName}
                        </Link>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant={ev.daysUntil === 0 ? "default" : ev.daysUntil <= 3 ? "destructive" : "secondary"} className="text-xs">
                        {ev.daysUntil === 0 ? "Today" : ev.daysUntil === 1 ? "Tomorrow" : `${ev.daysUntil}d`}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(ev.nextDate, "MMM d")}
                      </p>
                    </div>
                  </div>
                ))}
                {upcomingEvents.length > 8 && (
                  <Button variant="ghost" size="sm" className="w-full" render={<Link href="/events" />}>
                    View all {upcomingEvents.length} events
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stale contacts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              People to reach out to
              <span className="text-muted-foreground font-normal">({globalStaleDays}+ days)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staleContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">You&apos;re all caught up! Great work staying in touch.</p>
            ) : (
              <div className="space-y-3">
                {staleContacts.slice(0, 8).map((c: { id: string; firstName: string; lastName: string | null; photo: string | null; lastInteraction: Date | null }) => (
                  <Link key={c.id} href={`/contacts/${c.id}`}>
                    <div className="flex items-center gap-3 text-sm hover:bg-muted rounded-md p-1 -m-1 transition-colors">
                      <Avatar className="h-7 w-7 shrink-0">
                        {c.photo ? (
                          <img src={c.photo} alt="" className="h-full w-full object-cover rounded-full" />
                        ) : (
                          <AvatarFallback className="text-xs" style={contactAvatarStyle(c.firstName, c.lastName)}>
                            {c.firstName[0]}{c.lastName?.[0] ?? ""}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <span className="flex-1 font-medium truncate">{c.firstName} {c.lastName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {c.lastInteraction
                          ? formatDistanceToNow(new Date(c.lastInteraction), { addSuffix: true })
                          : "Never"}
                      </span>
                    </div>
                  </Link>
                ))}
                {staleContacts.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{staleContacts.length - 8} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Button render={<Link href="/contacts/new" />}>
          <UserPlus className="h-4 w-4 mr-2" />Add contact
        </Button>
        <Button variant="outline" render={<Link href="/contacts" />}>
          <Users className="h-4 w-4 mr-2" />View all contacts
        </Button>
        <Button variant="outline" render={<Link href="/events" />}>
          <CalendarDays className="h-4 w-4 mr-2" />All events
        </Button>
      </div>
    </div>
  );
}
