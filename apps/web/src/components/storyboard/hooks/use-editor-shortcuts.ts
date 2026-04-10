"use client";

import { useEffect } from "react";

interface UseEditorShortcutsOptions {
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onSaveAsBlueprint?: () => void;
  toggleHistory?: () => void;
}

export function useEditorShortcuts({
  onSave,
  onUndo,
  onRedo,
  onDuplicate,
  onGroup,
  onUngroup,
  onSaveAsBlueprint,
  toggleHistory,
}: UseEditorShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Block shortcuts when typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      // H key — toggle version history panel (no modifier)
      if ((e.key === "h" || e.key === "H") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleHistory?.();
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Ctrl+Shift+S: save as blueprint (must be checked before regular Ctrl+S)
      if (e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSaveAsBlueprint?.();
        return;
      }

      switch (e.key.toLowerCase()) {
        case "s":
          e.preventDefault();
          onSave();
          break;
        case "z":
          if (e.shiftKey) {
            e.preventDefault();
            onRedo();
          } else {
            e.preventDefault();
            onUndo();
          }
          break;
        case "y":
          e.preventDefault();
          onRedo();
          break;
        case "d":
          e.preventDefault();
          onDuplicate();
          break;
        case "g":
          if (e.shiftKey) {
            e.preventDefault();
            onUngroup?.();
          } else {
            e.preventDefault();
            onGroup?.();
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onSave,
    onUndo,
    onRedo,
    onDuplicate,
    onGroup,
    onUngroup,
    onSaveAsBlueprint,
    toggleHistory,
  ]);
}
