import webpush from "web-push";
import { prisma } from "@/lib/db";
import { getUpcomingEvents, getStaleContacts, getScheduledInteractions } from "@/lib/events";
import { sendTelegram } from "./telegram";
import { sendEmail } from "./email";
import { format } from "date-fns";

export async function runNotifications() {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings) return;

  const globalReminderDays = settings.reminderDaysBefore ?? 7;
  const globalStaleDays = settings.staleDays ?? 90;

  // Fetch a wide window and filter per-event below
  const maxWindow = Math.max(globalReminderDays, 30);
  const [allEvents, allStale, scheduledInteractions] = await Promise.all([
    getUpcomingEvents(maxWindow),
    getStaleContacts(globalStaleDays),
    getScheduledInteractions(),
  ]);

  const lines: string[] = [];

  // Filter events: only include if daysUntil <= their specific threshold
  for (const ev of allEvents) {
    const threshold = ev.reminderDaysBefore ?? globalReminderDays;
    if (ev.daysUntil > threshold) continue;

    if (ev.daysUntil === 0) {
      lines.push(`${ev.type === "birthday" ? "🎂" : "📅"} <b>${ev.title}</b> — Today!`);
    } else {
      lines.push(`${ev.type === "birthday" ? "🎂" : "📅"} <b>${ev.title}</b> — in ${ev.daysUntil} day${ev.daysUntil === 1 ? "" : "s"} (${format(ev.nextDate, "MMM d")})`);
    }
  }

  // Scheduled interactions: notify on the day
  const today = format(new Date(), "yyyy-MM-dd");
  for (const i of scheduledInteractions) {
    if (format(i.date, "yyyy-MM-dd") === today) {
      lines.push(`📆 Scheduled <b>${i.type}</b> with <b>${i.contactName}</b> — Today${i.notes ? `: ${i.notes}` : ""}`);
    }
  }

  // Stale contacts: respect per-contact staleDays override
  const contacts = await prisma.contact.findMany({
    select: {
      id: true, firstName: true, lastName: true, staleDays: true,
      interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });

  const now = Date.now();
  const staleToNotify = contacts.filter((c) => {
    if (c.staleDays === 0) return false; // disabled
    const threshold = (c.staleDays ?? globalStaleDays) * 86400000;
    const last = c.interactions[0]?.date;
    return !last || now - new Date(last).getTime() >= threshold;
  }).slice(0, 5);

  for (const c of staleToNotify) {
    const last = c.interactions[0]?.date;
    const since = last
      ? `${Math.floor((now - new Date(last).getTime()) / 86400000)} days ago`
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

  // Web push
  if (settings.vapidPublicKey && settings.vapidPrivateKey) {
    const subscriptions = await prisma.pushSubscription.findMany();
    if (subscriptions.length > 0) {
      webpush.setVapidDetails(
        "mailto:magali@localhost",
        settings.vapidPublicKey,
        settings.vapidPrivateKey
      );
      const payload = JSON.stringify({
        title: "🍉 Magali daily digest",
        body: lines.map((l) => l.replace(/<[^>]+>/g, "")).join("\n"),
      });
      await Promise.allSettled(
        subscriptions.map((sub) =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          ).catch(() => null)
        )
      );
    }
  }
}
