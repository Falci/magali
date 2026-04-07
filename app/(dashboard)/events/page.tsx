import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getUpcomingEvents } from "@/lib/events";
import EventsClient from "./events-client";

export default async function EventsPage() {
  await requireSession();

  const [upcomingEvents, contacts] = await Promise.all([
    getUpcomingEvents(365),
    prisma.contact.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  return <EventsClient upcomingEvents={upcomingEvents} contacts={contacts} />;
}
