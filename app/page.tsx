import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const count = await prisma.user.count();
  if (count === 0) redirect("/setup");

  const session = await getSession();
  if (!session) redirect("/login");

  redirect("/dashboard");
}
