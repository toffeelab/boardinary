"use client";

import { useCallback, useRef } from "react";
import type { Node, Edge, Viewport } from "@xyflow/react";
import type {
  StoryboardContentV1,
  StoryboardNode,
  StoryboardNodeData,
} from "@repo/types";
import { useEditorStore } from "@/stores/editor-store";
import { saveStoryboardAction } from "@/actions/save-storyboard-action";

const DEBOUNCE_MS = 2000;
const RETRY_DELAY_MS = 3000;

function toContentV1(
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport,
): StoryboardContentV1 {
  return {
    version: 1,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.type ?? "scene") as StoryboardNode["type"],
      position: { x: n.position.x, y: n.position.y },
      data: n.data as unknown as StoryboardNodeData,
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

interface UseAutoSaveOptions {
  storyboardId: string;
  userId: string;
  viewportRef: React.RefObject<Viewport>;
  hasUnsavedChangesRef: React.RefObject<boolean>;
}

export function useAutoSave({
  storyboardId,
  userId,
  viewportRef,
  hasUnsavedChangesRef,
}: UseAutoSaveOptions) {
  const { setSaveStatus, contentVersion, setContentVersion } =
    useEditorStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSave = useCallback(
    async (content: StoryboardContentV1, isRetry = false) => {
      setSaveStatus("saving");
      const result = await saveStoryboardAction(
        storyboardId,
        userId,
        content,
        contentVersion,
      );

      if (result.error) {
        if (result.error === "conflict") {
          setSaveStatus("conflict");
          return;
        }

        if (!isRetry) {
          retryRef.current = setTimeout(() => {
            void performSave(content, true);
          }, RETRY_DELAY_MS);
          return;
        }

        setSaveStatus("error");
        return;
      }

      if (result.contentVersion !== undefined) {
        setContentVersion(result.contentVersion);
      }
      hasUnsavedChangesRef.current = false;
      setSaveStatus("saved");
    },
    [storyboardId, userId, contentVersion, setSaveStatus, setContentVersion, hasUnsavedChangesRef],
  );

  const debouncedSave = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);

      timerRef.current = setTimeout(() => {
        const viewport = viewportRef.current ?? { x: 0, y: 0, zoom: 1 };
        const content = toContentV1(nodes, edges, viewport);
        void performSave(content);
      }, DEBOUNCE_MS);
    },
    [viewportRef, performSave],
  );

  const immediateSave = useCallback(
    (nodes: Node[], edges: Edge[], viewport: Viewport) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);

      const content = toContentV1(nodes, edges, viewport);
      void performSave(content);
    },
    [performSave],
  );

  return { debouncedSave, immediateSave };
}
