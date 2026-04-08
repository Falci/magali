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
  const { type, notes } = await req.json();
  const updated = await prisma.relationship.update({
    where: { id },
    data: { type, notes: notes ?? null },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  await prisma.relationship.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
