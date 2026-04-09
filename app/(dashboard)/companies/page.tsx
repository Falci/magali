import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import CompaniesClient from "./companies-client";

export default async function CompaniesPage() {
  await requireSession();

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });

  return <CompaniesClient initialCompanies={companies} />;
}
