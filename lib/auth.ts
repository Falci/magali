import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";
import { sendEmail } from "./notifications/email";

const trustedOrigins = [
  process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : []),
];

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
      if (
        settings?.smtpHost &&
        settings?.smtpPort &&
        settings?.smtpUser &&
        settings?.smtpPass &&
        settings?.smtpFrom &&
        settings?.smtpTo
      ) {
        await sendEmail(
          {
            host: settings.smtpHost,
            port: settings.smtpPort,
            user: settings.smtpUser,
            pass: settings.smtpPass,
            from: settings.smtpFrom,
            to: user.email,
          },
          "Reset your Magali password",
          `Click the link below to reset your password:\n\n${url}\n\nThis link expires in 1 hour. If you did not request a password reset, ignore this email.`
        );
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,       // refresh if older than 1 day
  },
  trustedOrigins,
});
