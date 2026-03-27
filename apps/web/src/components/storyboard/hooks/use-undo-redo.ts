"use client";

import { useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useEditorStore } from "@/stores/editor-store";

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

export function useUndoRedo() {
  const { pushHistory, undo: storeUndo, redo: storeRedo } = useEditorStore();

  const pushSnapshot = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      pushHistory({ nodes, edges });
    },
    [pushHistory],
  );

  const undo = useCallback((): Snapshot | null => {
    return storeUndo();
  }, [storeUndo]);

  const redo = useCallback((): Snapshot | null => {
    return storeRedo();
  }, [storeRedo]);

  return { pushSnapshot, undo, redo };
}
