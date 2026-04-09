"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";

type FieldLabel = { id: string; field: string; label: string };

export default function FieldTypesSettingsClient({
  initialFieldLabels,
}: {
  initialFieldLabels: FieldLabel[];
}) {
  const [fieldLabels, setFieldLabels] = useState<FieldLabel[]>(initialFieldLabels);
  const [newEmailLabel, setNewEmailLabel] = useState("");
  const [newPhoneLabel, setNewPhoneLabel] = useState("");
  const [newAddressLabel, setNewAddressLabel] = useState("");

  function labelsByField(field: string) {
    return fieldLabels.filter((l) => l.field === field);
  }

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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Field types</h1>
        <p className="text-sm text-muted-foreground">
          Manage the label options available for email, phone, and address fields when editing contacts.
        </p>
      </div>

      {(["email", "phone", "address"] as const).map((field) => {
        const labels = labelsByField(field);
        const newLabel =
          field === "email" ? newEmailLabel : field === "phone" ? newPhoneLabel : newAddressLabel;
        const setNewLabel =
          field === "email"
            ? setNewEmailLabel
            : field === "phone"
            ? setNewPhoneLabel
            : setNewAddressLabel;
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
    </div>
  );
}
