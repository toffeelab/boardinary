"use client";

import { ClipboardList, History } from "lucide-react";
import { Button } from "@/components/ui/button";

type StoryboardNodeType =
  | "scene"
  | "event"
  | "branch"
  | "dialogue"
  | "condition"
  | "note";

interface ToolbarProps {
  onAddNode: (type: StoryboardNodeType) => void;
  onOpenTemplates?: () => void;
  onToggleHistory?: () => void;
}

const ADD_BUTTONS: {
  type: StoryboardNodeType;
  label: string;
  color: string;
}[] = [
  { type: "scene", label: "+ 씬", color: "#8b5cf6" },
  { type: "event", label: "+ 이벤트", color: "#10b981" },
  { type: "branch", label: "+ 분기", color: "#f59e0b" },
  { type: "dialogue", label: "+ 대사", color: "#3b82f6" },
  { type: "condition", label: "+ 조건", color: "#ef4444" },
  { type: "note", label: "+ 메모", color: "#6b7280" },
];

export function Toolbar({
  onAddNode,
  onOpenTemplates,
  onToggleHistory,
}: ToolbarProps) {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-border bg-card px-4 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {ADD_BUTTONS.map(({ type, label, color }) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/boardinary-node", type);
              e.dataTransfer.effectAllowed = "move";
            }}
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

      {onOpenTemplates && (
        <>
          <div className="mx-2 h-5 w-px bg-border" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenTemplates}
            className="gap-1.5"
          >
            <ClipboardList className="h-4 w-4" />
            템플릿
          </Button>
        </>
      )}

      {onToggleHistory && (
        <>
          <div className="mx-2 h-5 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleHistory}
            title="버전 히스토리 (H)"
            className="gap-1.5"
          >
            <History className="h-4 w-4" />
            히스토리
          </Button>
        </>
      )}
    </div>
  );
}
