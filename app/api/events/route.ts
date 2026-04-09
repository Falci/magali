import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const upcomingParam = searchParams.get("upcoming");

  if (upcomingParam) {
    const days = parseInt(upcomingParam, 10) || 30;
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);

    // Get all events and expand recurring ones into the window
    const events = await prisma.event.findMany({
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: "asc" },
    });

    const upcoming: Array<{ nextDate: Date } & typeof events[number]> = [];
    for (const ev of events) {
      if (!ev.recurring) {
        const d = new Date(ev.date);
        if (d >= now && d <= end) upcoming.push({ ...ev, nextDate: d });
      } else if (ev.recurring === "YEARLY") {
        // Find the next occurrence within the window
        const base = new Date(ev.date);
        const thisYear = new Date(base);
        thisYear.setFullYear(now.getFullYear());
        const nextYear = new Date(base);
        nextYear.setFullYear(now.getFullYear() + 1);

        for (const candidate of [thisYear, nextYear]) {
          if (candidate >= now && candidate <= end) {
            upcoming.push({ ...ev, nextDate: candidate });
            break;
          }
        }
      }
    }

    upcoming.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
    return NextResponse.json(upcoming);
  }

  const events = await prisma.event.findMany({
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const body = await req.json();
  // Parse date-only strings (YYYY-MM-DD) as noon UTC to avoid timezone drift
  let eventDate: Date;
  if (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    const [y, m, d] = body.date.split("-").map(Number);
    eventDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  } else {
    eventDate = new Date(body.date);
  }
  const event = await prisma.event.create({
    data: {
      ...body,
      date: eventDate,
      contactId: body.contactId || null,
    },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  });
  return NextResponse.json(event, { status: 201 });
}
