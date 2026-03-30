import { memo } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import type { StoryboardNodeData } from "@repo/types";

function ConditionNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StoryboardNodeData;

  return (
    <div
      className={`rounded-lg border-2 bg-card px-4 py-3 shadow-sm transition-colors ${
        selected
          ? "border-red-500 ring-2 ring-red-500/20"
          : "border-border"
      }`}
      style={{
        minWidth: 180,
        borderLeftColor: nodeData.color ?? "#ef4444",
        borderLeftWidth: 4,
      }}
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
        className="bg-red-500! w-3! h-3!"
      />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-red-500">조건</span>
      </div>
      <p className="text-sm font-semibold text-foreground truncate">
        {nodeData.title || "제목 없음"}
      </p>
      {nodeData.conditionExpr && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
          {nodeData.conditionExpr}
        </p>
      )}
      <div className="mt-2 space-y-1">
        <div className="relative flex items-center">
          <span className="text-xs text-green-600 font-medium">True</span>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="bg-green-500! w-2.5! h-2.5!"
            style={{ top: "auto" }}
          />
        </div>
        <div className="relative flex items-center">
          <span className="text-xs text-red-600 font-medium">False</span>
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="bg-red-500! w-2.5! h-2.5!"
            style={{ top: "auto" }}
          />
        </div>
      </div>
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
