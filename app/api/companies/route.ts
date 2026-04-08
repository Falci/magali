import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { name, website, notes } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const company = await prisma.company.upsert({
    where: { name: name.trim() },
    create: { name: name.trim(), website: website ?? null, notes: notes ?? null },
    update: {},
    include: { _count: { select: { contacts: true } } },
  });
  return NextResponse.json(company, { status: 201 });
}
