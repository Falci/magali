export async function register() {
  // Only run scheduler in the Node.js runtime (not edge), and not during build
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "test") {
    const { default: cron } = await import("node-cron");
    const { runNotifications } = await import("./lib/notifications/notify");

    // Daily digest at 8:00 AM server time
    cron.schedule("0 8 * * *", async () => {
      console.log("[scheduler] Running daily notifications…");
      try {
        await runNotifications();
        console.log("[scheduler] Done.");
      } catch (err) {
        console.error("[scheduler] Error:", err);
      }
    });

    console.log("[scheduler] Daily notification job registered (8:00 AM).");
  }
}
