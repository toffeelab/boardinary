import { memo } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import type { StoryboardNodeData } from "@repo/types";

function BranchNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StoryboardNodeData;
  const choices = nodeData.choices ?? [];

  return (
    <div
      className={`rounded-lg border-2 bg-card px-4 py-3 shadow-sm transition-colors ${
        selected
          ? "border-amber-500 ring-2 ring-amber-500/20"
          : "border-border"
      }`}
      style={{ minWidth: 200, borderLeftColor: "#f59e0b", borderLeftWidth: 4 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        handleStyle={{ width: 8, height: 8 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="bg-amber-500! w-3! h-3!"
      />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-amber-500">분기</span>
      </div>
      <p className="text-sm font-semibold text-foreground truncate">
        {nodeData.title || "제목 없음"}
      </p>
      {choices.length > 0 && (
        <div className="mt-2 space-y-1">
          {choices.map((choice, index) => (
            <div key={choice.id} className="relative flex items-center">
              <span className="text-xs text-muted-foreground truncate">
                {choice.label || `선택지 ${index + 1}`}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={choice.id}
                className="bg-amber-500! w-2.5! h-2.5!"
                style={{ top: "auto" }}
              />
            </div>
          ))}
        </div>
      )}
      {choices.length === 0 && (
        <Handle
          type="source"
          position={Position.Right}
          className="bg-amber-500! w-3! h-3!"
        />
      )}
    </div>
  );
}

export const BranchNode = memo(BranchNodeComponent);
