"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type Contact = { id: string; firstName: string; lastName: string | null; staleDays: number | null };
type Relationship = { id: string; fromId: string; toId: string; type: string };

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

type GraphNode = { id: string; name: string; staleDays: number | null };
type GraphLink = { source: string; target: string; type: string };

export default function GraphClient({
  contacts,
  relationships,
}: {
  contacts: Contact[];
  relationships: Relationship[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  function toggleType(type: string) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const graphData = useMemo(() => {
    const visibleRels = relationships.filter((r) => !hiddenTypes.has(r.type));
    // Only include nodes that participate in visible relationships
    const activeIds = new Set(visibleRels.flatMap((r) => [r.fromId, r.toId]));
    // Always include all nodes so isolated contacts are visible
    const nodes: GraphNode[] = contacts.map((c) => ({
      id: c.id,
      name: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ""}`,
      staleDays: c.staleDays,
    }));
    const links: GraphLink[] = visibleRels.map((r) => ({
      source: r.fromId,
      target: r.toId,
      type: r.type,
    }));
    return { nodes, links, activeIds };
  }, [contacts, relationships, hiddenTypes]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
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
      const r = 6;

      const isActive = graphData.activeIds.has(node.id);
      const isDeprioritized = node.staleDays === 0;

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isDeprioritized ? "#cbd5e1" : isActive ? "#6366f1" : "#94a3b8";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, x, y + r + 2);
    },
    [graphData.activeIds]
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h1 className="text-xl font-semibold">Relationship graph</h1>
        <p className="text-sm text-muted-foreground">
          {contacts.length} contacts · {relationships.length} relationships
        </p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Graph canvas */}
        <div ref={containerRef} className="flex-1 bg-muted/20 overflow-hidden">
          <ForceGraph2D
            graphData={{ nodes: graphData.nodes, links: graphData.links }}
            width={dimensions.width}
            height={dimensions.height}
            nodeCanvasObject={nodeCanvasObject as never}
            nodePointerAreaPaint={((node: GraphNode & { x?: number; y?: number }, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, 8, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }) as never}
            linkColor={linkColor as never}
            linkWidth={linkWidth as never}
            onNodeClick={handleNodeClick as never}
            onNodeHover={(node) => setHoveredNode(node as GraphNode | null)}
            nodeLabel=""
            linkDirectionalParticles={0}
            cooldownTicks={100}
          />
        </div>

        {/* Side panel */}
        <div className="w-56 border-l bg-card flex flex-col shrink-0 overflow-y-auto">
          <div className="p-3 border-b">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filter by type</p>
          </div>
          <div className="p-3 space-y-1">
            {allTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">No relationships yet.</p>
            )}
            {allTypes.map((type) => {
              const hidden = hiddenTypes.has(type);
              const highlighted = highlightedType === type;
              return (
                <div key={type} className="flex items-center gap-2">
                  <button
                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-opacity ${hidden ? "opacity-40" : ""}`}
                    onClick={() => toggleType(type)}
                    title={hidden ? "Show" : "Hide"}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getColor(type) }}
                    />
                    <span className="capitalize truncate">{type}</span>
                  </button>
                  <button
                    className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${highlighted ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setHighlightedType(highlighted ? null : type)}
                    title="Highlight"
                  >
                    {highlighted ? <X className="h-3 w-3" /> : "HL"}
                  </button>
                </div>
              );
            })}
          </div>

          {hoveredNode && (
            <div className="mt-auto p-3 border-t">
              <Card className="p-2">
                <p className="text-xs font-medium">{hoveredNode.name}</p>
                {hoveredNode.staleDays === 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">Deprioritized</p>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
