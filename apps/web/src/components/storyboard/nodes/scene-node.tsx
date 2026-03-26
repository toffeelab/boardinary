import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StoryboardNodeData } from "@repo/types";

function SceneNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StoryboardNodeData;

  return (
    <div
      className={`rounded-lg border-2 bg-card px-4 py-3 shadow-sm transition-colors ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
      style={{
        minWidth: 180,
        borderLeftColor: nodeData.color ?? "#8b5cf6",
        borderLeftWidth: 4,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="bg-primary! w-3! h-3!"
      />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-primary">씬</span>
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
        className="bg-primary! w-3! h-3!"
      />
    </div>
  );
}

export const SceneNode = memo(SceneNodeComponent);
