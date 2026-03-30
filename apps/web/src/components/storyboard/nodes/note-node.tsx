import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import type { StoryboardNodeData } from "@repo/types";

function NoteNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StoryboardNodeData;

  return (
    <div
      className={`rounded-lg border-2 border-dashed px-4 py-3 shadow-sm transition-colors ${
        selected
          ? "border-gray-500 ring-2 ring-gray-500/20"
          : "border-gray-300"
      }`}
      style={{
        minWidth: 160,
        backgroundColor: "rgba(107, 114, 128, 0.08)",
        borderColor: selected ? "#6b7280" : "#d1d5db",
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-gray-500">메모</span>
      </div>
      <p className="text-sm font-semibold text-foreground truncate">
        {nodeData.title || "제목 없음"}
      </p>
      {nodeData.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
          {nodeData.description}
        </p>
      )}
    </div>
  );
}

export const NoteNode = memo(NoteNodeComponent);
