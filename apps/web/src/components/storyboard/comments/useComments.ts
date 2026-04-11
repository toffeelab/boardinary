"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import type {
  CommentDto,
  CommentReplyDto,
  CreateCommentDto,
  CreateReplyDto,
  UpdateCommentStatusDto,
  UpdateReplyDto,
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentStatusChangedEvent,
  ReplyCreatedEvent,
  ReplyUpdatedEvent,
  ReplyDeletedEvent,
} from "@repo/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

interface UseCommentsOptions {
  storyboardId: string;
  socket: Socket | null;
}

export function useComments({ storyboardId, socket }: UseCommentsOptions) {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const optimisticIdRef = useRef(0);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/storyboards/${storyboardId}/comments`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) return;
      const data: CommentDto[] = await res.json();
      setComments(data);
    } finally {
      setIsLoading(false);
    }
  }, [storyboardId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  // Socket 이벤트 구독
  useEffect(() => {
    if (!socket) return;

    const onCommentCreated = ({ comment }: CommentCreatedEvent) => {
      setComments((prev) => {
        const withoutOptimistic = prev.filter(
          (c) => !c.id.startsWith("optimistic-"),
        );
        return [
          comment,
          ...withoutOptimistic.filter((c) => c.id !== comment.id),
        ];
      });
    };

    const onCommentDeleted = ({ commentId }: CommentDeletedEvent) => {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    };

    const onCommentStatusChanged = ({
      commentId,
      status,
      resolvedBy,
      resolvedAt,
    }: CommentStatusChangedEvent) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, status, resolvedBy, resolvedAt } : c,
        ),
      );
    };

    const onReplyCreated = ({ reply }: ReplyCreatedEvent) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === reply.commentId
            ? {
                ...c,
                replies: [...c.replies.filter((r) => r.id !== reply.id), reply],
              }
            : c,
        ),
      );
    };

    const onReplyUpdated = ({ reply }: ReplyUpdatedEvent) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === reply.commentId
            ? {
                ...c,
                replies: c.replies.map((r) => (r.id === reply.id ? reply : r)),
              }
            : c,
        ),
      );
    };

    const onReplyDeleted = ({ replyId, commentId }: ReplyDeletedEvent) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, replies: c.replies.filter((r) => r.id !== replyId) }
            : c,
        ),
      );
    };

    socket.on("comment:created", onCommentCreated);
    socket.on("comment:deleted", onCommentDeleted);
    socket.on("comment:status_changed", onCommentStatusChanged);
    socket.on("reply:created", onReplyCreated);
    socket.on("reply:updated", onReplyUpdated);
    socket.on("reply:deleted", onReplyDeleted);

    return () => {
      socket.off("comment:created", onCommentCreated);
      socket.off("comment:deleted", onCommentDeleted);
      socket.off("comment:status_changed", onCommentStatusChanged);
      socket.off("reply:created", onReplyCreated);
      socket.off("reply:updated", onReplyUpdated);
      socket.off("reply:deleted", onReplyDeleted);
    };
  }, [socket]);

  const addComment = useCallback(
    async (dto: CreateCommentDto): Promise<CommentDto | null> => {
      const optimisticId = `optimistic-${++optimisticIdRef.current}`;
      const optimistic: CommentDto = {
        id: optimisticId,
        storyboardId,
        author: { id: "", name: null, image: null },
        anchorType: dto.anchorType,
        anchorNodeId: dto.anchorNodeId ?? null,
        canvasX: dto.canvasX ?? null,
        canvasY: dto.canvasY ?? null,
        content: dto.content,
        status: "open",
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        replies: [],
      };
      setComments((prev) => [optimistic, ...prev]);

      try {
        const res = await fetch(
          `${API_BASE}/storyboards/${storyboardId}/comments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(dto),
          },
        );
        if (!res.ok) {
          setComments((prev) => prev.filter((c) => c.id !== optimisticId));
          return null;
        }
        const comment: CommentDto = await res.json();
        setComments((prev) =>
          prev.map((c) => (c.id === optimisticId ? comment : c)),
        );
        return comment;
      } catch {
        setComments((prev) => prev.filter((c) => c.id !== optimisticId));
        return null;
      }
    },
    [storyboardId],
  );

  const deleteComment = useCallback(async (commentId: string) => {
    await fetch(`${API_BASE}/comments/${commentId}`, {
      method: "DELETE",
      credentials: "include",
    });
  }, []);

  const updateCommentStatus = useCallback(
    async (commentId: string, dto: UpdateCommentStatusDto) => {
      await fetch(`${API_BASE}/comments/${commentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dto),
      });
    },
    [],
  );

  const addReply = useCallback(
    async (
      commentId: string,
      dto: CreateReplyDto,
    ): Promise<CommentReplyDto | null> => {
      const res = await fetch(`${API_BASE}/comments/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dto),
      });
      if (!res.ok) return null;
      return res.json();
    },
    [],
  );

  const updateReply = useCallback(
    async (
      replyId: string,
      dto: UpdateReplyDto,
    ): Promise<CommentReplyDto | null> => {
      const res = await fetch(`${API_BASE}/replies/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dto),
      });
      if (!res.ok) return null;
      return res.json();
    },
    [],
  );

  const deleteReply = useCallback(async (replyId: string) => {
    await fetch(`${API_BASE}/replies/${replyId}`, {
      method: "DELETE",
      credentials: "include",
    });
  }, []);

  return {
    comments,
    isLoading,
    addComment,
    deleteComment,
    updateCommentStatus,
    addReply,
    updateReply,
    deleteReply,
  };
}
