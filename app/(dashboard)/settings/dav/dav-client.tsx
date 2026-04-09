"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

export default function DavSettingsClient({ davToken: initialDavToken }: { davToken: string | null }) {
  const [davToken, setDavToken] = useState(initialDavToken);
  const [showDavToken, setShowDavToken] = useState(false);
  const [showMacSetup, setShowMacSetup] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function regenerateDavToken() {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate-dav-token" }),
    });
    if (res.ok) {
      const { davToken: newToken } = await res.json();
      setDavToken(newToken);
      toast.success("DAV token regenerated");
    } else {
      toast.error("Failed to regenerate DAV token");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">CalDAV / CardDAV</h1>
        <p className="text-sm text-muted-foreground">Sync your contacts and events with external calendar apps</p>
      </div>

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
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(`${origin}/api/dav/caldav/`);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>CardDAV URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={`${origin}/api/dav/carddav/`} className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(`${origin}/api/dav/carddav/`);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <div className="flex gap-2">
                <Input readOnly value="magali" className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText("magali");
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password (DAV token)</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={davToken ?? ""}
                  type={showDavToken ? "text" : "password"}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowDavToken((v) => !v)}
                  title={showDavToken ? "Hide token" : "Show token"}
                >
                  {showDavToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (davToken) {
                      navigator.clipboard.writeText(davToken);
                      toast.success("Copied");
                    }
                  }}
                  disabled={!davToken}
                  title="Copy token"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={regenerateDavToken} title="Regenerate token">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          {!davToken && (
            <p className="text-sm text-muted-foreground">
              Generate a DAV token to enable sync. Existing connections will need to be updated when you regenerate.
            </p>
          )}
          <div className="space-y-2">
            <Button
              variant="outline"
              render={<a href="/api/dav/mobileconfig" download />}
              disabled={!davToken}
            >
              <Download className="h-4 w-4 mr-2" />
              Download macOS profile (.mobileconfig)
            </Button>
            <p className="text-xs text-muted-foreground">
              Installs both CalDAV and CardDAV accounts with your current DAV token.
            </p>
          </div>
          <Separator />
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium hover:underline"
              onClick={() => setShowMacSetup((v) => !v)}
            >
              {showMacSetup ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              How to connect on macOS
            </button>
            {showMacSetup && (
              <div className="mt-3 rounded-md border bg-muted/30 p-4 text-sm space-y-3">
                <p className="font-medium">macOS System Settings → Internet Accounts</p>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                  <li>
                    Open <strong className="text-foreground">System Settings</strong> →{" "}
                    <strong className="text-foreground">Internet Accounts</strong>
                  </li>
                  <li>
                    Click <strong className="text-foreground">Add Account…</strong> → choose{" "}
                    <strong className="text-foreground">Other CalDAV Account</strong> (for calendar) or{" "}
                    <strong className="text-foreground">Other CardDAV Account</strong> (for contacts)
                  </li>
                  <li>
                    Set <strong className="text-foreground">Account Type</strong> to{" "}
                    <strong className="text-foreground">Advanced</strong>
                  </li>
                  <li>
                    Fill in:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      <li>
                        <strong className="text-foreground">Username:</strong> magali
                      </li>
                      <li>
                        <strong className="text-foreground">Password:</strong> your DAV token (copy it above)
                      </li>
                      <li>
                        <strong className="text-foreground">Server Address:</strong> {origin}
                      </li>
                      <li>
                        <strong className="text-foreground">Server Path:</strong> /api/dav/caldav/ (or
                        /api/dav/carddav/ for contacts)
                      </li>
                      <li>
                        <strong className="text-foreground">Port:</strong> 443 (or your port if self-hosted without
                        HTTPS)
                      </li>
                      <li>
                        <strong className="text-foreground">Use SSL:</strong> checked (if using HTTPS)
                      </li>
                    </ul>
                  </li>
                  <li>
                    Click <strong className="text-foreground">Sign In</strong>
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  Note: macOS Internet Accounts requires HTTPS. For local development, use a tool like Caddy or ngrok
                  to expose the app over HTTPS.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
