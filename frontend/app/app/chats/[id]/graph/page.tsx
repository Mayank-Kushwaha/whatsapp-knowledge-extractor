"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getChatGraph, type GraphData, type GraphNode } from "@/lib/api";

// Dynamic import for Cytoscape (client-side only)
let cytoscape: any = null;
if (typeof window !== "undefined") {
  cytoscape = require("cytoscape");
}

const NODE_TYPE_FILTERS = [
  { value: "all", label: "All", icon: "🌐" },
  { value: "sender", label: "Senders", icon: "👤" },
  { value: "cluster", label: "Topics", icon: "🏷️" },
  { value: "domain", label: "Domains", icon: "🔗" },
  { value: "important", label: "Important", icon: "⭐" },
];

export default function GraphPage() {
  const params = useParams();
  const chatId = parseInt(params.id as string);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState("all");

  const loadGraph = useCallback(async (type: string) => {
    try {
      setLoading(true);
      const data = await getChatGraph(chatId, {
        max_nodes: 500,
        filter_type: type === "all" ? undefined : type,
      });
      setGraphData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => { loadGraph(filterType); }, [filterType, loadGraph]);

  // Initialize Cytoscape when data changes
  useEffect(() => {
    if (!graphData || !containerRef.current || !cytoscape) return;

    // Destroy previous instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const elements: any[] = [];

    // Add nodes
    for (const node of graphData.nodes) {
      elements.push({
        data: {
          id: node.id,
          label: node.label,
          nodeType: node.type,
          size: Math.max(node.size, 10),
          color: node.color,
          ...node.metadata,
        },
      });
    }

    // Add edges
    for (const edge of graphData.edges) {
      elements.push({
        data: {
          id: `${edge.source}-${edge.target}-${edge.type}`,
          source: edge.source,
          target: edge.target,
          edgeType: edge.type,
          weight: edge.weight,
        },
      });
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            label: "data(label)",
            "font-size": "10px",
            color: "#e2e8f0",
            "text-outline-color": "#0f172a",
            "text-outline-width": 2,
            width: "mapData(size, 10, 100, 20, 80)",
            height: "mapData(size, 10, 100, 20, 80)",
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 8,
            "border-width": 2,
            "border-color": "#334155",
            "text-max-width": "80px",
            "text-wrap": "ellipsis",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#60a5fa",
            "background-color": "#60a5fa",
          },
        },
        {
          selector: "edge",
          style: {
            width: "mapData(weight, 1, 20, 1, 5)",
            "line-color": "#475569",
            "curve-style": "bezier",
            opacity: 0.5,
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#475569",
            "arrow-scale": 0.8,
          },
        },
        {
          selector: "edge:selected",
          style: {
            "line-color": "#60a5fa",
            "target-arrow-color": "#60a5fa",
            opacity: 1,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 1000,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        gravity: 0.3,
        numIter: 500,
        padding: 50,
      },
      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    });

    // Click handler
    cy.on("tap", "node", (event: any) => {
      const nodeData = event.target.data();
      const graphNode = graphData.nodes.find((n) => n.id === nodeData.id);
      if (graphNode) setSelectedNode(graphNode);
    });

    cy.on("tap", (event: any) => {
      if (event.target === cy) setSelectedNode(null);
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [graphData]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.3);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() / 1.3);
  const handleFit = () => cyRef.current?.fit(undefined, 50);

  if (loading && !graphData) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Building knowledge graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">⚠️ {error}</div>
          <button onClick={() => loadGraph(filterType)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">Retry</button>
        </div>
      </div>
    );
  }

  if (graphData && graphData.nodes.length === 0) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="text-6xl mb-6">🕸️</div>
          <h2 className="text-2xl font-bold text-slate-200 mb-4">No Graph Data</h2>
          <p className="text-slate-400 max-w-md">This chat needs more processed data to generate a knowledge graph.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Top Bar */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-6 py-3 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-sm z-10">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Knowledge Graph</h1>
          {graphData && (
            <p className="text-xs text-slate-500">
              {graphData.stats.total_nodes} nodes · {graphData.stats.total_edges} edges
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter chips */}
          {NODE_TYPE_FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilterType(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                filterType === f.value ? "bg-blue-600 text-white" : "bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50"
              }`}>
              {f.icon} {f.label}
              {graphData && f.value !== "all" && graphData.stats.node_types[f.value] !== undefined && (
                <span className="ml-1 opacity-70">({graphData.stats.node_types[f.value]})</span>
              )}
            </button>
          ))}
        </div>
        {/* Zoom controls */}
        <div className="flex gap-1">
          <button onClick={handleZoomIn} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm">+</button>
          <button onClick={handleZoomOut} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm">−</button>
          <button onClick={handleFit} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-xs">Fit</button>
        </div>
      </motion.div>

      {/* Graph + Side Panel */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Cytoscape container */}
        <div ref={containerRef} className="flex-1" style={{ minHeight: "400px" }} />

        {/* Detail Side Panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ x: 350, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 350, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              className="w-80 bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 p-5 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: selectedNode.color + "20", color: selectedNode.color }}>
                  {selectedNode.type === "sender" && "👤 Sender"}
                  {selectedNode.type === "cluster" && "🏷️ Topic"}
                  {selectedNode.type === "domain" && "🔗 Domain"}
                  {selectedNode.type === "important" && "⭐ Important"}
                </span>
                <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-slate-300">✕</button>
              </div>

              <h3 className="text-lg font-semibold text-slate-100 mb-3">{selectedNode.label}</h3>

              {selectedNode.type === "sender" && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Messages</span>
                    <span className="text-slate-200">{(selectedNode.metadata as any).message_count || 0}</span>
                  </div>
                </div>
              )}

              {selectedNode.type === "cluster" && (
                <div className="space-y-3 text-sm">
                  {(selectedNode.metadata as any).summary && (
                    <p className="text-slate-400 leading-relaxed">{(selectedNode.metadata as any).summary}</p>
                  )}
                  <div className="flex justify-between text-slate-400">
                    <span>Messages</span>
                    <span className="text-slate-200">{(selectedNode.metadata as any).message_count || 0}</span>
                  </div>
                </div>
              )}

              {selectedNode.type === "domain" && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Links shared</span>
                    <span className="text-slate-200">{(selectedNode.metadata as any).link_count || 0}</span>
                  </div>
                </div>
              )}

              {selectedNode.type === "important" && (
                <div className="space-y-3 text-sm">
                  <p className="text-slate-300 leading-relaxed bg-slate-800/50 rounded-lg p-3">
                    {(selectedNode.metadata as any).content || "No content"}
                  </p>
                  {(selectedNode.metadata as any).timestamp && (
                    <div className="text-xs text-slate-500">
                      {new Date((selectedNode.metadata as any).timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="px-6 py-2 border-t border-slate-800/50 bg-slate-900/80 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Senders</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Topics</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Domains</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Important</span>
        <span className="ml-auto">Click a node for details · Scroll to zoom · Drag to pan</span>
      </div>
    </div>
  );
}