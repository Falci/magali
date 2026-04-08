import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";
import { randomBytes } from "crypto";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(settings ?? {});
}

export async function PUT(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const body = await req.json();
  // Strip sensitive fields that should never be overwritten blindly
  const { id: _id, ...data } = body;

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  revalidatePath("/", "layout");
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { action } = await req.json();

  if (action === "regenerate-dav-token") {
    const davToken = randomBytes(24).toString("hex");
    const settings = await prisma.settings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", davToken },
      update: { davToken },
    });
    return NextResponse.json({ davToken: settings.davToken });
  }

  if (action === "test-notifications") {
    const { runNotifications } = await import("@/lib/notifications/notify");
    await runNotifications();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
