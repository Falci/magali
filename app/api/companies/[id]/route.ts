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
  const { name, website, notes } = await req.json();

  const company = await prisma.company.update({
    where: { id },
    data: {
      ...(name ? { name: name.trim() } : {}),
      website: website ?? null,
      notes: notes ?? null,
    },
    include: { _count: { select: { contacts: true } } },
  });
  return NextResponse.json(company);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  // Contacts will have companyId set to null via ON DELETE SET NULL
  await prisma.company.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
