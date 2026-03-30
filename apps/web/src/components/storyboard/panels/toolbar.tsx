"use client";

import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEditorStore, type LayoutPreset } from "@/stores/editor-store";

type StoryboardNodeType =
  | "scene"
  | "event"
  | "branch"
  | "dialogue"
  | "condition"
  | "note";

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
  { type: "dialogue", label: "+ 대사", color: "#3b82f6" },
  { type: "condition", label: "+ 조건", color: "#ef4444" },
  { type: "note", label: "+ 메모", color: "#6b7280" },
];

const PRESET_LABELS: Record<LayoutPreset, string> = {
  default: "기본",
  reversed: "역배치",
  "property-only": "속성만",
};

export function Toolbar({ onAddNode }: ToolbarProps) {
  const {
    isNodeListOpen,
    toggleNodeList,
    isPropertyPanelOpen,
    togglePropertyPanel,
    layoutPreset,
    setLayoutPreset,
  } = useEditorStore();

  return (
    <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-2">
      <Button
        type="button"
        variant={isNodeListOpen ? "secondary" : "ghost"}
        size="sm"
        onClick={toggleNodeList}
        disabled={layoutPreset === "property-only"}
        title={layoutPreset === "property-only" ? "속성만 레이아웃에서는 목록을 사용할 수 없습니다" : undefined}
      >
        {isNodeListOpen ? "목록 닫기" : "목록 열기"}
      </Button>

      <Button
        type="button"
        variant={isPropertyPanelOpen ? "secondary" : "ghost"}
        size="sm"
        onClick={togglePropertyPanel}
      >
        {isPropertyPanelOpen ? "속성 닫기" : "속성 열기"}
      </Button>

      <div className="mx-2 h-5 w-px bg-border" />

      <div className="flex flex-wrap items-center gap-1.5">
        {ADD_BUTTONS.map(({ type, label, color }) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "application/boardinary-node",
                type,
              );
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

      <div className="mx-2 h-5 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="gap-1.5">
            <LayoutGrid className="h-4 w-4" />
            {PRESET_LABELS[layoutPreset]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={layoutPreset}
            onValueChange={(value) =>
              setLayoutPreset(value as LayoutPreset)
            }
          >
            <DropdownMenuRadioItem value="default">
              기본 (목록 좌 / 속성 우)
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="reversed">
              역배치 (속성 좌 / 목록 우)
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="property-only">
              속성만 (목록 없음)
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
