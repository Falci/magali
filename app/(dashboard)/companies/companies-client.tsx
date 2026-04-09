"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Company = { id: string; name: string; website: string | null; _count: { contacts: number } };

export default function CompaniesClient({ initialCompanies }: { initialCompanies: Company[] }) {
  const router = useRouter();
  const [companies, setCompanies] = useState(initialCompanies);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = companies.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase())
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), website: newWebsite.trim() || null }),
    });
    if (res.ok) {
      const company = await res.json();
      setCompanies((prev) => [...prev, company].sort((a, b) => a.name.localeCompare(b.name)));
      setOpen(false);
      setNewName("");
      setNewWebsite("");
      router.push(`/companies/${company.id}`);
    } else {
      toast.error("Failed to create company");
    }
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">{companies.length} companies</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add company
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New company</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={creating || !newName.trim()}>
                  {creating ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies…"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {q ? "No companies match your search." : (
            <div className="space-y-2">
              <Building2 className="h-12 w-12 mx-auto opacity-20" />
              <p className="font-medium">No companies yet</p>
              <p className="text-sm">Add a company or assign one to a contact.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {filtered.map((company) => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{company.name}</p>
                {company.website && (
                  <p className="text-xs text-muted-foreground truncate">{company.website}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {company._count.contacts} contact{company._count.contacts !== 1 ? "s" : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
