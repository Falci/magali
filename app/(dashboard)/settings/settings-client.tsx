"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, RefreshCw, Send } from "lucide-react";

type Settings = {
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpFrom?: string | null;
  smtpTo?: string | null;
  davToken?: string | null;
  staleDays?: number | null;
  reminderDaysBefore?: number | null;
};

export default function SettingsClient({ initialSettings }: { initialSettings: Settings | null }) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(initialSettings ?? {});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  function set(field: keyof Settings, value: string | number | null) {
    setSettings((s) => ({ ...s, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
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

  async function regenerateDavToken() {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate-dav-token" }),
    });
    if (res.ok) {
      const { davToken } = await res.json();
      set("davToken", davToken);
      toast.success("DAV token regenerated");
    }
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

  const [monicaDomain, setMonicaDomain] = useState("");
  const [monicaToken, setMonicaToken] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  async function handleMonicaImport() {
    if (!monicaDomain.trim() || !monicaToken.trim()) {
      toast.error("Domain and token are required");
      return;
    }
    setImporting(true);
    setImportResult(null);
    const res = await fetch("/api/import/monica", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: monicaDomain.trim(), token: monicaToken.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setImportResult(data);
      toast.success(`Imported ${data.imported} contacts`);
      router.refresh();
    } else {
      toast.error(data.error ?? "Import failed");
    }
    setImporting(false);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const davUser = "magali";
  const davPassword = settings.davToken ?? "(generate a token first)";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure notifications and integrations</p>
      </div>

      {/* Reminders */}
      <Card>
        <CardHeader>
          <CardTitle>Reminder thresholds</CardTitle>
          <CardDescription>Control when you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Days before event to notify</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={settings.reminderDaysBefore ?? 7}
              onChange={(e) => set("reminderDaysBefore", parseInt(e.target.value) || 7)}
            />
          </div>
          <div className="space-y-2">
            <Label>Days without contact (stale threshold)</Label>
            <Input
              type="number"
              min={7}
              max={365}
              value={settings.staleDays ?? 90}
              onChange={(e) => set("staleDays", parseInt(e.target.value) || 90)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Telegram */}
      <Card>
        <CardHeader>
          <CardTitle>Telegram notifications</CardTitle>
          <CardDescription>
            Create a bot via{" "}
            <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline">@BotFather</a>.
            {" "}Get your chat ID by messaging{" "}
            <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline">@userinfobot</a>.
          </CardDescription>
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

      {/* SMTP */}
      <Card>
        <CardHeader>
          <CardTitle>Email notifications (SMTP)</CardTitle>
          <CardDescription>Receive daily digests via email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP host</Label>
              <Input placeholder="smtp.example.com" value={settings.smtpHost ?? ""} onChange={(e) => set("smtpHost", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input type="number" placeholder="587" value={settings.smtpPort ?? ""} onChange={(e) => set("smtpPort", parseInt(e.target.value) || null)} />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={settings.smtpUser ?? ""} onChange={(e) => set("smtpUser", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={settings.smtpPass ?? ""} onChange={(e) => set("smtpPass", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>From address</Label>
              <Input placeholder="magali@example.com" value={settings.smtpFrom ?? ""} onChange={(e) => set("smtpFrom", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Send digest to</Label>
              <Input placeholder="you@example.com" value={settings.smtpTo ?? ""} onChange={(e) => set("smtpTo", e.target.value || null)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CalDAV/CardDAV */}
      <Card>
        <CardHeader>
          <CardTitle>CalDAV / CardDAV sync</CardTitle>
          <CardDescription>
            Use these credentials in Apple Calendar, Google Calendar, or any DAV client.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>CalDAV URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={`${origin}/api/dav/caldav/`} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(`${origin}/api/dav/caldav/`); toast.success("Copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>CardDAV URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={`${origin}/api/dav/carddav/`} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(`${origin}/api/dav/carddav/`); toast.success("Copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input readOnly value={davUser} className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Password (DAV token)</Label>
              <div className="flex gap-2">
                <Input readOnly value={settings.davToken ?? ""} type="password" className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={regenerateDavToken} title="Regenerate token">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          {!settings.davToken && (
            <p className="text-sm text-muted-foreground">
              Generate a DAV token to enable sync. Existing connections will need to be updated when you regenerate.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        <Button variant="outline" onClick={testNotifications} disabled={testing}>
          <Send className="h-4 w-4 mr-2" />
          {testing ? "Sending…" : "Send test notification"}
        </Button>
      </div>

      {/* Import */}
      <div>
        <h2 className="text-lg font-semibold">Import</h2>
        <p className="text-sm text-muted-foreground">One-time imports from other services</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import from Monica HQ</CardTitle>
          <CardDescription>
            Enter your Monica instance URL and a personal access token to import all contacts.
            Partial contacts (added as relationships only) are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Monica instance URL</Label>
            <Input
              placeholder="https://app.monicahq.com"
              value={monicaDomain}
              onChange={(e) => setMonicaDomain(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>API token</Label>
            <Input
              type="password"
              placeholder="Personal access token"
              value={monicaToken}
              onChange={(e) => setMonicaToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Generate one in Monica under Settings → API access tokens.
            </p>
          </div>
          {importResult && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p className="font-medium">
                Import complete — {importResult.imported} imported, {importResult.skipped} skipped
              </p>
              {importResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-destructive">{importResult.errors.length} error(s)</summary>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="truncate">{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          <Button onClick={handleMonicaImport} disabled={importing}>
            <Download className="h-4 w-4 mr-2" />
            {importing ? "Importing…" : "Import contacts"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
