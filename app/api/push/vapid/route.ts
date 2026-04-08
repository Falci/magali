import { NextResponse } from "next/server";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function POST() {
  const { error } = await requireApiSession();
  if (error) return error;

  const keys = webpush.generateVAPIDKeys();

  await prisma.settings.upsert({
    where: { id: "singleton" },
    create: { vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey },
    update: { vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey },
  });

  return NextResponse.json({ publicKey: keys.publicKey });
}

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({ publicKey: settings?.vapidPublicKey ?? null });
}
