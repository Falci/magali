"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Eye, EyeOff } from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  staleDays: number | null;
  companyId: string | null;
  tags: { tagId: string }[];
};
type Company = { id: string; name: string };
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
  company:      "#8b5cf6",
};

function getColor(type: string) {
  return RELATIONSHIP_COLORS[type] ?? "#94a3b8";
}

type GraphNode = {
  id: string;
  name: string;
  staleDays: number | null;
  isCompany?: boolean;
};
type GraphLink = { source: string; target: string; type: string };

export default function GraphClient({
  contacts,
  companies,
  relationships,
  tags,
}: {
  contacts: Contact[];
  companies: Company[];
  relationships: Relationship[];
  tags: Tag[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);

  useEffect(() => {
    function update() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    }
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // All unique relationship types in the data
  const allTypes = useMemo(
    () => [...new Set(relationships.map((r) => r.type))].sort(),
    [relationships]
  );

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [highlightedType, setHighlightedType] = useState<string | null>(null);
  const [hideOrphans, setHideOrphans] = useState(false);
  const [showCompanyNodes, setShowCompanyNodes] = useState(false);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  function toggleType(type: string) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  // Filter contacts by active tag
  const visibleContactIds = useMemo(() => {
    if (!activeTagId) return null;
    return new Set(contacts.filter((c) => c.tags.some((t) => t.tagId === activeTagId)).map((c) => c.id));
  }, [contacts, activeTagId]);

  const graphData = useMemo(() => {
    const visibleRels: GraphLink[] = relationships
      .filter((r) => !hiddenTypes.has(r.type))
      .map((r) => ({ source: r.fromId, target: r.toId, type: r.type }));

    const filteredRels = visibleContactIds
      ? visibleRels.filter((r) => visibleContactIds.has(r.source) && visibleContactIds.has(r.target))
      : visibleRels;

    const filteredContacts = visibleContactIds
      ? contacts.filter((c) => visibleContactIds.has(c.id))
      : contacts;

    const activeContactIds = new Set(filteredRels.flatMap((r) => [r.source, r.target]));

    // Company nodes and links
    const companyNodeIds = new Set<string>();
    const companyLinks: GraphLink[] = [];
    if (showCompanyNodes) {
      for (const c of filteredContacts) {
        if (c.companyId && companyMap.has(c.companyId)) {
          companyNodeIds.add(c.companyId);
          companyLinks.push({ source: c.id, target: `company-${c.companyId}`, type: "company" });
          activeContactIds.add(c.id);
        }
      }
    }

    const allLinks = [...filteredRels, ...companyLinks];

    const contactNodes: GraphNode[] = (hideOrphans
      ? filteredContacts.filter((c) => activeContactIds.has(c.id))
      : filteredContacts
    ).map((c) => ({
      id: c.id,
      name: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ""}`,
      staleDays: c.staleDays,
      isCompany: false,
    }));

    const companyNodes: GraphNode[] = showCompanyNodes
      ? [...companyNodeIds].map((cid) => ({
          id: `company-${cid}`,
          name: companyMap.get(cid)?.name ?? "Unknown",
          staleDays: null,
          isCompany: true,
        }))
      : [];

    return { nodes: [...contactNodes, ...companyNodes], links: allLinks, activeContactIds };
  }, [contacts, relationships, hiddenTypes, hideOrphans, visibleContactIds, showCompanyNodes, companyMap]);

  // Stable ref for graphData to pass to ForceGraph2D (avoids prop identity change on unrelated re-renders)
  const stableGraphData = useMemo(
    () => ({ nodes: graphData.nodes, links: graphData.links }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphData.nodes, graphData.links]
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.isCompany) return;
      router.push(`/contacts/${node.id}`);
    },
    [router]
  );

  const nodeCanvasObject = useCallback(
    (node: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const label = node.name;
      const fontSize = Math.max(10, 14 / globalScale);

      if (node.isCompany) {
        // Company: square/diamond shape in purple
        const size = 8;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = "#8b5cf6";
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.restore();
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "#8b5cf6";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(label, x, y + 8);
        return;
      }

      const r = 6;
      const isActive = graphData.activeContactIds.has(node.id);
      const isDeprioritized = node.staleDays === 0;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isDeprioritized ? "#cbd5e1" : isActive ? "#6366f1" : "#94a3b8";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, x, y + r + 2);
    },
    [graphData.activeContactIds]
  );

  const linkColor = useCallback(
    (link: GraphLink) => {
      if (highlightedType && link.type !== highlightedType) return "rgba(148,163,184,0.15)";
      return getColor(link.type);
    },
    [highlightedType]
  );

  const linkWidth = useCallback(
    (link: GraphLink) => {
      if (highlightedType && link.type !== highlightedType) return 0.5;
      return 1.5;
    },
    [highlightedType]
  );

  // DOM-based tooltip to avoid re-renders moving the graph
  const handleNodeHover = useCallback((node: (GraphNode & { x?: number; y?: number }) | null) => {
    const el = tooltipRef.current;
    if (!el) return;
    if (!node) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    el.innerHTML = `
      <p class="font-medium text-sm">${node.name}</p>
      ${node.isCompany ? `<p class="text-xs text-muted-foreground mt-0.5">Company</p>` : ""}
      ${!node.isCompany && node.staleDays === 0 ? `<p class="text-xs text-muted-foreground mt-0.5">Deprioritized</p>` : ""}
      ${!node.isCompany ? `<p class="text-xs text-muted-foreground mt-0.5">Click to open</p>` : ""}
    `;
  }, []);

  const orphanCount = useMemo(() => {
    const activeIds = graphData.activeContactIds;
    const filtered = visibleContactIds
      ? contacts.filter((c) => visibleContactIds.has(c.id))
      : contacts;
    return filtered.filter((c) => !activeIds.has(c.id)).length;
  }, [contacts, graphData.activeContactIds, visibleContactIds]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h1 className="text-xl font-semibold">Relationship graph</h1>
        <p className="text-sm text-muted-foreground">
          {graphData.nodes.filter((n) => !n.isCompany).length} contacts · {graphData.links.length} edges
        </p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Graph canvas — relative for tooltip overlay */}
        <div ref={containerRef} className="flex-1 bg-muted/20 overflow-hidden relative">
          <ForceGraph2D
            ref={graphRef}
            graphData={stableGraphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeCanvasObject={nodeCanvasObject as never}
            nodePointerAreaPaint={((node: GraphNode & { x?: number; y?: number }, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, 10, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }) as never}
            linkColor={linkColor as never}
            linkWidth={linkWidth as never}
            onNodeClick={handleNodeClick as never}
            onNodeHover={handleNodeHover as never}
            nodeLabel=""
            linkDirectionalParticles={0}
            cooldownTicks={150}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            onEngineStop={() => {
              // After initial layout, apply stronger charge for better spacing
              if (graphRef.current) {
                graphRef.current.d3Force("charge")?.strength(-150);
              }
            }}
          />

          {/* DOM-based tooltip — no React state updates */}
          <div
            ref={tooltipRef}
            style={{ display: "none" }}
            className="absolute top-3 left-3 pointer-events-none z-10 rounded-md border bg-card/95 backdrop-blur-sm shadow-md px-3 py-2"
          />
        </div>

        {/* Side panel */}
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
                checked={showCompanyNodes}
                onChange={(e) => setShowCompanyNodes(e.target.checked)}
                className="rounded"
              />
              <span>Show company nodes</span>
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
      </div>
    </div>
  );
}
