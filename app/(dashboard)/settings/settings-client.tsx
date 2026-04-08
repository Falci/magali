"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Download, RefreshCw, Send, X, Plus } from "lucide-react";

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

type FieldLabel = { id: string; field: string; label: string };

export default function SettingsClient({
  initialSettings,
  fieldLabels: initialFieldLabels,
}: {
  initialSettings: Settings | null;
  fieldLabels: FieldLabel[];
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(initialSettings ?? {});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Field labels state
  const [fieldLabels, setFieldLabels] = useState<FieldLabel[]>(initialFieldLabels);
  const [newEmailLabel, setNewEmailLabel] = useState("");
  const [newPhoneLabel, setNewPhoneLabel] = useState("");
  const [newAddressLabel, setNewAddressLabel] = useState("");

  async function addFieldLabel(field: string, label: string, clearFn: () => void) {
    const trimmed = label.trim();
    if (!trimmed) return;
    const res = await fetch("/api/field-labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, label: trimmed }),
    });
    if (res.ok) {
      const created = await res.json();
      setFieldLabels((prev) => [...prev, created]);
      clearFn();
    } else if (res.status === 409) {
      toast.error("Label already exists");
    } else {
      toast.error("Failed to add label");
    }
  }

  async function deleteFieldLabel(id: string) {
    const res = await fetch(`/api/field-labels/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFieldLabels((prev) => prev.filter((l) => l.id !== id));
    } else {
      toast.error("Failed to delete label");
    }
  }

  function labelsByField(field: string) {
    return fieldLabels.filter((l) => l.field === field);
  }

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

  // Monica import state
  const [monicaDomain, setMonicaDomain] = useState("");
  const [monicaToken, setMonicaToken] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; phase: string; name: string } | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; relImported: number; relSkipped: number; errors: string[] } | null>(null);

  async function handleMonicaImport() {
    if (!monicaDomain.trim() || !monicaToken.trim()) {
      toast.error("Domain and token are required");
      return;
    }
    setImporting(true);
    setImportStatus(null);
    setImportProgress(null);
    setImportResult(null);

    const res = await fetch("/api/import/monica", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: monicaDomain.trim(), token: monicaToken.trim() }),
    });

    if (!res.body) {
      toast.error("Import failed: no response body");
      setImporting(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.replace(/^data: /, "").trim();
        if (!data) continue;
        try {
          const event = JSON.parse(data);
          if (event.type === "status") setImportStatus(event.message);
          else if (event.type === "progress") setImportProgress(event);
          else if (event.type === "error") { toast.error(event.message); setImporting(false); return; }
          else if (event.type === "done") {
            setImportResult(event);
            setImportStatus(null);
            setImportProgress(null);
            toast.success(`Imported ${event.imported} contacts`);
            router.refresh();
            setImporting(false);
            return;
          }
        } catch { /* ignore parse errors */ }
      }
    }

    setImporting(false);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure notifications, integrations, and imports</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="field-types">Field types</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="dav">CalDAV / CardDAV</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Reminder thresholds</CardTitle>
              <CardDescription>
                Global defaults — individual contacts and events can override these.
              </CardDescription>
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </TabsContent>

        {/* Field types */}
        <TabsContent value="field-types" className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Manage the label options available for email, phone, and address fields when editing contacts.
          </p>
          {(["email", "phone", "address"] as const).map((field) => {
            const labels = labelsByField(field);
            const newLabel = field === "email" ? newEmailLabel : field === "phone" ? newPhoneLabel : newAddressLabel;
            const setNewLabel = field === "email" ? setNewEmailLabel : field === "phone" ? setNewPhoneLabel : setNewAddressLabel;
            const fieldTitle = field.charAt(0).toUpperCase() + field.slice(1);
            return (
              <Card key={field}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{fieldTitle} labels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {labels.map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs"
                      >
                        {l.label}
                        <button
                          type="button"
                          onClick={() => deleteFieldLabel(l.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${l.label}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    {labels.length === 0 && (
                      <p className="text-xs text-muted-foreground">No labels yet.</p>
                    )}
                  </div>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addFieldLabel(field, newLabel, () => setNewLabel(""));
                    }}
                  >
                    <Input
                      placeholder={`New ${field} label…`}
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button type="submit" size="sm" variant="outline" disabled={!newLabel.trim()}>
                      <Plus className="size-3.5 mr-1" />Add
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle>Telegram</CardTitle>
              <CardDescription>
                Create a bot via{" "}
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline">@BotFather</a>.
                {" "}Get your chat ID from{" "}
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

          <Card>
            <CardHeader>
              <CardTitle>Email (SMTP)</CardTitle>
              <CardDescription>Receive daily digests via email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Host</Label>
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

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={testNotifications} disabled={testing}>
              <Send className="h-4 w-4 mr-2" />
              {testing ? "Sending…" : "Send test notification"}
            </Button>
          </div>
        </TabsContent>

        {/* DAV */}
        <TabsContent value="dav" className="space-y-4 pt-2">
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
                  <Input readOnly value="magali" className="font-mono text-sm" />
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
        </TabsContent>

        {/* Import */}
        <TabsContent value="import" className="space-y-4 pt-2">
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
              {(importing || importResult) && (
                <div className="rounded-md border p-3 text-sm space-y-2">
                  {importStatus && (
                    <p className="text-muted-foreground">{importStatus}</p>
                  )}
                  {importProgress && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {importProgress.phase === "relationships" ? "Relationships" : importProgress.name ? `Importing ${importProgress.name}` : "Processing"}…
                        </span>
                        <span>{importProgress.current} / {importProgress.total}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-200"
                          style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {importResult && (
                    <>
                      <p className="font-medium">
                        Import complete — {importResult.imported} contacts, {importResult.relImported} relationships
                        {(importResult.skipped > 0 || importResult.relSkipped > 0) && (
                          <span className="text-muted-foreground font-normal"> ({importResult.skipped + importResult.relSkipped} skipped)</span>
                        )}
                      </p>
                      {importResult.errors.length > 0 && (
                        <details>
                          <summary className="cursor-pointer text-destructive">{importResult.errors.length} error(s)</summary>
                          <ul className="mt-1 space-y-0.5 text-muted-foreground">
                            {importResult.errors.map((e, i) => (
                              <li key={i} className="truncate">{e}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </>
                  )}
                </div>
              )}
              <Button onClick={handleMonicaImport} disabled={importing}>
                <Download className="h-4 w-4 mr-2" />
                {importing ? "Importing…" : "Import contacts"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
