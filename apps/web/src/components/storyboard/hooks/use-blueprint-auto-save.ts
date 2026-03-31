"use client";

import { useCallback, useRef } from "react";
import type { Node, Edge, Viewport } from "@xyflow/react";
import type { StoryboardNode, StoryboardNodeData } from "@repo/types";
import { useEditorStore } from "@/stores/editor-store";
import { editBlueprint } from "@/actions/blueprint-actions";

const DEBOUNCE_MS = 2000;

function toBlueprintContent(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.type ?? "scene") as StoryboardNode["type"],
      position: { x: n.position.x, y: n.position.y },
      data: n.data as unknown as StoryboardNodeData,
      ...(n.width != null ? { width: n.width } : {}),
      ...(n.height != null ? { height: n.height } : {}),
      ...(n.parentId ? { parentId: n.parentId } : {}),
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(typeof e.label === "string" ? { label: e.label } : {}),
    })),
  };
}

interface UseBlueprintAutoSaveOptions {
  blueprintId: string;
  viewportRef: React.RefObject<Viewport>;
  hasUnsavedChangesRef: React.RefObject<boolean>;
}

export function useBlueprintAutoSave({
  blueprintId,
  viewportRef,
  hasUnsavedChangesRef,
}: UseBlueprintAutoSaveOptions) {
  const { setSaveStatus } = useEditorStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSave = useCallback(
    async (content: Record<string, unknown>) => {
      setSaveStatus("saving");
      try {
        await editBlueprint(blueprintId, { content });
        hasUnsavedChangesRef.current = false;
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    [blueprintId, setSaveStatus, hasUnsavedChangesRef],
  );

  const debouncedSave = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        const content = toBlueprintContent(nodes, edges);
        void performSave(content as unknown as Record<string, unknown>);
      }, DEBOUNCE_MS);
    },
    [performSave],
  );

  const immediateSave = useCallback(
    (nodes: Node[], edges: Edge[], _viewport: Viewport) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const content = toBlueprintContent(nodes, edges);
      void performSave(content as unknown as Record<string, unknown>);
    },
    [performSave],
  );

  return { debouncedSave, immediateSave };
}
