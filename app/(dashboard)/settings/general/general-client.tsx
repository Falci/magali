"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Settings = {
  staleDays?: number | null;
  reminderDaysBefore?: number | null;
  dateFormat?: string | null;
};

export default function GeneralSettingsClient({ initialSettings }: { initialSettings: Settings | null }) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(initialSettings ?? {});
  const [saving, setSaving] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  function set(field: keyof Settings, value: string | number | null) {
    setSettings((s) => ({ ...s, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staleDays: settings.staleDays,
        reminderDaysBefore: settings.reminderDaysBefore,
        dateFormat: settings.dateFormat,
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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    const { error } = await authClient.changePassword({ currentPassword, newPassword });
    if (error) {
      toast.error(error.message ?? "Failed to change password");
    } else {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">General</h1>
        <p className="text-sm text-muted-foreground">Reminder thresholds, date format, and account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reminder thresholds</CardTitle>
          <CardDescription>
            Global defaults — individual contacts and events can override these.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="space-y-2">
            <Label>Date format</Label>
            <Select
              value={settings.dateFormat ?? "MMM d, yyyy"}
              onValueChange={(v) => set("dateFormat", v ?? "MMM d, yyyy")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MMM d, yyyy">Apr 8, 2026 (MMM d, yyyy)</SelectItem>
                <SelectItem value="MM/dd/yyyy">04/08/2026 (MM/dd/yyyy)</SelectItem>
                <SelectItem value="dd/MM/yyyy">08/04/2026 (dd/MM/yyyy)</SelectItem>
                <SelectItem value="yyyy-MM-dd">2026-04-08 (yyyy-MM-dd)</SelectItem>
                <SelectItem value="d MMM yyyy">8 Apr 2026 (d MMM yyyy)</SelectItem>
                <SelectItem value="MMMM d, yyyy">April 8, 2026 (MMMM d, yyyy)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Update your account password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Current password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>New password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm new password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              {changingPassword ? "Changing…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
