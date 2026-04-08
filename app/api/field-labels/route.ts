import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  const labels = await prisma.fieldLabel.findMany({
    orderBy: [{ field: "asc" }, { label: "asc" }],
  });

  return NextResponse.json(labels);
}

export async function POST(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { field, label } = await req.json();
  if (!field || !label) {
    return NextResponse.json({ error: "field and label required" }, { status: 400 });
  }

  try {
    const created = await prisma.fieldLabel.create({ data: { field, label: label.trim() } });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Label already exists" }, { status: 409 });
  }
}
