import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";
import ical from "ical-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const [interactions, events, contacts] = await Promise.all([
    prisma.interaction.findMany({
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.event.findMany({
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.contact.findMany({
      where: {
        AND: [{ birthdayMonth: { not: null } }, { birthdayDay: { not: null } }],
      },
      select: { id: true, firstName: true, lastName: true, birthdayMonth: true, birthdayDay: true, birthdayYear: true },
    }),
  ]);

  const calendar = ical({ name: "Magali CRM" });
  const currentYear = new Date().getFullYear();

  // Interactions
  for (const i of interactions) {
    const start = new Date(i.date);
    if (i.time) {
      const [h, m] = i.time.split(":").map(Number);
      start.setHours(h, m, 0, 0);
    }
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    calendar.createEvent({
      id: i.id,
      start,
      end,
      allDay: !i.time,
      summary: `${i.type} with ${i.contact.firstName} ${i.contact.lastName ?? ""}`.trim(),
      description: i.notes ?? undefined,
      url: `${req.nextUrl.origin}/contacts/${i.contact.id}`,
    });
  }

  // Stored events
  for (const ev of events) {
    const base = new Date(ev.date);
    const yearsToTry = ev.recurring === "YEARLY"
      ? [currentYear, currentYear + 1]
      : [base.getFullYear()];

    for (const year of yearsToTry) {
      const start = new Date(base);
      start.setFullYear(year);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      calendar.createEvent({
        id: `${ev.id}-${year}`,
        start,
        end,
        allDay: true,
        summary: ev.title,
        description: ev.notes ?? undefined,
        url: ev.contactId ? `${req.nextUrl.origin}/contacts/${ev.contactId}` : undefined,
      });
    }
  }

  // Birthday events
  for (const c of contacts) {
    if (!c.birthdayMonth || !c.birthdayDay) continue;
    for (const year of [currentYear, currentYear + 1]) {
      const start = new Date(year, c.birthdayMonth - 1, c.birthdayDay);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      calendar.createEvent({
        id: `birthday-${c.id}-${year}`,
        start,
        end,
        allDay: true,
        summary: `${c.firstName}'s birthday`,
        url: `${req.nextUrl.origin}/contacts/${c.id}`,
      });
    }
  }

  return new NextResponse(calendar.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="magali.ics"',
    },
  });
}
