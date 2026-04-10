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
  onToggleCommentMode?: () => void;
  onExitCommentMode?: () => void;
}

export function useEditorShortcuts({
  onSave,
  onUndo,
  onRedo,
  onDuplicate,
  onGroup,
  onUngroup,
  onSaveAsBlueprint,
  onToggleCommentMode,
  onExitCommentMode,
}: UseEditorShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // C 키: 주석 모드 토글 (Ctrl/Cmd 없이)
      if (!mod && !e.shiftKey && e.key.toLowerCase() === "c") {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        )
          return;
        e.preventDefault();
        onToggleCommentMode?.();
        return;
      }

      // Escape: 주석 모드 종료
      if (e.key === "Escape") {
        onExitCommentMode?.();
        return;
      }

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
    onToggleCommentMode,
    onExitCommentMode,
  ]);
}
