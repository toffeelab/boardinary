"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type Viewport,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import type {
  StoryboardContentV1,
  StoryboardNodeData,
} from "@repo/types";
import { migrateContent } from "@/lib/content-migration";
import { useEditorStore } from "@/stores/editor-store";
import { useAutoSave } from "./hooks/use-auto-save";
import { useUndoRedo } from "./hooks/use-undo-redo";
import { useEditorShortcuts } from "./hooks/use-editor-shortcuts";
import { Canvas } from "./canvas";
import { Toolbar } from "./panels/toolbar";
import { NodeListPanel } from "./panels/node-list-panel";
import { PropertyPanel } from "./panels/property-panel";

interface StoryboardEditorProps {
  storyboardId: string;
  userId: string;
  initialContent: Record<string, unknown>;
  initialContentVersion: number;
  storyboardName: string;
}

/** Default data factories per node type */
function createDefaultNodeData(
  type: "scene" | "event" | "branch",
): StoryboardNodeData {
  const base: StoryboardNodeData = { title: "" };
  if (type === "scene") {
    base.title = "새 씬";
    base.color = "#8b5cf6";
  } else if (type === "event") {
    base.title = "새 이벤트";
    base.color = "#10b981";
  } else {
    base.title = "새 분기";
    base.color = "#f59e0b";
    base.choices = [
      { id: crypto.randomUUID(), label: "선택지 1" },
      { id: crypto.randomUUID(), label: "선택지 2" },
    ];
  }
  return base;
}

function contentToReactFlow(content: StoryboardContentV1): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = content.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data as unknown as Record<string, unknown>,
  }));
  const edges: Edge[] = content.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "labeled",
    ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
    ...(e.label ? { label: e.label } : {}),
  }));
  return { nodes, edges };
}

