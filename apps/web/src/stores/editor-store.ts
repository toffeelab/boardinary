import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

interface EditorState {
  // UI 상태
  isNodeListOpen: boolean;
  selectedNodeId: string | null;
  saveStatus: "idle" | "saving" | "saved" | "error" | "conflict";
  contentVersion: number;

  // Undo/Redo
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // 액션
  toggleNodeList: () => void;
  setSelectedNodeId: (id: string | null) => void;
  setSaveStatus: (status: EditorState["saveStatus"]) => void;
  setContentVersion: (version: number) => void;

  // Undo/Redo 액션
  pushHistory: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  clearHistory: () => void;
}

const MAX_HISTORY = 50;

export const useEditorStore = create<EditorState>((set, get) => ({
  isNodeListOpen: true,
  selectedNodeId: null,
  saveStatus: "idle",
  contentVersion: 0,

  undoStack: [],
  redoStack: [],

  toggleNodeList: () =>
    set((s) => ({ isNodeListOpen: !s.isNodeListOpen })),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setContentVersion: (version) => set({ contentVersion: version }),

  pushHistory: (entry) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), entry],
      redoStack: [],
    })),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    const entry = undoStack[undoStack.length - 1]!;
    set((s) => ({
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, entry],
    }));
    return entry;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;
    const entry = redoStack[redoStack.length - 1]!;
    set((s) => ({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, entry],
    }));
    return entry;
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),
}));
