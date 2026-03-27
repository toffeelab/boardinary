import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import type { StoryboardNodeData } from "@repo/types";

function GroupNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StoryboardNodeData;

  return (
    <div
      className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
        selected
          ? "border-primary/60 bg-primary/5"
          : "border-muted-foreground/20 bg-muted/5"
      }`}
      style={{ width: "100%", height: "100%", minWidth: 200, minHeight: 100 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={100}
        handleStyle={{ width: 8, height: 8 }}
      />
      <p className="text-xs font-medium text-muted-foreground">
        {nodeData.title || "그룹"}
      </p>
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
