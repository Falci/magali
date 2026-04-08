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

  const interaction = await prisma.interaction.create({
    data: {
      contactId,
      type,
      date: date ? new Date(date) : new Date(),
      time: time ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(interaction, { status: 201 });
}
