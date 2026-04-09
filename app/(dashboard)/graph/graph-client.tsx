"use client";

import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import type { SigmaGraphData } from "./sigma-graph";

const SigmaGraph = dynamic(() => import("./sigma-graph"), { ssr: false });

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  staleDays: number | null;
  tags: { tagId: string }[];
};
type Relationship = { id: string; fromId: string; toId: string; type: string };
type Tag = { id: string; name: string; color: string | null };

const RELATIONSHIP_COLORS: Record<string, string> = {
  friend:       "#6366f1",
  family:       "#f59e0b",
  colleague:    "#3b82f6",
  partner:      "#ec4899",
  spouse:       "#ec4899",
  acquaintance: "#94a3b8",
  mentor:       "#10b981",
  mentee:       "#10b981",
  child:        "#f97316",
  parent:       "#f97316",
  sibling:      "#f97316",
  "ex-spouse":  "#ef4444",
  "ex-partner": "#ef4444",
  other:        "#94a3b8",
};

function getColor(type: string) {
  return RELATIONSHIP_COLORS[type] ?? "#94a3b8";
}

export default function GraphClient({
  contacts,
  relationships,
  tags,
}: {
  contacts: Contact[];
  relationships: Relationship[];
  tags: Tag[];
}) {
  const allTypes = useMemo(
    () => [...new Set(relationships.map((r) => r.type))].sort(),
    [relationships]
  );

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [highlightedType, setHighlightedType] = useState<string | null>(null);
  const [hideOrphans, setHideOrphans] = useState(false);
  const [showTagNodes, setShowTagNodes] = useState(true);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  function toggleType(type: string) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  // Contacts visible under the current tag filter
  const tagVisibleIds = useMemo(() => {
    if (!activeTagId) return null;
    return new Set(contacts.filter((c) => c.tags.some((t) => t.tagId === activeTagId)).map((c) => c.id));
  }, [contacts, activeTagId]);

  // Contact IDs that participate in at least one visible relationship edge (or tag edge when showTagNodes)
  const activeContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of relationships) {
      if (hiddenTypes.has(r.type)) continue;
      if (tagVisibleIds && (!tagVisibleIds.has(r.fromId) || !tagVisibleIds.has(r.toId))) continue;
      ids.add(r.fromId);
      ids.add(r.toId);
    }
    // When showing tag nodes, contacts with at least one tag are also "connected"
    if (showTagNodes) {
      for (const c of contacts) {
        if (tagVisibleIds && !tagVisibleIds.has(c.id)) continue;
        const relevantTags = activeTagId
          ? c.tags.filter((t) => t.tagId === activeTagId)
          : c.tags;
        if (relevantTags.length > 0) ids.add(c.id);
      }
    }
    return ids;
  }, [relationships, hiddenTypes, tagVisibleIds, showTagNodes, contacts, activeTagId]);

  // Build the graph data passed to Sigma
  const sigmaData = useMemo((): SigmaGraphData => {
    const nodes: SigmaGraphData["nodes"] = [];
    const edges: SigmaGraphData["edges"] = [];

    // Contact nodes
    for (const c of contacts) {
      if (tagVisibleIds && !tagVisibleIds.has(c.id)) continue;
      if (hideOrphans && !activeContactIds.has(c.id)) continue;
      nodes.push({
        id: c.id,
        label: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ""}`,
        nodeType: "contact",
        color: c.staleDays === 0 ? "#cbd5e1" : activeContactIds.has(c.id) ? "#6366f1" : "#94a3b8",
        size: 6,
      });
    }

    const visibleContactIds = new Set(nodes.map((n) => n.id));

    // Relationship edges
    for (const r of relationships) {
      if (!visibleContactIds.has(r.fromId) || !visibleContactIds.has(r.toId)) continue;
      if (hiddenTypes.has(r.type)) continue;
      const dimmed = !!highlightedType && highlightedType !== r.type;
      edges.push({
        id: r.id,
        source: r.fromId,
        target: r.toId,
        color: dimmed ? "rgba(148,163,184,0.15)" : getColor(r.type),
        width: dimmed ? 0.5 : 1.5,
      });
    }

    // Tag nodes + tag edges
    if (showTagNodes) {
      const usedTagIds = new Set<string>();
      for (const c of contacts) {
        if (!visibleContactIds.has(c.id)) continue;
        for (const t of c.tags) {
          if (activeTagId && t.tagId !== activeTagId) continue;
          usedTagIds.add(t.tagId);
        }
      }

      for (const tag of tags) {
        if (!usedTagIds.has(tag.id)) continue;
        nodes.push({
          id: `tag:${tag.id}`,
          label: tag.name,
          nodeType: "tag",
          color: tag.color ?? "#94a3b8",
          size: 10,
        });
      }

      let tagEdgeIdx = 0;
      for (const c of contacts) {
        if (!visibleContactIds.has(c.id)) continue;
        for (const t of c.tags) {
          if (!usedTagIds.has(t.tagId)) continue;
          edges.push({
            id: `tag-edge-${tagEdgeIdx++}`,
            source: c.id,
            target: `tag:${t.tagId}`,
            color: tags.find((tg) => tg.id === t.tagId)?.color ?? "#94a3b8",
            width: 1,
          });
        }
      }
    }

    return { nodes, edges };
  }, [contacts, relationships, tags, hiddenTypes, highlightedType, hideOrphans,
      tagVisibleIds, activeContactIds, showTagNodes, activeTagId]);

  // Stats for header
  const contactNodeCount = sigmaData.nodes.filter((n) => n.nodeType === "contact").length;
  const relationshipEdgeCount = sigmaData.edges.filter((e) => !e.id.startsWith("tag-edge-")).length;

  const orphanCount = useMemo(() => {
    const base = tagVisibleIds ? contacts.filter((c) => tagVisibleIds.has(c.id)) : contacts;
    return base.filter((c) => !activeContactIds.has(c.id)).length;
  }, [contacts, tagVisibleIds, activeContactIds]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h1 className="text-xl font-semibold">Relationship graph</h1>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {contactNodeCount} contacts · {relationshipEdgeCount} edges
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelOpen((v) => !v)}
            title={panelOpen ? "Hide filters" : "Show filters"}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">{panelOpen ? "Hide filters" : "Filters"}</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Graph canvas */}
        <div className="flex-1 bg-muted/20 overflow-hidden relative h-full">
          <SigmaGraph data={sigmaData} />
        </div>

        {/* Side panel */}
        {panelOpen && (
          <div className="w-64 border-l bg-card flex flex-col shrink-0 overflow-y-auto">

            {/* Relationship type filters */}
            <div className="p-3 border-b">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Relationship types</p>
              {allTypes.length === 0 && (
                <p className="text-xs text-muted-foreground">No relationships yet.</p>
              )}
              <div className="space-y-1">
                {allTypes.map((type) => {
                  const hidden = hiddenTypes.has(type);
                  const highlighted = highlightedType === type;
                  return (
                    <div key={type} className="flex items-center gap-1.5">
                      <button
                        className={`flex flex-1 items-center gap-2 px-2 py-1 rounded text-sm text-left transition-opacity ${hidden ? "opacity-30" : ""}`}
                        onClick={() => toggleType(type)}
                        title={hidden ? "Show this type" : "Hide this type"}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: getColor(type) }}
                        />
                        <span className="capitalize truncate flex-1">{type}</span>
                      </button>
                      <button
                        className={`text-xs px-1.5 py-0.5 rounded border shrink-0 transition-colors ${highlighted ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted border-transparent"}`}
                        onClick={() => setHighlightedType(highlighted ? null : type)}
                        title={highlighted ? "Stop highlighting" : "Highlight only this type"}
                      >
                        {highlighted ? <X className="h-3 w-3" /> : "HL"}
                      </button>
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => toggleType(type)}
                        title={hidden ? "Show" : "Hide"}
                      >
                        {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Display options */}
            <div className="p-3 border-b space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Display</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideOrphans}
                  onChange={(e) => setHideOrphans(e.target.checked)}
                  className="rounded"
                />
                <span>Hide isolated contacts</span>
                {orphanCount > 0 && <span className="text-xs text-muted-foreground">({orphanCount})</span>}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTagNodes}
                  onChange={(e) => setShowTagNodes(e.target.checked)}
                  className="rounded"
                />
                <span>Show tags as nodes</span>
              </label>
            </div>

            {/* Tag filter */}
            {tags.length > 0 && (
              <div className="p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Filter by tag</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeTagId && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                      onClick={() => setActiveTagId(null)}
                    >
                      Clear
                    </button>
                  )}
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={activeTagId === tag.id ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      style={tag.color && activeTagId !== tag.id ? { borderColor: tag.color, color: tag.color } : {}}
                      onClick={() => setActiveTagId(activeTagId === tag.id ? null : tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
