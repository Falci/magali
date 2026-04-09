import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  const { type, date, time, notes } = await req.json();

  let parsedDate: Date | undefined;
  if (date) {
    const [y, m, d] = (date as string).split("-").map(Number);
    parsedDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }

  const interaction = await prisma.interaction.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      ...(parsedDate !== undefined && { date: parsedDate }),
      ...(time !== undefined && { time: time || null }),
      ...(notes !== undefined && { notes: notes?.trim() || null }),
    },
  });

  return NextResponse.json(interaction);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  await prisma.interaction.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
