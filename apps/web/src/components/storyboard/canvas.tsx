"use client";

import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Viewport,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./nodes/node-types";
import { edgeTypes } from "./edges/edge-types";

interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onSelectionChange: (params: { nodes: Node[] }) => void;
  onNodeDragStop: (
    event: React.MouseEvent,
    node: Node,
    nodes: Node[],
  ) => void;
  onMoveEnd: (
    event: MouseEvent | TouchEvent | null,
    viewport: Viewport,
  ) => void;
}

export function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectionChange,
  onNodeDragStop,
  onMoveEnd,
}: CanvasProps) {
  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: "labeled" }}
        snapToGrid
        snapGrid={[20, 20]}
        fitView
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "scene") return "#8b5cf6";
            if (node.type === "event") return "#10b981";
            if (node.type === "branch") return "#f59e0b";
            return "#6b7280";
          }}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
