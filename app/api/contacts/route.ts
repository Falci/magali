import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

const contactInclude = {
  emails: true,
  phones: true,
  addresses: true,
  tags: { include: { tag: true } },
  _count: { select: { interactions: true } },
};

export async function GET(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const tagId = searchParams.get("tag") ?? undefined;

  const contacts = await prisma.contact.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { nickname: { contains: q, mode: "insensitive" } },
                { company: { contains: q, mode: "insensitive" } },
                { emails: { some: { value: { contains: q, mode: "insensitive" } } } },
              ],
            }
          : {},
        tagId ? { tags: { some: { tagId } } } : {},
      ],
    },
    include: contactInclude,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const body = await req.json();
  const { emails, phones, addresses, tagIds, ...rest } = body;

  const contact = await prisma.contact.create({
    data: {
      ...rest,
      birthday: rest.birthday ? new Date(rest.birthday) : null,
      emails: emails?.length ? { create: emails } : undefined,
      phones: phones?.length ? { create: phones } : undefined,
      addresses: addresses?.length ? { create: addresses } : undefined,
      tags: tagIds?.length
        ? { create: tagIds.map((tagId: string) => ({ tagId })) }
        : undefined,
    },
    include: contactInclude,
  });

  return NextResponse.json(contact, { status: 201 });
}
