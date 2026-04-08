import { prisma } from "@/lib/db";

let cachedFormat: string | null = null;
let cacheExpiry = 0;

export async function getDateFormat(): Promise<string> {
  const now = Date.now();
  if (cachedFormat && now < cacheExpiry) return cachedFormat;

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { dateFormat: true },
  });

  cachedFormat = settings?.dateFormat ?? "MMM d, yyyy";
  cacheExpiry = now + 60_000; // cache for 1 minute
  return cachedFormat;
}