export function StoryboardEditor(props: StoryboardEditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

function EditorInner({
  storyboardId,
  userId,
  initialContent,
  initialContentVersion,
  storyboardName,
}: StoryboardEditorProps) {
  const reactFlowInstance = useReactFlow();

  // Parse and migrate content
  const parsedContent = useRef(migrateContent(initialContent));
  const initialReactFlow = useRef(contentToReactFlow(parsedContent.current));

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialReactFlow.current.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialReactFlow.current.edges,
  );

  // Stable refs for snapshot capture (avoids callback recreation on every state change)
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // Store
  const {
    isNodeListOpen,
    selectedNodeId,
    setSelectedNodeId,
    saveStatus,
    setContentVersion,
  } = useEditorStore();

  // Initialize content version
  useEffect(() => {
    setContentVersion(initialContentVersion);
  }, [initialContentVersion, setContentVersion]);

  // Viewport ref for auto-save — sync with React Flow's actual viewport on mount
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  useEffect(() => {
    viewportRef.current = reactFlowInstance.getViewport();
  }, [reactFlowInstance]);

  // Track unsaved changes
  const hasUnsavedChanges = useRef(false);

  // Hooks
  const { debouncedSave, immediateSave } = useAutoSave({
    storyboardId,
    userId,
    viewportRef: viewportRef as React.RefObject<Viewport>,
    hasUnsavedChangesRef: hasUnsavedChanges as React.RefObject<boolean>,
  });
  const { pushSnapshot, undo, redo } = useUndoRedo();

  // Mark dirty and trigger debounced save
  const markDirtyAndSave = useCallback(
    (currentNodes: Node[], currentEdges: Edge[]) => {
      hasUnsavedChanges.current = true;
      debouncedSave(currentNodes, currentEdges);
    },
    [debouncedSave],
  );

  // Node changes handler — intercepts deletions for undo snapshot
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasRemoval = changes.some((c) => c.type === "remove");
      if (hasRemoval) {
        pushSnapshot(nodesRef.current, edgesRef.current);
      }
      onNodesChange(changes);
      if (hasRemoval) {
        // Compute resulting state directly to avoid timing issues with React Flow internal store
        const updatedNodes = applyNodeChanges(changes, nodesRef.current);
        markDirtyAndSave(updatedNodes, edgesRef.current);
      }
    },
    [onNodesChange, pushSnapshot, markDirtyAndSave],
  );

  // Edge changes handler — intercepts deletions for undo snapshot
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const hasRemoval = changes.some((c) => c.type === "remove");
      if (hasRemoval) {
        pushSnapshot(nodesRef.current, edgesRef.current);
      }
      onEdgesChange(changes);
      if (hasRemoval) {
        const updatedEdges = applyEdgeChanges(changes, edgesRef.current);
        markDirtyAndSave(nodesRef.current, updatedEdges);
      }
    },
    [onEdgesChange, pushSnapshot, markDirtyAndSave],
  );

  // Connect handler
  const handleConnect = useCallback(
    (params: Connection) => {
      pushSnapshot(nodesRef.current, edgesRef.current);
      setEdges((eds) => {
        const newEdges = addEdge(
          { ...params, type: "labeled", label: "" },
          eds,
        );
        markDirtyAndSave(nodesRef.current, newEdges);
        return newEdges;
      });
    },
    [pushSnapshot, setEdges, markDirtyAndSave],
  );

  // Selection change handler
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      setSelectedNodeId(selectedNodes[0]?.id ?? null);
    },
    [setSelectedNodeId],
  );

  // Node drag stop — push snapshot and save
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
      if (draggedNodes.length > 0) {
        pushSnapshot(nodesRef.current, edgesRef.current);
        markDirtyAndSave(nodesRef.current, edgesRef.current);
      }
    },
    [pushSnapshot, markDirtyAndSave],
  );

  // Move end — track viewport
  const handleMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      viewportRef.current = viewport;
    },
    [],
  );

  // Add node from toolbar
  const handleAddNode = useCallback(
    (type: "scene" | "event" | "branch") => {
      pushSnapshot(nodesRef.current, edgesRef.current);

      const viewport = reactFlowInstance.getViewport();
      // Calculate center of current viewport
      const container = document.querySelector(".react-flow");
      const width = container?.clientWidth ?? 800;
      const height = container?.clientHeight ?? 600;
      const centerX = (-viewport.x + width / 2) / viewport.zoom;
      const centerY = (-viewport.y + height / 2) / viewport.zoom;

      const newNode: Node = {
        id: crypto.randomUUID(),
        type,
        position: { x: centerX - 100, y: centerY - 50 },
        data: createDefaultNodeData(type) as unknown as Record<string, unknown>,
      };

      setNodes((nds) => {
        const updated = [...nds, newNode];
        markDirtyAndSave(updated, edgesRef.current);
        return updated;
      });
    },
    [pushSnapshot, setNodes, reactFlowInstance, markDirtyAndSave],
  );

  // Property panel node data change
  const handleNodeDataChange = useCallback(
    (nodeId: string, data: StoryboardNodeData) => {
      pushSnapshot(nodesRef.current, edgesRef.current);
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: data as unknown as Record<string, unknown> }
            : n,
        );
        markDirtyAndSave(updated, edgesRef.current);
        return updated;
      });
    },
    [pushSnapshot, setNodes, markDirtyAndSave],
  );

  // Node list panel — focus on node
  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        reactFlowInstance.setCenter(node.position.x + 100, node.position.y + 50, {
          zoom: 1,
          duration: 500,
        });
      }
    },
    [setSelectedNodeId, reactFlowInstance],
  );

  // Keyboard shortcut handlers
  const handleShortcutSave = useCallback(() => {
    const viewport = reactFlowInstance.getViewport();
    viewportRef.current = viewport;
    immediateSave(nodesRef.current, edgesRef.current, viewport);
  }, [reactFlowInstance, immediateSave]);

  const handleShortcutUndo = useCallback(() => {
    const snapshot = undo();
    if (snapshot) {
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      markDirtyAndSave(snapshot.nodes, snapshot.edges);
    }
  }, [undo, setNodes, setEdges, markDirtyAndSave]);

  const handleShortcutRedo = useCallback(() => {
    const snapshot = redo();
    if (snapshot) {
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      markDirtyAndSave(snapshot.nodes, snapshot.edges);
    }
  }, [redo, setNodes, setEdges, markDirtyAndSave]);

  const handleDuplicate = useCallback(() => {
    const currentNodes = nodesRef.current;
    const selectedNodes = currentNodes.filter((n) => n.selected);
    if (selectedNodes.length === 0) return;

    pushSnapshot(currentNodes, edgesRef.current);

    const newNodes: Node[] = selectedNodes.map((n) => ({
      ...n,
      id: crypto.randomUUID(),
      position: { x: n.position.x + 50, y: n.position.y + 50 },
      selected: false,
      data: { ...n.data },
    }));

    setNodes((nds) => {
      const updated = [...nds, ...newNodes];
      markDirtyAndSave(updated, edgesRef.current);
      return updated;
    });
  }, [pushSnapshot, setNodes, markDirtyAndSave]);

  // Wire keyboard shortcuts
  useEditorShortcuts({
    onSave: handleShortcutSave,
    onUndo: handleShortcutUndo,
    onRedo: handleShortcutRedo,
    onDuplicate: handleDuplicate,
  });

  // Beforeunload warning
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges.current) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Save status display
  const statusText = {
    idle: "",
    saving: "저장 중...",
    saved: "저장됨",
    error: "저장 실패",
    conflict: "충돌 발생",
  }[saveStatus];

  const statusColor = {
    idle: "text-muted-foreground",
    saving: "text-muted-foreground",
    saved: "text-green-600",
    error: "text-destructive",
    conflict: "text-orange-500",
  }[saveStatus];

  return (
    <div className="flex h-full flex-col">
      {/* Save status bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <h1 className="truncate text-sm font-semibold text-foreground">
          {storyboardName}
        </h1>
        {statusText && (
          <span className={`text-xs ${statusColor}`}>{statusText}</span>
        )}
      </div>

      {/* Main editor area */}
      <PanelGroup orientation="horizontal" className="min-h-0 flex-1">
        {isNodeListOpen && (
          <>
            <Panel defaultSize={20} minSize={15} maxSize={30}>
              <NodeListPanel nodes={nodes} onNodeSelect={handleNodeSelect} />
            </Panel>
            <PanelResizeHandle className="w-1 bg-border transition-colors hover:bg-primary" />
          </>
        )}

        <Panel defaultSize={60}>
          <Canvas
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onSelectionChange={handleSelectionChange}
            onNodeDragStop={handleNodeDragStop}
            onMoveEnd={handleMoveEnd}
          />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border transition-colors hover:bg-primary" />
        <Panel defaultSize={20} minSize={15} maxSize={30}>
          <PropertyPanel
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onNodeDataChange={handleNodeDataChange}
          />
        </Panel>
      </PanelGroup>

      {/* Toolbar */}
      <Toolbar onAddNode={handleAddNode} />
    </div>
  );
}
