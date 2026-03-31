"use client";

import { Undo2, Redo2, Save, Bookmark, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEditorStore, type LayoutPreset } from "@/stores/editor-store";

interface EditorHeaderProps {
  title: string;
  hasSelectedNodes: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAsBlueprint: () => void;
}

const PRESET_LABELS: Record<LayoutPreset, string> = {
  default: "기본",
  reversed: "역배치",
  "property-only": "속성만",
};

export function EditorHeader({
  title,
  hasSelectedNodes,
  onUndo,
  onRedo,
  onSave,
  onSaveAsBlueprint,
}: EditorHeaderProps) {
  const { saveStatus, undoStack, redoStack, layoutPreset, setLayoutPreset } =
    useEditorStore();

  const statusText: Record<typeof saveStatus, string> = {
    idle: "",
    saving: "저장 중...",
    saved: "저장됨",
    error: "저장 실패",
    conflict: "충돌",
  };

  const statusColor: Record<typeof saveStatus, string> = {
    idle: "text-muted-foreground",
    saving: "text-muted-foreground",
    saved: "text-green-600",
    error: "text-destructive",
    conflict: "text-amber-500",
  };

  return (
    <TooltipProvider>
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-1.5">
        {/* Left: Title + Undo/Redo */}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {title}
          </h1>

          <div className="mx-1 h-5 w-px bg-border" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onUndo}
                disabled={undoStack.length === 0}
                aria-label="실행 취소"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>실행 취소 (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onRedo}
                disabled={redoStack.length === 0}
                aria-label="다시 실행"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>다시 실행 (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
        </div>

        {/* Center: Save status + Save + Blueprint Save */}
        <div className="flex items-center gap-2">
          {statusText[saveStatus] && (
            <span className={`text-xs ${statusColor[saveStatus]}`}>
              {statusText[saveStatus]}
            </span>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSave}
                className="gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span className="hidden md:inline">저장</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>저장 (Ctrl+S)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSaveAsBlueprint}
                disabled={!hasSelectedNodes}
                className="gap-1.5"
              >
                <Bookmark className="h-4 w-4" />
                <span className="hidden md:inline">블루프린트 저장</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasSelectedNodes
                ? "선택한 노드를 블루프린트로 저장 (Ctrl+Shift+B)"
                : "노드를 선택해주세요"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right: Layout dropdown */}
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden md:inline">레이아웃</span>
                <span className="md:hidden">{PRESET_LABELS[layoutPreset]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
      </div>
    </TooltipProvider>
  );
}
