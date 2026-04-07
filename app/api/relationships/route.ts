import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { fromId, toId, type, notes } = await req.json();

  const relationship = await prisma.relationship.upsert({
    where: { fromId_toId: { fromId, toId } },
    create: { fromId, toId, type, notes: notes ?? null },
    update: { type, notes: notes ?? null },
  });

  return NextResponse.json(relationship, { status: 201 });
}
