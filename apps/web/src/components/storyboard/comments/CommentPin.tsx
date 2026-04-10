"use client";

import type { CommentDto } from "@repo/types";

interface CommentPinProps {
  comment: CommentDto;
  x: number;
  y: number;
  isActive: boolean;
  onClick: (commentId: string) => void;
}

export function CommentPin({
  comment,
  x,
  y,
  isActive,
  onClick,
}: CommentPinProps) {
  const replyCount = comment.replies.length;
  const isResolved = comment.status === "resolved";

  return (
    <foreignObject
      x={x - 12}
      y={y - 12}
      width={isResolved ? 24 : replyCount > 0 ? 36 : 24}
      height={24}
      style={{ overflow: "visible", pointerEvents: "auto", cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(comment.id);
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: isActive ? "#89b4fa" : isResolved ? "#a6e3a1" : "#f38ba8",
          borderRadius: 12,
          padding: "2px 6px",
          fontSize: 10,
          fontWeight: 700,
          color: "#1e1e2e",
          border: `2px solid ${isActive ? "#74c7ec" : "transparent"}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {isResolved ? "✓" : replyCount > 0 ? `💬 ${replyCount}` : "💬"}
      </div>
    </foreignObject>
  );
}
