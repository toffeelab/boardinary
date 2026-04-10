"use client";

import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommentThread } from "./CommentThread";
import type { CommentDto } from "@repo/types";

interface CommentPanelProps {
  comments: CommentDto[];
  activeCommentId: string | null;
  currentUserId: string;
  showResolved: boolean;
  onToggleResolved: () => void;
  onClose: () => void;
  onDelete: (commentId: string) => Promise<void>;
  onStatusChange: (
    commentId: string,
    status: "open" | "resolved",
  ) => Promise<void>;
  onAddReply: (commentId: string, content: string) => Promise<void>;
  onUpdateReply: (replyId: string, content: string) => Promise<void>;
  onDeleteReply: (replyId: string) => Promise<void>;
}

export function CommentPanel({
  comments,
  activeCommentId,
  currentUserId,
  showResolved,
  onToggleResolved,
  onClose,
  onDelete,
  onStatusChange,
  onAddReply,
  onUpdateReply,
  onDeleteReply,
}: CommentPanelProps) {
  const activeRef = useRef<HTMLDivElement | null>(null);

  const visible = showResolved
    ? comments
    : comments.filter((c) => c.status === "open");

  useEffect(() => {
    if (activeCommentId && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeCommentId]);

  return (
    <div
      className="absolute right-0 top-0 z-30 flex h-full w-80 flex-col border-l border-border bg-card shadow-lg"
      style={{ animation: "slideIn 0.2s ease-out" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">주석 ({visible.length})</h3>
        <div className="flex items-center gap-2">
          <button
            className={`text-xs ${showResolved ? "text-foreground" : "text-muted-foreground"} hover:text-foreground`}
            onClick={onToggleResolved}
          >
            {showResolved ? "미해결만" : "전체 보기"}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3 overflow-y-auto p-3">
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {showResolved ? "주석이 없습니다." : "미해결 주석이 없습니다."}
          </p>
        )}
        {visible.map((comment) => (
          <div
            key={comment.id}
            ref={comment.id === activeCommentId ? activeRef : null}
            className={
              comment.id === activeCommentId
                ? "rounded-lg ring-2 ring-primary"
                : ""
            }
          >
            <CommentThread
              comment={comment}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onAddReply={onAddReply}
              onUpdateReply={onUpdateReply}
              onDeleteReply={onDeleteReply}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
