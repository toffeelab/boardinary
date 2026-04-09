"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { EditorHeader } from "./panels/editor-header";
import type { StoryboardContentV1, StoryboardNodeData } from "@repo/types";
import { migrateContent } from "@/lib/content-migration";
import { instantiateBlueprint } from "@/lib/blueprint-utils";
import { calcTemplateAppendOffset } from "@/lib/template-utils";
import { useEditorStore } from "@/stores/editor-store";
import { useAutoSave } from "./hooks/use-auto-save";
import { useBlueprintAutoSave } from "./hooks/use-blueprint-auto-save";
import { useUndoRedo } from "./hooks/use-undo-redo";
import { useEditorShortcuts } from "./hooks/use-editor-shortcuts";
import { useCollaboration } from "@/hooks/use-collaboration";
import { useCollaborationStore } from "@/stores/collaboration-slice";
import { Canvas } from "./canvas";
import { Toolbar } from "./panels/toolbar";
import { NodeListPanel } from "./panels/node-list-panel";
import { PropertyPanel } from "./panels/property-panel";
import {
  ContextMenu,
  type AlignDirection,
  type DistributeAxis,
} from "./panels/context-menu";
import { TemplateBrowser } from "./panels/template-browser";
import { SaveBlueprintDialog } from "./panels/save-blueprint-dialog";
import type { StoryboardTemplate } from "./templates";
import { extractBlueprintContent } from "@/lib/blueprint-utils";
import { renameStoryboard } from "@/actions/storyboard-actions";
import { editBlueprint } from "@/actions/blueprint-actions";

interface StoryboardEditorBaseProps {
  initialContent: Record<string, unknown>;
  mode?: "storyboard" | "blueprint";
  orgSlug?: string;
}

interface StoryboardModeProps extends StoryboardEditorBaseProps {
  mode?: "storyboard";
  storyboardId: string;
  userId: string;
  initialContentVersion: number;
  storyboardName: string;
  blueprintId?: never;
  blueprintName?: never;
  contentVersion?: never;
}

interface BlueprintModeProps extends StoryboardEditorBaseProps {
  mode: "blueprint";
  blueprintId: string;
  blueprintName: string;
  contentVersion: number;
  storyboardId?: never;
  userId?: never;
  initialContentVersion?: never;
  storyboardName?: never;
}

type StoryboardEditorProps = StoryboardModeProps | BlueprintModeProps;

type AddableNodeType =
  | "scene"
  | "event"
  | "branch"
  | "dialogue"
  | "condition"
  | "note";

/** Default data factories per node type */
function createDefaultNodeData(type: AddableNodeType): StoryboardNodeData {
  const base: StoryboardNodeData = { title: "" };
  switch (type) {
    case "scene":
      base.title = "새 씬";
      base.color = "#8b5cf6";
      break;
    case "event":
      base.title = "새 이벤트";
      base.color = "#10b981";
      break;
    case "branch":
      base.title = "새 분기";
      base.color = "#f59e0b";
      base.choices = [
        { id: crypto.randomUUID(), label: "선택지 1" },
        { id: crypto.randomUUID(), label: "선택지 2" },
      ];
      break;
    case "dialogue":
      base.title = "새 대사";
      base.color = "#3b82f6";
      base.speaker = "";
      base.dialogueText = "";
      break;
    case "condition":
      base.title = "새 조건";
      base.color = "#ef4444";
      base.conditionExpr = "";
      break;
    case "note":
      base.title = "새 메모";
      break;
  }
  return base;
}

