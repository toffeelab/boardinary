import type { Node } from "@xyflow/react";

const DEFAULT_NODE_WIDTH = 200;
const APPEND_GAP = 300;

export function calcTemplateAppendOffset(existingNodes: Node[]): number {
  if (existingNodes.length === 0) return 0;

  const maxX = Math.max(
    ...existingNodes.map(
      (n) => n.position.x + (n.measured?.width ?? DEFAULT_NODE_WIDTH),
    ),
  );

  return maxX + APPEND_GAP;
}
