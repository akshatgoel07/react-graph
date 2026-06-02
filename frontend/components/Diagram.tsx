"use client";

import { useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Flow } from "@/lib/api";

export default function Diagram({ flow }: { flow: Flow }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);

  useEffect(() => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [flow, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      colorMode="light"
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#e4e4e7" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable maskColor="rgba(0,0,0,0.04)" nodeColor="#d6d6d6" />
    </ReactFlow>
  );
}
