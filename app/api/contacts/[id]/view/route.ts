import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const { id } = await params;

  await prisma.contact.update({
    where: { id },
    data: { lastViewedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