/** Find a position that doesn't overlap with existing nodes */
function findNonOverlappingPosition(
  baseX: number,
  baseY: number,
  existingNodes: Node[],
): { x: number; y: number } {
  let x = baseX;
  let y = baseY;
  const OFFSET = 50;
  const TOLERANCE = 20;

  while (
    existingNodes.some(
      (n) =>
        Math.abs(n.position.x - x) < TOLERANCE &&
        Math.abs(n.position.y - y) < TOLERANCE,
    )
  ) {
    x += OFFSET;
    y += OFFSET;
  }

  return { x, y };
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
    ...(n.width != null ? { width: n.width } : {}),
    ...(n.height != null ? { height: n.height } : {}),
    ...(n.parentId ? { parentId: n.parentId, extent: "parent" as const } : {}),
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

function EditorInner(props: StoryboardEditorProps) {
  const { initialContent, mode = "storyboard", orgSlug } = props;

  // Mode-specific values
  const isBlueprint = mode === "blueprint";
  const router = useRouter();
  const storyboardId = props.storyboardId ?? "";
  const userId = props.userId ?? "";
  const initialName = isBlueprint
    ? (props.blueprintName ?? "")
    : (props.storyboardName ?? "");
  const [editorName, setEditorName] = useState(initialName);
  const renameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialContentVersionValue =
    props.contentVersion ?? props.initialContentVersion ?? 0;
  const blueprintId = props.blueprintId ?? "";
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
    toggleNodeList,
    isPropertyPanelOpen,
    togglePropertyPanel,
    layoutPreset,
    selectedNodeId,
    setSelectedNodeId,
    setContentVersion,
  } = useEditorStore();

  // Initialize content version
  useEffect(() => {
    setContentVersion(initialContentVersionValue);
  }, [initialContentVersionValue, setContentVersion]);

  // Viewport ref for auto-save — sync with React Flow's actual viewport on mount
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  useEffect(() => {
    viewportRef.current = reactFlowInstance.getViewport();
  }, [reactFlowInstance]);

  // Track unsaved changes
  const hasUnsavedChanges = useRef(false);

  // Track whether any nodes are selected (for blueprint save)
  const [hasSelectedNodes, setHasSelectedNodes] = useState(false);

  // Hooks — auto-save differs based on mode
  const storyboardAutoSave = useAutoSave({
    storyboardId,
    userId,
    viewportRef: viewportRef as React.RefObject<Viewport>,
    hasUnsavedChangesRef: hasUnsavedChanges as React.RefObject<boolean>,
  });
  const blueprintAutoSave = useBlueprintAutoSave({
    blueprintId: blueprintId,
    hasUnsavedChangesRef: hasUnsavedChanges as React.RefObject<boolean>,
  });
  const { debouncedSave, immediateSave } = isBlueprint
    ? blueprintAutoSave
    : storyboardAutoSave;
  const { pushSnapshot: _pushSnapshot, undo, redo } = useUndoRedo();

  // isRemoteUpdate ref — 원격 변경 시 Undo 스택 오염 방지
  const isRemoteUpdateRef = useRef(false);

  const pushSnapshot = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      if (isRemoteUpdateRef.current) return; // 원격 변경은 스킵
      _pushSnapshot(nodes, edges);
    },
    [_pushSnapshot],
  );

  // useCollaboration 통합
  const { emit: collabEmit, updatePresence } = useCollaboration({
    storyboardId,
    isRemoteUpdateRef,
    onNodesUpdate: (remoteNodes) => {
      setNodes(remoteNodes as Node[]);
    },
    onEdgesUpdate: (remoteEdges) => {
      setEdges(remoteEdges as Edge[]);
    },
    onNodeRemote: (remoteNode, version) => {
      void version;
      setNodes((nds) => {
        const exists = nds.find((n) => n.id === (remoteNode["id"] as string));
        if (exists) {
          return nds.map((n) =>
            n.id === remoteNode["id"] ? { ...n, ...remoteNode } : n,
          );
        }
        return [...nds, remoteNode as Node];
      });
    },
    onNodeDeleteRemote: (nodeId, version) => {
      void version;
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    },
    onEdgeRemote: (remoteEdge, version) => {
      void version;
      setEdges((eds) => {
        const exists = eds.find((e) => e.id === (remoteEdge["id"] as string));
        if (exists) {
          return eds.map((e) =>
            e.id === remoteEdge["id"] ? { ...e, ...remoteEdge } : e,
          );
        }
        return [...eds, remoteEdge as Edge];
      });
    },
    onEdgeDeleteRemote: (edgeId, version) => {
      void version;
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
  });

  // Mark dirty and trigger debounced save
  const markDirtyAndSave = useCallback(
    (currentNodes: Node[], currentEdges: Edge[]) => {
      hasUnsavedChanges.current = true;
      debouncedSave(currentNodes, currentEdges);
    },
    [debouncedSave],
  );

  // Node changes handler — intercepts deletions and dimension changes for undo snapshot
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasRemoval = changes.some((c) => c.type === "remove");
      const hasDimensions = changes.some(
        (c) => c.type === "dimensions" && c.resizing === false,
      );
      if (hasRemoval || hasDimensions) {
        pushSnapshot(nodesRef.current, edgesRef.current);
      }
      onNodesChange(changes);
      if (hasRemoval || hasDimensions) {
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
        const newEdge = { ...params, type: "labeled", label: "" };
        const newEdges = addEdge(newEdge, eds);
        markDirtyAndSave(nodesRef.current, newEdges);
        collabEmit("edge:add", {
          storyboardId,
          edge: newEdge as unknown as Record<string, unknown>,
        });
        return newEdges;
      });
    },
    [pushSnapshot, setEdges, markDirtyAndSave, collabEmit, storyboardId],
  );

  // Selection change handler
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      setSelectedNodeId(selectedNodes[0]?.id ?? null);
      setHasSelectedNodes(selectedNodes.length > 0);
      // Sync selection state to nodesRef so group/align/distribute read fresh data
      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      nodesRef.current = nodesRef.current.map((n) => ({
        ...n,
        selected: selectedIds.has(n.id),
      }));
    },
    [setSelectedNodeId],
  );

  // Node drag stop — push snapshot and save
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
      if (draggedNodes.length > 0) {
        pushSnapshot(nodesRef.current, edgesRef.current);
        markDirtyAndSave(nodesRef.current, edgesRef.current);
        for (const node of draggedNodes) {
          collabEmit("node:update", {
            storyboardId,
            node: { id: node.id, position: node.position },
          });
        }
      }
    },
    [pushSnapshot, markDirtyAndSave, collabEmit, storyboardId],
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
    (type: AddableNodeType) => {
      pushSnapshot(nodesRef.current, edgesRef.current);

      const viewport = reactFlowInstance.getViewport();
      // Calculate center of current viewport
      const container = document.querySelector(".react-flow");
      const width = container?.clientWidth ?? 800;
      const height = container?.clientHeight ?? 600;
      const centerX = (-viewport.x + width / 2) / viewport.zoom;
      const centerY = (-viewport.y + height / 2) / viewport.zoom;

      const maxZ = Math.max(0, ...nodesRef.current.map((n) => n.zIndex ?? 0));

      const baseX = centerX - 100;
      const baseY = centerY - 50;
      const { x, y } = findNonOverlappingPosition(
        baseX,
        baseY,
        nodesRef.current,
      );

      const newNode: Node = {
        id: crypto.randomUUID(),
        type,
        position: { x, y },
        data: createDefaultNodeData(type) as unknown as Record<string, unknown>,
        zIndex: maxZ + 1,
      };

      setNodes((nds) => {
        const updated = [...nds, newNode];
        markDirtyAndSave(updated, edgesRef.current);
        return updated;
      });
      collabEmit("node:add", {
        storyboardId,
        node: newNode as unknown as Record<string, unknown>,
      });

      setSelectedNodeId(newNode.id);
    },
    [
      pushSnapshot,
      setNodes,
      reactFlowInstance,
      markDirtyAndSave,
      setSelectedNodeId,
      collabEmit,
      storyboardId,
    ],
  );

  // Add node via drag-and-drop on canvas
  const handleNodeDrop = useCallback(
    (type: AddableNodeType, position: { x: number; y: number }) => {
      pushSnapshot(nodesRef.current, edgesRef.current);

      const maxZ = Math.max(0, ...nodesRef.current.map((n) => n.zIndex ?? 0));

      const newNode: Node = {
        id: crypto.randomUUID(),
        type,
        position,
        data: createDefaultNodeData(type) as unknown as Record<string, unknown>,
        zIndex: maxZ + 1,
      };

      setNodes((nds) => {
        const updated = [...nds, newNode];
        markDirtyAndSave(updated, edgesRef.current);
        return updated;
      });

      setSelectedNodeId(newNode.id);
    },
    [pushSnapshot, setNodes, markDirtyAndSave, setSelectedNodeId],
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
      collabEmit("node:update", {
        storyboardId,
        node: { id: nodeId, data: data as unknown as Record<string, unknown> },
      });
    },
    [pushSnapshot, setNodes, markDirtyAndSave, collabEmit, storyboardId],
  );

  // Node list panel — focus on node
  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        reactFlowInstance.setCenter(
          node.position.x + 100,
          node.position.y + 50,
          {
            zoom: 1,
            duration: 500,
          },
        );
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
      // Explicitly sync refs to avoid race between React state and ref reads
      nodesRef.current = snapshot.nodes;
      edgesRef.current = snapshot.edges;
      markDirtyAndSave(snapshot.nodes, snapshot.edges);
    }
  }, [undo, setNodes, setEdges, markDirtyAndSave]);

  const handleShortcutRedo = useCallback(() => {
    const snapshot = redo();
    if (snapshot) {
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      // Explicitly sync refs to avoid race between React state and ref reads
      nodesRef.current = snapshot.nodes;
      edgesRef.current = snapshot.edges;
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

  // Group selected nodes
  const handleGroupNodes = useCallback(() => {
    const currentNodes = nodesRef.current;
    const selectedNodes = currentNodes.filter(
      (n) => n.selected && n.type !== "group",
    );
    if (selectedNodes.length < 2) return;

    pushSnapshot(currentNodes, edgesRef.current);

    // Calculate bounding box of selected nodes
    const padding = 20;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of selectedNodes) {
      const w = node.measured?.width ?? node.width ?? 180;
      const h = node.measured?.height ?? node.height ?? 80;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }

    const groupId = crypto.randomUUID();
    const groupPosition = { x: minX - padding, y: minY - padding };
    const groupWidth = maxX - minX + padding * 2;
    const groupHeight = maxY - minY + padding * 2;

    const groupNode: Node = {
      id: groupId,
      type: "group",
      position: groupPosition,
      width: groupWidth,
      height: groupHeight,
      style: { width: groupWidth, height: groupHeight },
      data: { title: "그룹" } as unknown as Record<string, unknown>,
    };

    setNodes((nds) => {
      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const updated = nds.map((n) => {
        if (selectedIds.has(n.id)) {
          return {
            ...n,
            parentId: groupId,
            extent: "parent" as const,
            position: {
              x: n.position.x - groupPosition.x,
              y: n.position.y - groupPosition.y,
            },
          };
        }
        return n;
      });
      // Group node must come before its children
      const result = [groupNode, ...updated];
      markDirtyAndSave(result, edgesRef.current);
      return result;
    });
  }, [pushSnapshot, setNodes, markDirtyAndSave]);

  // Ungroup selected group nodes
  const handleUngroupNodes = useCallback(() => {
    const currentNodes = nodesRef.current;
    const selectedGroups = currentNodes.filter(
      (n) => n.selected && n.type === "group",
    );
    if (selectedGroups.length === 0) return;

    pushSnapshot(currentNodes, edgesRef.current);

    const groupIds = new Set(selectedGroups.map((g) => g.id));
    const groupPositions = new Map(
      selectedGroups.map((g) => [g.id, g.position]),
    );

    setNodes((nds) => {
      const updated = nds
        .filter((n) => !groupIds.has(n.id))
        .map((n) => {
          if (n.parentId && groupIds.has(n.parentId)) {
            const groupPos = groupPositions.get(n.parentId)!;
            return {
              ...n,
              parentId: undefined,
              extent: undefined,
              position: {
                x: n.position.x + groupPos.x,
                y: n.position.y + groupPos.y,
              },
            };
          }
          return n;
        });
      markDirtyAndSave(updated, edgesRef.current);
      return updated;
    });
  }, [pushSnapshot, setNodes, markDirtyAndSave]);

  // Save-as-blueprint dialog state
  const [isSaveBlueprintOpen, setIsSaveBlueprintOpen] = useState(false);
  const [saveBlueprintContent, setSaveBlueprintContent] = useState<{
    nodes: Node[];
    edges: Edge[];
  }>({ nodes: [], edges: [] });

  const handleTitleChange = useCallback(
    (newName: string) => {
      setEditorName(newName);

      if (renameTimerRef.current) clearTimeout(renameTimerRef.current);

      if (!newName.trim()) return;

      renameTimerRef.current = setTimeout(() => {
        if (isBlueprint) {
          void editBlueprint(blueprintId, { name: newName.trim() });
        } else {
          void renameStoryboard(storyboardId, newName.trim());
        }
      }, 1000);
    },
    [isBlueprint, blueprintId, storyboardId],
  );

  const handleSaveAsBlueprint = useCallback(() => {
    const selectedNodes = nodesRef.current.filter((n) => n.selected);
    if (selectedNodes.length === 0) return;
    const content = extractBlueprintContent(selectedNodes, edgesRef.current);
    setSaveBlueprintContent(content);
    setIsSaveBlueprintOpen(true);
  }, []);

  // Wire keyboard shortcuts
  useEditorShortcuts({
    onSave: handleShortcutSave,
    onUndo: handleShortcutUndo,
    onRedo: handleShortcutRedo,
    onDuplicate: handleDuplicate,
    onGroup: handleGroupNodes,
    onUngroup: handleUngroupNodes,
    onSaveAsBlueprint: handleSaveAsBlueprint,
  });

  // collab 커스텀 이벤트 구독
  useEffect(() => {
    function onUserJoined(e: Event) {
      const { name } = (e as CustomEvent<{ name: string }>).detail;
      void name; // 토스트 추가 시 활용
    }
    function onUserLeft(e: Event) {
      const { name } = (e as CustomEvent<{ name: string }>).detail;
      void name;
    }
    function onConflict(e: Event) {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail;
      void nodeId;
    }
    window.addEventListener("collab:user-joined", onUserJoined);
    window.addEventListener("collab:user-left", onUserLeft);
    window.addEventListener("collab:conflict", onConflict);
    return () => {
      window.removeEventListener("collab:user-joined", onUserJoined);
      window.removeEventListener("collab:user-left", onUserLeft);
      window.removeEventListener("collab:conflict", onConflict);
    };
  }, []);

  // presence 기반 nodeClassName
  const presenceMap = useCollaborationStore((s) => s.presence);
  const nodeClassName = useCallback(
    (node: Node): string => {
      for (const p of Object.values(presenceMap)) {
        if (p.selectedNodeIds.includes(node.id)) {
          return "ring-2";
        }
      }
      return "";
    },
    [presenceMap],
  );

  // 마우스 이동 → presence 전송 (100ms throttle)
  const lastPresenceSendRef = useRef(0);
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastPresenceSendRef.current < 100) return;
      lastPresenceSendRef.current = now;
      const flowPos = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const selectedIds = nodesRef.current
        .filter((n) => n.selected)
        .map((n) => n.id);
      updatePresence(flowPos, selectedIds);
    },
    [reactFlowInstance, updatePresence],
  );

  // Template browser state
  const [isTemplateBrowserOpen, setIsTemplateBrowserOpen] = useState(false);

  const handleApplyTemplate = useCallback(
    (template: StoryboardTemplate, mode: "replace" | "append") => {
      pushSnapshot(nodesRef.current, edgesRef.current);

      const currentNodes = nodesRef.current;

      // Calculate offset: append places template to the right; replace starts at 0
      const offsetX =
        mode === "append" ? calcTemplateAppendOffset(currentNodes) : 0;

      // Build ID mapping: old template ID -> new unique ID
      const idMap = new Map<string, string>();
      for (const tNode of template.content.nodes) {
        idMap.set(tNode.id, crypto.randomUUID());
      }

      // Clone template nodes with new IDs and offset positions
      const maxZ = Math.max(0, ...currentNodes.map((n) => n.zIndex ?? 0));
      const clonedNodes: Node[] = template.content.nodes.map((tNode, i) => ({
        id: idMap.get(tNode.id)!,
        type: tNode.type,
        position: {
          x: tNode.position.x + offsetX,
          y: tNode.position.y,
        },
        data: { ...tNode.data } as unknown as Record<string, unknown>,
        zIndex: maxZ + 1 + i,
        ...(tNode.width != null ? { width: tNode.width } : {}),
        ...(tNode.height != null ? { height: tNode.height } : {}),
        ...(tNode.parentId && idMap.has(tNode.parentId)
          ? { parentId: idMap.get(tNode.parentId)!, extent: "parent" as const }
          : {}),
      }));

      // Clone template edges with new IDs, update source/target
      const clonedEdges: Edge[] = template.content.edges.map((tEdge) => ({
        id: crypto.randomUUID(),
        source: idMap.get(tEdge.source) ?? tEdge.source,
        target: idMap.get(tEdge.target) ?? tEdge.target,
        type: "labeled",
        ...(tEdge.sourceHandle ? { sourceHandle: tEdge.sourceHandle } : {}),
        ...(tEdge.label ? { label: tEdge.label } : {}),
      }));

      if (mode === "replace") {
        // Clear existing nodes/edges and set to cloned template content
        setNodes(() => {
          setEdges(() => {
            markDirtyAndSave(clonedNodes, clonedEdges);
            return clonedEdges;
          });
          return clonedNodes;
        });
      } else {
        // Append cloned nodes/edges to existing content
        setNodes((nds) => {
          const updated = [...nds, ...clonedNodes];
          setEdges((eds) => {
            const updatedEdges = [...eds, ...clonedEdges];
            markDirtyAndSave(updated, updatedEdges);
            return updatedEdges;
          });
          return updated;
        });
      }

      setIsTemplateBrowserOpen(false);
    },
    [pushSnapshot, setNodes, setEdges, markDirtyAndSave],
  );

  // Blueprint insert handler
  const handleBlueprintInsert = useCallback(
    (content: { nodes: Node[]; edges: Edge[] }) => {
      pushSnapshot(nodesRef.current, edgesRef.current);

      const viewport = reactFlowInstance.getViewport();
      const container = document.querySelector(".react-flow");
      const width = container?.clientWidth ?? 800;
      const height = container?.clientHeight ?? 600;
      const centerX = (-viewport.x + width / 2) / viewport.zoom;
      const centerY = (-viewport.y + height / 2) / viewport.zoom;

      const { nodes: newNodes, edges: newEdges } = instantiateBlueprint(
        content,
        { x: centerX, y: centerY },
      );

      setNodes((nds) => {
        const updated = [...nds, ...newNodes];
        setEdges((eds) => {
          const updatedEdges = [...eds, ...newEdges];
          markDirtyAndSave(updated, updatedEdges);
          return updatedEdges;
        });
        return updated;
      });
    },
    [pushSnapshot, reactFlowInstance, setNodes, setEdges, markDirtyAndSave],
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    const selectedNodes = nodesRef.current.filter((n) => n.selected);
    if (selectedNodes.length < 2) return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Align selected nodes
  const handleAlign = useCallback(
    (direction: AlignDirection) => {
      const currentNodes = nodesRef.current;
      const selectedNodes = currentNodes.filter((n) => n.selected);
      if (selectedNodes.length < 2) return;

      pushSnapshot(currentNodes, edgesRef.current);

      let targetValue: number;
      if (direction === "left") {
        targetValue = Math.min(...selectedNodes.map((n) => n.position.x));
      } else if (direction === "right") {
        targetValue = Math.max(
          ...selectedNodes.map(
            (n) => n.position.x + (n.measured?.width ?? n.width ?? 180),
          ),
        );
      } else if (direction === "top") {
        targetValue = Math.min(...selectedNodes.map((n) => n.position.y));
      } else {
        targetValue = Math.max(
          ...selectedNodes.map(
            (n) => n.position.y + (n.measured?.height ?? n.height ?? 80),
          ),
        );
      }

      const selectedIds = new Set(selectedNodes.map((n) => n.id));

      setNodes((nds) => {
        const updated = nds.map((n) => {
          if (!selectedIds.has(n.id)) return n;
          const w = n.measured?.width ?? n.width ?? 180;
          const h = n.measured?.height ?? n.height ?? 80;
          if (direction === "left") {
            return { ...n, position: { ...n.position, x: targetValue } };
          } else if (direction === "right") {
            return {
              ...n,
              position: { ...n.position, x: targetValue - w },
            };
          } else if (direction === "top") {
            return { ...n, position: { ...n.position, y: targetValue } };
          } else {
            return {
              ...n,
              position: { ...n.position, y: targetValue - h },
            };
          }
        });
        markDirtyAndSave(updated, edgesRef.current);
        return updated;
      });
    },
    [pushSnapshot, setNodes, markDirtyAndSave],
  );

  // Distribute selected nodes evenly
  const handleDistribute = useCallback(
    (axis: DistributeAxis) => {
      const currentNodes = nodesRef.current;
      const selectedNodes = currentNodes.filter((n) => n.selected);
      if (selectedNodes.length < 3) return;

      pushSnapshot(currentNodes, edgesRef.current);

      const selectedIds = new Set(selectedNodes.map((n) => n.id));

      if (axis === "horizontal") {
        const sorted = [...selectedNodes].sort(
          (a, b) => a.position.x - b.position.x,
        );
        const first = sorted[0]!;
        const last = sorted[sorted.length - 1]!;
        const totalSpan =
          last.position.x +
          (last.measured?.width ?? last.width ?? 180) -
          first.position.x;
        const totalNodeWidth = sorted.reduce(
          (sum, n) => sum + (n.measured?.width ?? n.width ?? 180),
          0,
        );
        const gap = (totalSpan - totalNodeWidth) / (sorted.length - 1);
        let currentX = first.position.x;
        const positionMap = new Map<string, number>();
        for (const node of sorted) {
          positionMap.set(node.id, currentX);
          currentX += (node.measured?.width ?? node.width ?? 180) + gap;
        }

        setNodes((nds) => {
          const updated = nds.map((n) => {
            if (!selectedIds.has(n.id)) return n;
            const newX = positionMap.get(n.id);
            if (newX == null) return n;
            return { ...n, position: { ...n.position, x: newX } };
          });
          markDirtyAndSave(updated, edgesRef.current);
          return updated;
        });
      } else {
        const sorted = [...selectedNodes].sort(
          (a, b) => a.position.y - b.position.y,
        );
        const first = sorted[0]!;
        const last = sorted[sorted.length - 1]!;
        const totalSpan =
          last.position.y +
          (last.measured?.height ?? last.height ?? 80) -
          first.position.y;
        const totalNodeHeight = sorted.reduce(
          (sum, n) => sum + (n.measured?.height ?? n.height ?? 80),
          0,
        );
        const gap = (totalSpan - totalNodeHeight) / (sorted.length - 1);
        let currentY = first.position.y;
        const positionMap = new Map<string, number>();
        for (const node of sorted) {
          positionMap.set(node.id, currentY);
          currentY += (node.measured?.height ?? node.height ?? 80) + gap;
        }

        setNodes((nds) => {
          const updated = nds.map((n) => {
            if (!selectedIds.has(n.id)) return n;
            const newY = positionMap.get(n.id);
            if (newY == null) return n;
            return { ...n, position: { ...n.position, y: newY } };
          });
          markDirtyAndSave(updated, edgesRef.current);
          return updated;
        });
      }
    },
    [pushSnapshot, setNodes, markDirtyAndSave],
  );

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

  return (
    <div className="flex h-full flex-col">
      {/* Editor header with undo/redo, save, layout */}
      <EditorHeader
        title={editorName}
        hasSelectedNodes={hasSelectedNodes}
        onUndo={handleShortcutUndo}
        onRedo={handleShortcutRedo}
        onSave={handleShortcutSave}
        onSaveAsBlueprint={handleSaveAsBlueprint}
        onBack={isBlueprint ? () => router.back() : undefined}
        onTitleChange={handleTitleChange}
        hideBlueprintSave={isBlueprint}
      />

      {/* Main editor area */}
      {(() => {
        const nodeListEl = (
          <NodeListPanel
            nodes={nodes}
            onNodeSelect={handleNodeSelect}
            onBlueprintInsert={isBlueprint ? undefined : handleBlueprintInsert}
            orgSlug={orgSlug}
            hideBlueprintTab={isBlueprint}
          />
        );
        const propertyEl = (
          <PropertyPanel
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onNodeDataChange={handleNodeDataChange}
          />
        );

        const showNodeList = layoutPreset !== "property-only" && isNodeListOpen;
        const showProperty = isPropertyPanelOpen;

        // Determine left and right panel contents based on preset
        let leftPanel: React.ReactNode = null;
        let rightPanel: React.ReactNode = null;
        let leftCollapsed = false;
        let rightCollapsed = false;

        const isPropertyOnly = layoutPreset === "property-only";

        if (layoutPreset === "reversed") {
          leftPanel = showProperty ? propertyEl : null;
          rightPanel = showNodeList ? nodeListEl : null;
          leftCollapsed = !showProperty;
          rightCollapsed = !isNodeListOpen;
        } else {
          leftPanel = showNodeList ? nodeListEl : null;
          rightPanel = showProperty ? propertyEl : null;
          leftCollapsed = !isPropertyOnly && !isNodeListOpen;
          rightCollapsed = !showProperty;
        }

        return (
          <div className="flex min-h-0 flex-1">
            {/* Left panel */}
            {leftPanel && (
              <aside
                className={`shrink-0 overflow-hidden border-r ${layoutPreset === "reversed" ? "w-72" : "w-60"}`}
              >
                {leftPanel}
              </aside>
            )}

            {/* Canvas - fills remaining space */}
            <div className="relative flex-1">
              {leftCollapsed && (
                <button
                  type="button"
                  className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-md border bg-card p-1.5 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
                  onClick={
                    layoutPreset === "reversed"
                      ? togglePropertyPanel
                      : toggleNodeList
                  }
                  aria-label={
                    layoutPreset === "reversed" ? "속성 열기" : "목록 열기"
                  }
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
              <div
                className="h-full w-full"
                onContextMenu={handleContextMenu}
                onMouseMove={handleCanvasMouseMove}
              >
                <Canvas
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onConnect={handleConnect}
                  onSelectionChange={handleSelectionChange}
                  onNodeDragStop={handleNodeDragStop}
                  onMoveEnd={handleMoveEnd}
                  onNodeDrop={handleNodeDrop}
                  nodeClassName={nodeClassName}
                />
                {contextMenu && (
                  <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onAlign={handleAlign}
                    onDistribute={handleDistribute}
                    onGroup={handleGroupNodes}
                    onUngroup={handleUngroupNodes}
                    onSaveAsBlueprint={handleSaveAsBlueprint}
                    onClose={handleCloseContextMenu}
                  />
                )}
              </div>
              {rightCollapsed && (
                <button
                  type="button"
                  className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-md border bg-card p-1.5 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
                  onClick={
                    layoutPreset === "reversed"
                      ? toggleNodeList
                      : togglePropertyPanel
                  }
                  aria-label={
                    layoutPreset === "reversed" ? "목록 열기" : "속성 열기"
                  }
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Right panel */}
            {rightPanel && (
              <aside
                className={`shrink-0 overflow-hidden border-l ${layoutPreset === "reversed" ? "w-60" : "w-72"}`}
              >
                {rightPanel}
              </aside>
            )}
          </div>
        );
      })()}

      {/* Toolbar */}
      <Toolbar
        onAddNode={handleAddNode}
        onOpenTemplates={() => setIsTemplateBrowserOpen(true)}
      />

      {/* Template browser modal */}
      <TemplateBrowser
        open={isTemplateBrowserOpen}
        onClose={() => setIsTemplateBrowserOpen(false)}
        onApply={handleApplyTemplate}
        currentNodeCount={nodes.length}
        currentEdgeCount={edges.length}
      />

      {/* Save-as-blueprint dialog */}
      <SaveBlueprintDialog
        open={isSaveBlueprintOpen}
        onOpenChange={setIsSaveBlueprintOpen}
        content={saveBlueprintContent}
      />
    </div>
  );
}
