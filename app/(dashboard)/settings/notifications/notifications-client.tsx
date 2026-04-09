"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Send, X } from "lucide-react";

type Settings = {
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpFrom?: string | null;
  smtpTo?: string | null;
  vapidPublicKey?: string | null;
};

const SMTP_PRESETS: Record<
  string,
  { host: string; port: number; user?: string; apiKeyOnly?: boolean; userLabel?: string; passLabel?: string }
> = {
  resend:   { host: "smtp.resend.com",                    port: 587, user: "resend",  apiKeyOnly: true,  passLabel: "API key" },
  sendgrid: { host: "smtp.sendgrid.net",                  port: 587, user: "apikey", apiKeyOnly: true,  passLabel: "API key" },
  mailgun:  { host: "smtp.mailgun.org",                   port: 587, apiKeyOnly: false },
  postmark: { host: "smtp.postmarkapp.com",               port: 587, apiKeyOnly: true,  passLabel: "Server API token" },
  brevo:    { host: "smtp-relay.brevo.com",               port: 587, apiKeyOnly: false },
  ses:      { host: "email-smtp.us-east-1.amazonaws.com", port: 587, apiKeyOnly: false },
  smtp2go:  { host: "mail.smtp2go.com",                   port: 587, apiKeyOnly: false },
  mandrill: { host: "smtp.mandrillapp.com",               port: 587, apiKeyOnly: false },
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function NotificationsSettingsClient({
  initialSettings,
}: {
  initialSettings: Settings | null;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(initialSettings ?? {});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [smtpProvider, setSmtpProvider] = useState<string>("");

  // Web push state
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [generatingVapid, setGeneratingVapid] = useState(false);

  const currentPreset = smtpProvider ? SMTP_PRESETS[smtpProvider] : null;

  function set(field: keyof Settings, value: string | number | null) {
    setSettings((s) => ({ ...s, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramBotToken: settings.telegramBotToken,
        telegramChatId: settings.telegramChatId,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpUser: settings.smtpUser,
        smtpPass: settings.smtpPass,
        smtpFrom: settings.smtpFrom,
        smtpTo: settings.smtpTo,
        vapidPublicKey: settings.vapidPublicKey,
      }),
    });
    if (res.ok) {
      const saved = await res.json();
      setSettings(saved);
      toast.success("Settings saved");
      router.refresh();
    } else {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  }

  async function testNotifications() {
    setTesting(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test-notifications" }),
    });
    if (res.ok) {
      toast.success("Test notification sent! Check your Telegram/email.");
    } else {
      toast.error("Failed to send test notification. Check your configuration.");
    }
    setTesting(false);
  }

  async function generateVapidKeys() {
    setGeneratingVapid(true);
    const res = await fetch("/api/push/vapid", { method: "POST" });
    if (res.ok) {
      const { publicKey } = await res.json();
      setSettings((s) => ({ ...s, vapidPublicKey: publicKey }));
      toast.success("VAPID keys generated");
    } else {
      toast.error("Failed to generate VAPID keys");
    }
    setGeneratingVapid(false);
  }

  async function subscribeToPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Web push is not supported in this browser");
      return;
    }
    const vapidRes = await fetch("/api/push/vapid");
    const { publicKey } = await vapidRes.json();
    if (!publicKey) {
      toast.error("Generate VAPID keys first");
      return;
    }

    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setPushSubscribed(true);
      toast.success("Web push notifications enabled");
    } catch {
      toast.error("Failed to enable push notifications");
    } finally {
      setPushLoading(false);
    }
  }

  async function unsubscribeFromPush() {
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
      toast.success("Web push notifications disabled");
    } catch {
      toast.error("Failed to disable push notifications");
    } finally {
      setPushLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Configure Telegram, email, and web push notifications</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Telegram</CardTitle>
              <CardDescription className="mt-1">
                Create a bot via{" "}
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline">
                  @BotFather
                </a>
                .{" "}Get your chat ID from{" "}
                <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline">
                  @userinfobot
                </a>
                .
              </CardDescription>
            </div>
            {(settings.telegramBotToken || settings.telegramChatId) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => {
                  set("telegramBotToken", null);
                  set("telegramChatId", null);
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" />Disconnect
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Bot token</Label>
            <Input
              type="password"
              placeholder="123456:ABC-DEF…"
              value={settings.telegramBotToken ?? ""}
              onChange={(e) => set("telegramBotToken", e.target.value || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Chat ID</Label>
            <Input
              placeholder="123456789"
              value={settings.telegramChatId ?? ""}
              onChange={(e) => set("telegramChatId", e.target.value || null)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Email (SMTP)</CardTitle>
              <CardDescription className="mt-1">Receive daily digests via email</CardDescription>
            </div>
            {(settings.smtpHost || settings.smtpPass) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => {
                  setSmtpProvider("");
                  (["smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "smtpTo"] as const).forEach(
                    (k) => set(k, null)
                  );
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" />Disconnect
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email service</Label>
            <Select
              value={smtpProvider}
              onValueChange={(v) => {
                const provider = v === "custom" ? "" : (v ?? "");
                setSmtpProvider(provider);
                const p = provider ? SMTP_PRESETS[provider] : null;
                if (p) {
                  set("smtpHost", p.host);
                  set("smtpPort", p.port);
                  if (p.user) set("smtpUser", p.user);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="— select a service —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="mailgun">Mailgun</SelectItem>
                <SelectItem value="postmark">Postmark</SelectItem>
                <SelectItem value="brevo">Brevo (Sendinblue)</SelectItem>
                <SelectItem value="ses">AWS SES (us-east-1)</SelectItem>
                <SelectItem value="smtp2go">SMTP2GO</SelectItem>
                <SelectItem value="mandrill">Mailchimp Transactional (Mandrill)</SelectItem>
                <SelectItem value="custom">Custom SMTP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {currentPreset && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Server: <span className="font-mono text-foreground">{currentPreset.host}:{currentPreset.port}</span>
              {currentPreset.user && (
                <>
                  {" "}· Username: <span className="font-mono text-foreground">{currentPreset.user}</span>
                </>
              )}
            </div>
          )}

          <div className={`grid gap-4 ${!currentPreset || !currentPreset.apiKeyOnly ? "grid-cols-2" : "grid-cols-1"}`}>
            {(!currentPreset || !currentPreset.apiKeyOnly) && (
              <>
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input
                    placeholder="smtp.example.com"
                    value={settings.smtpHost ?? ""}
                    onChange={(e) => set("smtpHost", e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={settings.smtpPort ?? ""}
                    onChange={(e) => set("smtpPort", parseInt(e.target.value) || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={settings.smtpUser ?? ""}
                    onChange={(e) => set("smtpUser", e.target.value || null)}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>{currentPreset?.passLabel ?? "Password / API key"}</Label>
              <Input
                type="password"
                value={settings.smtpPass ?? ""}
                onChange={(e) => set("smtpPass", e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>From address</Label>
              <Input
                placeholder="magali@example.com"
                value={settings.smtpFrom ?? ""}
                onChange={(e) => set("smtpFrom", e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Send digest to</Label>
              <Input
                placeholder="you@example.com"
                value={settings.smtpTo ?? ""}
                onChange={(e) => set("smtpTo", e.target.value || null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Web push</CardTitle>
          <CardDescription>
            Receive push notifications directly in this browser. Requires HTTPS in production.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings.vapidPublicKey ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Generate VAPID keys once to enable web push. These are stored in your settings.
              </p>
              <Button variant="outline" onClick={generateVapidKeys} disabled={generatingVapid}>
                {generatingVapid ? "Generating…" : "Generate VAPID keys"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                VAPID keys configured
              </div>
              <div className="flex gap-2">
                {pushSubscribed ? (
                  <Button variant="outline" onClick={unsubscribeFromPush} disabled={pushLoading}>
                    {pushLoading ? "Disabling…" : "Disable on this browser"}
                  </Button>
                ) : (
                  <Button onClick={subscribeToPush} disabled={pushLoading}>
                    {pushLoading ? "Enabling…" : "Enable on this browser"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateVapidKeys}
                  disabled={generatingVapid}
                  className="text-muted-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Regenerate keys
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" onClick={testNotifications} disabled={testing}>
          <Send className="h-4 w-4 mr-2" />
          {testing ? "Sending…" : "Send test notification"}
        </Button>
      </div>
    </div>
  );
}
