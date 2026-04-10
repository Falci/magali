"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, FileArchive } from "lucide-react";

export default function ImportSettingsClient() {
  const router = useRouter();

  // ── Export ────────────────────────────────────────────────────────────────
  const [includeSettings, setIncludeSettings] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const qs = includeSettings ? "?settings=true" : "";
      const res = await fetch(`/api/export${qs}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "crm-export.zip";
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  // ── CRM import ────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [crmImporting, setCrmImporting] = useState(false);
  const [crmResult, setCrmResult] = useState<{
    imported: number;
    skipped: number;
    relImported: number;
    relSkipped: number;
    evImported: number;
    evSkipped: number;
    errors: string[];
  } | null>(null);

  async function handleCrmImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCrmImporting(true);
    setCrmResult(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/import/crm", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Import failed");
        return;
      }
      setCrmResult(data);
      toast.success(`Imported ${data.imported} contacts, ${data.evImported} events`);
      router.refresh();
    } catch {
      toast.error("Import failed");
    } finally {
      setCrmImporting(false);
      // Reset so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Monica import ─────────────────────────────────────────────────────────
  const [monicaDomain, setMonicaDomain] = useState("");
  const [monicaToken, setMonicaToken] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    phase: string;
    name: string;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    relImported: number;
    relSkipped: number;
    errors: string[];
  } | null>(null);

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
          else if (event.type === "error") {
            toast.error(event.message);
            setImporting(false);
            return;
          } else if (event.type === "done") {
            setImportResult(event);
            setImportStatus(null);
            setImportProgress(null);
            toast.success(`Imported ${event.imported} contacts`);
            router.refresh();
            setImporting(false);
            return;
          }
        } catch {
          /* ignore parse errors */
        }
      }
    }

    setImporting(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Import / Export</h1>
        <p className="text-sm text-muted-foreground">Back up your data or move it between instances</p>
      </div>

      {/* ── CRM import ── */}
      <Card>
        <CardHeader>
          <CardTitle>Import from CRM export</CardTitle>
          <CardDescription>
            Restore from a ZIP file previously exported by this app. Contacts and events that already
            exist (matched by uid) are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleCrmImport}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={crmImporting}
            variant="outline"
          >
            <FileArchive className="h-4 w-4 mr-2" />
            {crmImporting ? "Importing…" : "Choose ZIP file"}
          </Button>

          {crmResult && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p className="font-medium">
                Import complete — {crmResult.imported} contacts, {crmResult.evImported} events,{" "}
                {crmResult.relImported} relationships
                {(crmResult.skipped > 0 || crmResult.evSkipped > 0) && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({crmResult.skipped + crmResult.evSkipped} skipped)
                  </span>
                )}
              </p>
              {crmResult.errors.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-destructive">
                    {crmResult.errors.length} error(s)
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {crmResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Monica HQ import ── */}
      <Card>
        <CardHeader>
          <CardTitle>Import from Monica HQ</CardTitle>
          <CardDescription>
            Enter your Monica instance URL and a personal access token to import all contacts. Partial
            contacts (added as relationships only) are skipped.
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
              {importStatus && <p className="text-muted-foreground">{importStatus}</p>}
              {importProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {importProgress.phase === "relationships"
                        ? "Relationships"
                        : importProgress.name
                        ? `Importing ${importProgress.name}`
                        : "Processing"}
                      …
                    </span>
                    <span>
                      {importProgress.current} / {importProgress.total}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{
                        width: `${Math.round((importProgress.current / importProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {importResult && (
                <>
                  <p className="font-medium">
                    Import complete — {importResult.imported} contacts, {importResult.relImported}{" "}
                    relationships
                    {(importResult.skipped > 0 || importResult.relSkipped > 0) && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        ({importResult.skipped + importResult.relSkipped} skipped)
                      </span>
                    )}
                  </p>
                  {importResult.errors.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-destructive">
                        {importResult.errors.length} error(s)
                      </summary>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        {importResult.errors.map((e, i) => (
                          <li key={i} className="truncate">
                            {e}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
          <Button onClick={handleMonicaImport} disabled={importing}>
            <Upload className="h-4 w-4 mr-2" />
            {importing ? "Importing…" : "Import contacts"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Export ── */}
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            Download all your data as a ZIP file. Contacts and events are exported as Markdown files
            compatible with Obsidian and re-importable into another instance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSettings}
              onChange={(e) => setIncludeSettings(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Include settings (API tokens, SMTP, etc.)
          </label>
          <Button onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Preparing…" : "Download export"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
