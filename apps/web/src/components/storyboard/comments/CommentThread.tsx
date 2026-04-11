"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommentInput } from "./CommentInput";
import type { CommentDto, CommentReplyDto } from "@repo/types";

interface CommentThreadProps {
  comment: CommentDto;
  currentUserId: string;
  onDelete: (commentId: string) => Promise<void>;
  onStatusChange: (
    commentId: string,
    status: "open" | "resolved",
  ) => Promise<void>;
  onAddReply: (commentId: string, content: string) => Promise<void>;
  onUpdateReply: (replyId: string, content: string) => Promise<void>;
  onDeleteReply: (replyId: string) => Promise<void>;
}

function ReplyItem({
  reply,
  currentUserId,
  onUpdate,
  onDelete,
}: {
  reply: CommentReplyDto;
  currentUserId: string;
  onUpdate: (replyId: string, content: string) => Promise<void>;
  onDelete: (replyId: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const isAuthor = reply.author.id === currentUserId;

  return (
    <div className="flex flex-col gap-1 border-l-2 border-border py-1 pl-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">
          {reply.author.name ?? "알 수 없음"}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(reply.createdAt).toLocaleDateString("ko-KR")}
        </span>
      </div>
      {isEditing ? (
        <CommentInput
          placeholder="답글 수정..."
          onSubmit={async (content) => {
            await onUpdate(reply.id, content);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
          autoFocus
        />
      ) : (
        <p className="text-sm">{reply.content}</p>
      )}
      {isAuthor && !isEditing && (
        <div className="flex gap-2">
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditing(true)}
          >
            수정
          </button>
          <button
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={() => void onDelete(reply.id)}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

export function CommentThread({
  comment,
  currentUserId,
  onDelete,
  onStatusChange,
  onAddReply,
  onUpdateReply,
  onDeleteReply,
}: CommentThreadProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const isAuthor = comment.author.id === currentUserId;
  const isResolved = comment.status === "resolved";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            {comment.author.name ?? "알 수 없음"}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString("ko-KR")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isResolved ? (
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-600">
              해결됨
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() =>
              void onStatusChange(comment.id, isResolved ? "open" : "resolved")
            }
          >
            {isResolved ? "재오픈" : "해결"}
          </Button>
          {isAuthor && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => void onDelete(comment.id)}
            >
              삭제
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-sm">{comment.content}</p>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="flex flex-col gap-2">
          {comment.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              onUpdate={onUpdateReply}
              onDelete={onDeleteReply}
            />
          ))}
        </div>
      )}

      {/* Reply Input */}
      {showReplyInput ? (
        <CommentInput
          placeholder="답글을 입력하세요..."
          onSubmit={async (content) => {
            await onAddReply(comment.id, content);
            setShowReplyInput(false);
          }}
          onCancel={() => setShowReplyInput(false)}
          autoFocus
        />
      ) : (
        <button
          className="self-start text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowReplyInput(true)}
        >
          + 답글
        </button>
      )}
    </div>
  );
}
