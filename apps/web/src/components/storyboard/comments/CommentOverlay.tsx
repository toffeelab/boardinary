"use client";

import { useViewport, useNodes } from "@xyflow/react";
import type { CommentDto } from "@repo/types";
import { CommentPin } from "./CommentPin";

interface CommentOverlayProps {
  comments: CommentDto[];
  activeCommentId: string | null;
  onPinClick: (commentId: string) => void;
  showResolved: boolean;
}

export function CommentOverlay({
  comments,
  activeCommentId,
  onPinClick,
  showResolved,
}: CommentOverlayProps) {
  const { x, y, zoom } = useViewport();
  const nodes = useNodes();

  const visible = showResolved
    ? comments
    : comments.filter((c) => c.status === "open");

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 20 }}
    >
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        {visible.map((comment) => {
          let pinX: number;
          let pinY: number;

          if (comment.anchorType === "node" && comment.anchorNodeId) {
            const node = nodes.find((n) => n.id === comment.anchorNodeId);
            if (!node) return null;
            pinX = node.position.x + (node.measured?.width ?? 180) / 2;
            pinY = node.position.y - 8;
          } else {
            pinX = comment.canvasX ?? 0;
            pinY = comment.canvasY ?? 0;
          }

          return (
            <CommentPin
              key={comment.id}
              comment={comment}
              x={pinX}
              y={pinY}
              isActive={comment.id === activeCommentId}
              onClick={onPinClick}
            />
          );
        })}
      </g>
    </svg>
  );
}
