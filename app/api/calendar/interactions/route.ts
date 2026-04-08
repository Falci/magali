import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const interactions = await prisma.interaction.findMany({
    where: {
      ...(start || end
        ? {
            date: {
              ...(start ? { gte: new Date(start) } : {}),
              ...(end ? { lte: new Date(end) } : {}),
            },
          }
        : {}),
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(interactions);
}
