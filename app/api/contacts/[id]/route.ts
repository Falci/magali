import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

const contactInclude = {
  emails: true,
  phones: true,
  addresses: true,
  tags: { include: { tag: true } },
  company: true,
  interactions: { orderBy: { date: "desc" as const }, take: 50 },
  events: { orderBy: { date: "asc" as const } },
  relationshipsFrom: { include: { to: true } },
  relationshipsTo: { include: { from: true } },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  const contact = await prisma.contact.findUnique({ where: { id }, include: contactInclude });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { emails, phones, addresses, tagIds, companyName, companyId: rawCompanyId, ...rest } = body;

  let companyId = rawCompanyId ?? null;
  if (companyId === undefined && companyName?.trim()) {
    const co = await prisma.company.upsert({
      where: { name: companyName.trim() },
      create: { name: companyName.trim() },
      update: {},
    });
    companyId = co.id;
  }

  // Replace nested records
  await prisma.$transaction([
    prisma.contactEmail.deleteMany({ where: { contactId: id } }),
    prisma.contactPhone.deleteMany({ where: { contactId: id } }),
    prisma.contactAddress.deleteMany({ where: { contactId: id } }),
    prisma.contactTag.deleteMany({ where: { contactId: id } }),
  ]);

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...rest,
      companyId: companyId,
      emails: emails?.length ? { create: emails } : undefined,
      phones: phones?.length ? { create: phones } : undefined,
      addresses: addresses?.length ? { create: addresses } : undefined,
      tags: tagIds?.length
        ? { create: tagIds.map((tagId: string) => ({ tagId })) }
        : undefined,
    },
    include: contactInclude,
  });

  return NextResponse.json(contact);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
