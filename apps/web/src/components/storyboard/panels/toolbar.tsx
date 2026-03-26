"use client";

import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/stores/editor-store";

type StoryboardNodeType = "scene" | "event" | "branch";

interface ToolbarProps {
  onAddNode: (type: StoryboardNodeType) => void;
}

const ADD_BUTTONS: {
  type: StoryboardNodeType;
  label: string;
  color: string;
}[] = [
  { type: "scene", label: "+ 씬", color: "#8b5cf6" },
  { type: "event", label: "+ 이벤트", color: "#10b981" },
  { type: "branch", label: "+ 분기", color: "#f59e0b" },
];

export function Toolbar({ onAddNode }: ToolbarProps) {
  const { isNodeListOpen, toggleNodeList } = useEditorStore();

  return (
    <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-2">
      <Button
        type="button"
        variant={isNodeListOpen ? "secondary" : "ghost"}
        size="sm"
        onClick={toggleNodeList}
      >
        {isNodeListOpen ? "목록 닫기" : "목록 열기"}
      </Button>

      <div className="mx-2 h-5 w-px bg-border" />

      {ADD_BUTTONS.map(({ type, label, color }) => (
        <Button
          key={type}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAddNode(type)}
          className="gap-1.5"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {label}
        </Button>
      ))}
    </div>
  );
}
