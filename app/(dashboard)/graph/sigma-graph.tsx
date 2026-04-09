"use client";

import "@react-sigma/core/lib/style.css";
import { SigmaContainer, useSigma, useRegisterEvents } from "@react-sigma/core";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

export type SigmaNodeData = {
  id: string;
  label: string;
  nodeType: "contact" | "tag";
  color: string;
  size: number;
};

export type SigmaEdgeData = {
  id: string;
  source: string;
  target: string;
  color: string;
  width: number;
};

export type SigmaGraphData = {
  nodes: SigmaNodeData[];
  edges: SigmaEdgeData[];
};

function GraphController({
  data,
  onContactClick,
  onTagClick,
}: {
  data: SigmaGraphData;
  onContactClick: (id: string) => void;
  onTagClick: (id: string) => void;
}) {
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();
  const draggedNode = useRef<string | null>(null);
  const layoutRaf = useRef<number | null>(null);
  const layoutIterations = useRef(0);

  // Force Sigma to remeasure whenever the container actually gets its dimensions
  useEffect(() => {
    const container = sigma.getContainer();
    const observer = new ResizeObserver(() => {
      sigma.resize();
      sigma.refresh();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [sigma]);

  // Sync graph data: diff-and-merge so layout/positions are preserved across filter changes
  useEffect(() => {
    const graph = sigma.getGraph();
    const incomingNodeIds = new Set(data.nodes.map((n) => n.id));
    const incomingEdgeIds = new Set(data.edges.map((e) => e.id));

    // Drop nodes/edges that are no longer in the filtered data
    for (const nodeId of graph.nodes()) {
      if (!incomingNodeIds.has(nodeId)) graph.dropNode(nodeId);
    }
    for (const edgeId of graph.edges()) {
      if (!incomingEdgeIds.has(edgeId)) graph.dropEdge(edgeId);
    }

    // Merge nodes: existing nodes keep their x/y; new nodes get random initial positions
    for (const n of data.nodes) {
      if (graph.hasNode(n.id)) {
        // Update visual attributes only, preserve x/y
        graph.mergeNode(n.id, { label: n.label, color: n.color, size: n.size, nodeType: n.nodeType });
      } else {
        graph.addNode(n.id, {
          label: n.label,
          color: n.color,
          size: n.size,
          nodeType: n.nodeType,
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
        });
      }
    }

    // Merge edges
    for (const e of data.edges) {
      if (graph.hasEdge(e.id)) {
        graph.mergeEdgeAttributes(e.id, { color: e.color, size: e.width });
      } else if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
        try {
          graph.addEdgeWithKey(e.id, e.source, e.target, { color: e.color, size: e.width });
        } catch {
          // Skip duplicate source↔target on non-multi graph
        }
      }
    }
  }, [data, sigma]);

  // Run ForceAtlas2 layout via RAF when contact node count changes (initial load or filter changes).
  // We intentionally exclude tag nodes so toggling "show tags as nodes" doesn't restart the layout
  // and cause contacts to scatter/disconnect visually.
  const nodeCount = data.nodes.filter((n) => n.nodeType === "contact").length;
  useEffect(() => {
    if (nodeCount === 0) return;

    // Cancel any in-progress layout
    if (layoutRaf.current !== null) cancelAnimationFrame(layoutRaf.current);
    layoutIterations.current = 0;

    const graph = sigma.getGraph();
    const maxIter = Math.min(600, nodeCount * 5 + 200);
    const settings = forceAtlas2.inferSettings(graph);

    function step() {
      if (layoutIterations.current >= maxIter) { layoutRaf.current = null; return; }
      forceAtlas2.assign(graph, { iterations: 8, settings });
      sigma.refresh();
      layoutIterations.current += 8;
      layoutRaf.current = requestAnimationFrame(step);
    }

    layoutRaf.current = requestAnimationFrame(step);
    return () => {
      if (layoutRaf.current !== null) cancelAnimationFrame(layoutRaf.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeCount, sigma]);

  // Register interaction events (drag + click + hover cursor)
  useEffect(() => {
    registerEvents({
      downNode: ({ node }) => {
        // Stop layout when user starts dragging
        if (layoutRaf.current !== null) {
          cancelAnimationFrame(layoutRaf.current);
          layoutRaf.current = null;
        }
        draggedNode.current = node;
        sigma.getContainer().style.cursor = "grabbing";
      },
      mousemovebody: (e) => {
        if (!draggedNode.current) return;
        // Prevent Sigma from panning the viewport while dragging a node
        e.preventSigmaDefault();
        const pos = sigma.viewportToGraph(e);
        sigma.getGraph().setNodeAttribute(draggedNode.current, "x", pos.x);
        sigma.getGraph().setNodeAttribute(draggedNode.current, "y", pos.y);
        sigma.refresh();
      },
      mouseup: () => {
        if (draggedNode.current) {
          sigma.getContainer().style.cursor = "";
          draggedNode.current = null;
        }
      },
      clickNode: ({ node, event }) => {
        // Don't navigate if we just finished dragging
        if (event.original.type === "click") {
          const nodeType = sigma.getGraph().getNodeAttribute(node, "nodeType");
          if (nodeType === "contact") onContactClick(node);
          else if (nodeType === "tag") onTagClick(node.slice(4)); // strip "tag:" prefix
        }
      },
      enterNode: ({ node }) => {
        if (!draggedNode.current) {
          const nodeType = sigma.getGraph().getNodeAttribute(node, "nodeType");
          sigma.getContainer().style.cursor = nodeType === "contact" || nodeType === "tag" ? "pointer" : "default";
        }
      },
      leaveNode: () => {
        if (!draggedNode.current) sigma.getContainer().style.cursor = "";
      },
    });
  }, [registerEvents, sigma, onContactClick, onTagClick]);

  return null;
}

export default function SigmaGraph({ data }: { data: SigmaGraphData }) {
  const router = useRouter();
  const graph = useMemo(() => new Graph({ multi: false, type: "undirected" }), []);

  const handleContactClick = useMemo(
    () => (id: string) => router.push(`/contacts/${id}`),
    [router]
  );

  const handleTagClick = useMemo(
    () => (id: string) => router.push(`/tags/${id}`),
    [router]
  );

  return (
    <SigmaContainer
      graph={graph}
      style={{ width: "100%", height: "100%" }}
      settings={{
        allowInvalidContainer: true,
        defaultNodeColor: "#94a3b8",
        defaultEdgeColor: "#cbd5e1",
        labelFont: "sans-serif",
        labelSize: 13,
        renderEdgeLabels: false,
        defaultEdgeType: "line",
        labelDensity: 0.07,
        labelGridCellSize: 60,
        labelRenderedSizeThreshold: 8,
      }}
    >
      <GraphController data={data} onContactClick={handleContactClick} onTagClick={handleTagClick} />
    </SigmaContainer>
  );
}
