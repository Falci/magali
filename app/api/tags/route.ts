import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });
  return NextResponse.json(tags);
}

export async function POST(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { name, color } = await req.json();
  const tag = await prisma.tag.upsert({
    where: { name },
    create: { name, color },
    update: { color },
  });
  return NextResponse.json(tag, { status: 201 });
}
