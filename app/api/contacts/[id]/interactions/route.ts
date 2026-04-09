import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id: contactId } = await params;
  const { type, date, time, notes } = await req.json();

  // Parse date-only strings (YYYY-MM-DD) as local noon to avoid UTC-midnight timezone drift
  let parsedDate: Date;
  if (date) {
    const [y, m, d] = (date as string).split("-").map(Number);
    parsedDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  } else {
    parsedDate = new Date();
  }

  const interaction = await prisma.interaction.create({
    data: {
      contactId,
      type,
      date: parsedDate,
      time: time ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(interaction, { status: 201 });
}
