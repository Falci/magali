import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import CompanyDetailClient from "./company-detail-client";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true, firstName: true, lastName: true, nickname: true,
          jobTitle: true, photo: true,
          emails: { select: { value: true }, take: 1 },
          tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
        },
      },
      _count: { select: { contacts: true } },
    },
  });

  if (!company) notFound();

  return <CompanyDetailClient company={company} />;
}
