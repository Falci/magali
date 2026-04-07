import { prisma } from "@/lib/db";
import { getUpcomingEvents, getStaleContacts } from "@/lib/events";
import { sendTelegram } from "./telegram";
import { sendEmail } from "./email";
import { format } from "date-fns";

export async function runNotifications() {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings) return;

  const reminderDays = settings.reminderDaysBefore ?? 7;
  const staleDays = settings.staleDays ?? 90;

  const [upcomingEvents, staleContacts] = await Promise.all([
    getUpcomingEvents(reminderDays),
    getStaleContacts(staleDays),
  ]);

  const lines: string[] = [];

  for (const ev of upcomingEvents) {
    if (ev.daysUntil === 0) {
      lines.push(`${ev.type === "birthday" ? "🎂" : "📅"} <b>${ev.title}</b> — Today!`);
    } else {
      lines.push(`${ev.type === "birthday" ? "🎂" : "📅"} <b>${ev.title}</b> — in ${ev.daysUntil} day${ev.daysUntil === 1 ? "" : "s"} (${format(ev.nextDate, "MMM d")})`);
    }
  }

  for (const c of staleContacts.slice(0, 5)) {
    const since = c.lastInteraction
      ? `${Math.floor((Date.now() - new Date(c.lastInteraction).getTime()) / 86400000)} days ago`
      : "never";
    lines.push(`👤 <b>${c.firstName} ${c.lastName ?? ""}</b> — last contact: ${since}`);
  }

  if (lines.length === 0) return;

  const message = `<b>🍉 Magali daily digest</b>\n\n${lines.join("\n")}`;
  const plainText = message.replace(/<[^>]+>/g, "");

  if (settings.telegramBotToken && settings.telegramChatId) {
    await sendTelegram(settings.telegramBotToken, settings.telegramChatId, message);
  }

  if (settings.smtpHost && settings.smtpUser && settings.smtpPass && settings.smtpFrom && settings.smtpTo) {
    await sendEmail(
      {
        host: settings.smtpHost,
        port: settings.smtpPort ?? 587,
        user: settings.smtpUser,
        pass: settings.smtpPass,
        from: settings.smtpFrom,
        to: settings.smtpTo,
      },
      "🍉 Magali daily digest",
      plainText
    );
  }
}
