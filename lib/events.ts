import { prisma } from "./db";
import { hasBirthdayEvent, nextBirthdayDate } from "./birthday";

export type UpcomingEvent = {
  id: string;
  title: string;
  type: string;
  nextDate: Date;
  daysUntil: number;
  contactId: string | null;
  contactName: string | null;
  notes: string | null;
  recurring: string | null;
  reminderDaysBefore: number | null; // null = use global default
};

export async function getUpcomingEvents(days = 30): Promise<UpcomingEvent[]> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  const [events, contacts] = await Promise.all([
    prisma.event.findMany({
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.contact.findMany({
      where: {
        AND: [
          { birthdayMonth: { not: null } },
          { birthdayDay: { not: null } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, birthdayMonth: true, birthdayDay: true, birthdayYear: true },
    }),
  ]);

  const upcoming: UpcomingEvent[] = [];

  // Process stored events
  for (const ev of events) {
    const base = new Date(ev.date);
    let nextDate: Date | null = null;

    if (!ev.recurring) {
      if (base >= now && base <= end) nextDate = base;
    } else if (ev.recurring === "YEARLY") {
      for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
        const candidate = new Date(base);
        candidate.setFullYear(year);
        if (candidate >= now && candidate <= end) { nextDate = candidate; break; }
      }
    }

    if (nextDate) {
      upcoming.push({
        id: ev.id,
        title: ev.title,
        type: ev.type,
        nextDate,
        daysUntil: Math.round((nextDate.getTime() - now.getTime()) / 86400000),
        contactId: ev.contactId,
        contactName: ev.contact ? `${ev.contact.firstName} ${ev.contact.lastName ?? ""}`.trim() : null,
        notes: ev.notes,
        recurring: ev.recurring,
        reminderDaysBefore: ev.reminderDaysBefore ?? null,
      });
    }
  }

  // Auto-generate birthday events from contacts (requires month + day)
  for (const c of contacts) {
    if (!hasBirthdayEvent(c)) continue;
    const candidate = nextBirthdayDate(c.birthdayMonth!, c.birthdayDay!, now);
    if (candidate <= end) {
      upcoming.push({
        id: `birthday-${c.id}`,
        title: `${c.firstName}'s birthday`,
        type: "birthday",
        nextDate: candidate,
        daysUntil: Math.round((candidate.getTime() - now.getTime()) / 86400000),
        contactId: c.id,
        contactName: `${c.firstName} ${c.lastName ?? ""}`.trim(),
        notes: null,
        recurring: "YEARLY",
        reminderDaysBefore: null,
      });
    }
  }

  upcoming.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
  return upcoming;
}

export type ScheduledInteraction = {
  id: string;
  date: Date;
  type: string;
  notes: string | null;
  contactId: string;
  contactName: string;
};

export async function getScheduledInteractions(): Promise<ScheduledInteraction[]> {
  const now = new Date();
  const interactions = await prisma.interaction.findMany({
    where: { date: { gt: now } },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { date: "asc" },
  });
  return interactions.map((i) => ({
    id: i.id,
    date: i.date,
    type: i.type,
    notes: i.notes,
    contactId: i.contact.id,
    contactName: `${i.contact.firstName} ${i.contact.lastName ?? ""}`.trim(),
  }));
}

export async function getStaleContacts(globalStaleDays = 90) {
  const now = new Date();

  const contacts = await prisma.contact.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      photo: true,
      staleDays: true,
      interactions: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
  });

  return contacts
    .filter((c) => {
      if (c.staleDays === 0) return false; // disabled
      const threshold = (c.staleDays ?? globalStaleDays) * 86400000;
      const last = c.interactions[0]?.date;
      return !last || now.getTime() - new Date(last).getTime() >= threshold;
    })
    .map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      photo: c.photo,
      lastInteraction: c.interactions[0]?.date ?? null,
    }))
    .sort((a, b) => {
      if (!a.lastInteraction) return -1;
      if (!b.lastInteraction) return 1;
      return new Date(a.lastInteraction).getTime() - new Date(b.lastInteraction).getTime();
    });
}
