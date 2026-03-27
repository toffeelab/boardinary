"use client";

import { useCallback, useMemo } from "react";
import type { Node } from "@xyflow/react";
import type { StoryboardNodeData } from "@repo/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface PropertyPanelProps {
  nodes: Node[];
  selectedNodeId: string | null;
  onNodeDataChange: (nodeId: string, data: StoryboardNodeData) => void;
}

const COLOR_PALETTE = [
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
  "#06b6d4",
  "#6b7280",
];

export function PropertyPanel({
  nodes,
  selectedNodeId,
  onNodeDataChange,
}: PropertyPanelProps) {
  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null),
    [nodes, selectedNodeId],
  );

  const nodeData = selectedNode
    ? (selectedNode.data as unknown as StoryboardNodeData)
    : null;

  const handleChange = useCallback(
    (field: keyof StoryboardNodeData, value: unknown) => {
      if (!selectedNodeId || !nodeData) return;
      onNodeDataChange(selectedNodeId, { ...nodeData, [field]: value });
    },
    [selectedNodeId, nodeData, onNodeDataChange],
  );

  const handleTagsChange = useCallback(
    (rawValue: string) => {
      const tags = rawValue
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      handleChange("tags", tags);
    },
    [handleChange],
  );

  const handleChoiceLabelChange = useCallback(
    (choiceId: string, label: string) => {
      if (!nodeData) return;
      const choices = (nodeData.choices ?? []).map((c) =>
        c.id === choiceId ? { ...c, label } : c,
      );
      handleChange("choices", choices);
    },
    [nodeData, handleChange],
  );

  const handleAddChoice = useCallback(() => {
    if (!nodeData) return;
    const choices = [
      ...(nodeData.choices ?? []),
      { id: crypto.randomUUID(), label: "" },
    ];
    handleChange("choices", choices);
  }, [nodeData, handleChange]);

  const handleRemoveChoice = useCallback(
    (choiceId: string) => {
      if (!nodeData) return;
      const choices = (nodeData.choices ?? []).filter((c) => c.id !== choiceId);
      handleChange("choices", choices);
    },
    [nodeData, handleChange],
  );

  if (!selectedNode || !nodeData) {
    return (
      <aside className="flex h-full flex-col bg-card">
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">속성</h2>
        </div>
        <Separator />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">노드를 선택하세요</p>
        </div>
      </aside>
    );
  }

  const nodeType = selectedNode.type as "scene" | "event" | "branch";

  return (
    <aside className="flex h-full flex-col bg-card">
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">속성</h2>
      </div>
      <Separator />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {/* 제목 */}
        <div className="space-y-1.5">
          <Label htmlFor="node-title" className="text-xs">
            제목
          </Label>
          <Input
            id="node-title"
            value={nodeData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="노드 제목"
          />
        </div>

        {/* 설명 */}
        <div className="space-y-1.5">
          <Label htmlFor="node-description" className="text-xs">
            설명
          </Label>
          <Textarea
            id="node-description"
            value={nodeData.description ?? ""}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="노드 설명"
            rows={3}
          />
        </div>

        {/* 태그 */}
        <div className="space-y-1.5">
          <Label htmlFor="node-tags" className="text-xs">
            태그 (쉼표 구분)
          </Label>
          <Input
            id="node-tags"
            value={(nodeData.tags ?? []).join(", ")}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder="태그1, 태그2"
          />
        </div>

        {/* 색상 */}
        <div className="space-y-1.5">
          <Label className="text-xs">색상</Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleChange("color", color)}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  nodeData.color === color
                    ? "scale-110 border-foreground"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: color }}
                aria-label={`색상 ${color}`}
              />
            ))}
          </div>
        </div>

        {/* 분기 전용: 선택지 */}
        {nodeType === "branch" && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs">선택지</Label>
              {(nodeData.choices ?? []).map((choice, index) => (
                <div key={choice.id} className="flex items-center gap-1.5">
                  <Input
                    value={choice.label}
                    onChange={(e) =>
                      handleChoiceLabelChange(choice.id, e.target.value)
                    }
                    placeholder={`선택지 ${index + 1}`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleRemoveChoice(choice.id)}
                    aria-label="선택지 삭제"
                  >
                    <span className="text-sm text-muted-foreground">×</span>
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleAddChoice}
              >
                선택지 추가
              </Button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
