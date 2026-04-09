"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";

export default function ImportSettingsClient() {
  const router = useRouter();
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
        <h1 className="text-2xl font-semibold">Import</h1>
        <p className="text-sm text-muted-foreground">Import contacts from external services</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import from Monica HQ</CardTitle>
          <CardDescription>
            Enter your Monica instance URL and a personal access token to import all contacts. Partial contacts
            (added as relationships only) are skipped.
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
                    Import complete — {importResult.imported} contacts, {importResult.relImported} relationships
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
            <Download className="h-4 w-4 mr-2" />
            {importing ? "Importing…" : "Import contacts"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
