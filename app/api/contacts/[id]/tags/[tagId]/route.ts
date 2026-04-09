import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id, tagId } = await params;
  await prisma.contactTag.delete({
    where: { contactId_tagId: { contactId: id, tagId } },
  });
  return new NextResponse(null, { status: 204 });
}
