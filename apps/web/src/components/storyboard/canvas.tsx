"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./nodes/node-types";
import { edgeTypes } from "./edges/edge-types";
import { useEditorStore } from "@/stores/editor-store";

interface CanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
}

export function Canvas({ initialNodes, initialEdges }: CanvasProps) {
  const [nodes, setNodes, onNodesChangeHandler] =
    useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeHandler] =
    useEdgesState(initialEdges);
  const { setSelectedNodeId } = useEditorStore();

  const handleConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: "labeled" }, eds));
    },
    [setEdges],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      setSelectedNodeId(selectedNodes[0]?.id ?? null);
    },
    [setSelectedNodeId],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChangeHandler}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
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
