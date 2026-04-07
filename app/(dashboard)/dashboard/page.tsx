import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getUpcomingEvents, getStaleContacts } from "@/lib/events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, UserPlus, Clock } from "lucide-react";

const EVENT_EMOJI: Record<string, string> = {
  birthday: "🎂",
  anniversary: "💍",
  reminder: "🔔",
  custom: "📅",
};

export default async function DashboardPage() {
  const session = await requireSession();
  const [upcomingEvents, staleContacts, totalContacts] = await Promise.all([
    getUpcomingEvents(30),
    getStaleContacts(90),
    prisma.contact.count(),
  ]);

  const firstName = session.user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Good morning, {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You have {totalContacts} contact{totalContacts !== 1 ? "s" : ""} in Magali.
        </p>
      </div>

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
                {upcomingEvents.slice(0, 8).map((ev) => (
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
                  <Button variant="ghost" size="sm" asChild className="w-full">
                    <Link href="/events">View all {upcomingEvents.length} events</Link>
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
              <span className="text-muted-foreground font-normal">(90+ days)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staleContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">You&apos;re all caught up! Great work staying in touch.</p>
            ) : (
              <div className="space-y-3">
                {staleContacts.slice(0, 8).map((c) => (
                  <Link key={c.id} href={`/contacts/${c.id}`}>
                    <div className="flex items-center gap-3 text-sm hover:bg-muted rounded-md p-1 -m-1 transition-colors">
                      <Avatar className="h-7 w-7 shrink-0">
                        {c.photo ? (
                          <img src={c.photo} alt="" className="h-full w-full object-cover rounded-full" />
                        ) : (
                          <AvatarFallback className="text-xs">
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
        <Button asChild>
          <Link href="/contacts/new"><UserPlus className="h-4 w-4 mr-2" />Add contact</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/contacts"><Users className="h-4 w-4 mr-2" />View all contacts</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/events"><CalendarDays className="h-4 w-4 mr-2" />All events</Link>
        </Button>
      </div>
    </div>
  );
}
