"use client";

import { useEffect } from "react";

interface UseEditorShortcutsOptions {
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
}

export function useEditorShortcuts({
  onSave,
  onUndo,
  onRedo,
  onDuplicate,
}: UseEditorShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

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
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, onUndo, onRedo, onDuplicate]);
}
