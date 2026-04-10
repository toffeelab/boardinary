import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Node, Edge } from "@xyflow/react";

interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

export type LayoutPreset = "default" | "reversed" | "property-only";

interface EditorState {
  // UI 상태
  isNodeListOpen: boolean;
  isPropertyPanelOpen: boolean;
  selectedNodeId: string | null;
  saveStatus: "idle" | "saving" | "saved" | "error" | "conflict";
  contentVersion: number;

  // 주석 모드
  isCommentMode: boolean;
  activeCommentId: string | null;

  // 레이아웃 (persist)
  layoutPreset: LayoutPreset;
  leftPanelTab: "elements" | "blueprints";

  // Undo/Redo
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // 액션
  toggleNodeList: () => void;
  togglePropertyPanel: () => void;
  setSelectedNodeId: (id: string | null) => void;
  setSaveStatus: (status: EditorState["saveStatus"]) => void;
  setContentVersion: (version: number) => void;
  setLayoutPreset: (preset: LayoutPreset) => void;
  setLeftPanelTab: (tab: "elements" | "blueprints") => void;

  // 주석 모드 액션
  setCommentMode: (active: boolean) => void;
  setActiveCommentId: (id: string | null) => void;

  // Undo/Redo 액션
  pushHistory: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  clearHistory: () => void;
}

const MAX_HISTORY = 50;

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      isNodeListOpen: true,
      isPropertyPanelOpen: true,
      selectedNodeId: null,
      saveStatus: "idle",
      contentVersion: 0,

      isCommentMode: false,
      activeCommentId: null,

      layoutPreset: "default" as LayoutPreset,
      leftPanelTab: "elements" as const,

      undoStack: [],
      redoStack: [],

      toggleNodeList: () => set((s) => ({ isNodeListOpen: !s.isNodeListOpen })),
      togglePropertyPanel: () =>
        set((s) => ({ isPropertyPanelOpen: !s.isPropertyPanelOpen })),
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),
      setSaveStatus: (status) => set({ saveStatus: status }),
      setContentVersion: (version) => set({ contentVersion: version }),
      setLayoutPreset: (preset) => set({ layoutPreset: preset }),
      setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),

      setCommentMode: (active) =>
        set({
          isCommentMode: active,
          ...(active ? {} : { activeCommentId: null }),
        }),
      setActiveCommentId: (id) => set({ activeCommentId: id }),

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
    }),
    {
      name: "boardinary-editor",
      partialize: (state) => ({
        isNodeListOpen: state.isNodeListOpen,
        isPropertyPanelOpen: state.isPropertyPanelOpen,
        layoutPreset: state.layoutPreset,
        leftPanelTab: state.leftPanelTab,
      }),
    },
  ),
);
