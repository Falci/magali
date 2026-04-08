import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

const trustedOrigins = [
  process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : []),
];

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,       // refresh if older than 1 day
  },
  trustedOrigins,
});
