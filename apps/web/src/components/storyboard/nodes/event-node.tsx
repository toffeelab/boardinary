import { memo } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import type { StoryboardNodeData } from "@repo/types";

function EventNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StoryboardNodeData;

  return (
    <div
      className={`rounded-lg border-2 bg-card px-4 py-3 shadow-sm transition-colors ${
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500/20"
          : "border-border"
      }`}
      style={{
        minWidth: 180,
        borderLeftColor: nodeData.color ?? "#10b981",
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
        className="bg-emerald-500! w-3! h-3!"
      />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-emerald-500">이벤트</span>
      </div>
      <p className="text-sm font-semibold text-foreground truncate">
        {nodeData.title || "제목 없음"}
      </p>
      {nodeData.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {nodeData.description}
        </p>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="bg-emerald-500! w-3! h-3!"
      />
    </div>
  );
}

export const EventNode = memo(EventNodeComponent);
