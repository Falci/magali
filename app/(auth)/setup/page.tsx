import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import SetupForm from "./setup-form";

export default async function SetupPage() {
  const count = await prisma.user.count();
  if (count > 0) redirect("/login");
  return <SetupForm />;
}
