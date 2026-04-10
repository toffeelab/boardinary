import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
import { db, comments, commentReplies, users } from "@repo/db";
import type { Server } from "socket.io";
import type {
  CommentDto,
  CommentReplyDto,
  CommentAuthor,
  CreateCommentDto,
  CreateReplyDto,
  UpdateCommentStatusDto,
  UpdateReplyDto,
} from "@repo/types";

@Injectable()
export class CommentsService {
  private server!: Server;

  setServer(server: Server) {
    this.server = server;
  }

  private formatAuthor(row: {
    id: string;
    name: string | null;
    image: string | null;
  }): CommentAuthor {
    return { id: row.id, name: row.name, image: row.image };
  }

  private formatComment(
    row: typeof comments.$inferSelect,
    author: CommentAuthor,
    replies: CommentReplyDto[] = [],
  ): CommentDto {
    return {
      id: row.id,
      storyboardId: row.storyboardId,
      author,
      anchorType: row.anchorType,
      anchorNodeId: row.anchorNodeId ?? null,
      canvasX: row.canvasX ?? null,
      canvasY: row.canvasY ?? null,
      content: row.content,
      status: row.status,
      resolvedBy: row.resolvedBy ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      replies,
    };
  }

  private formatReply(
    row: typeof commentReplies.$inferSelect,
    author: CommentAuthor,
  ): CommentReplyDto {
    return {
      id: row.id,
      commentId: row.commentId,
      author,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getCommentsByStoryboard(storyboardId: string): Promise<CommentDto[]> {
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.storyboardId, storyboardId))
      .orderBy(desc(comments.createdAt));

    const result: CommentDto[] = [];
    for (const row of rows) {
      const [authorRow] = await db
        .select({ id: users.id, name: users.name, image: users.image })
        .from(users)
        .where(eq(users.id, row.authorId))
        .limit(1);
      const author = this.formatAuthor(
        authorRow ?? { id: row.authorId, name: null, image: null },
      );

      const replyRows = await db
        .select()
        .from(commentReplies)
        .where(eq(commentReplies.commentId, row.id))
        .orderBy(commentReplies.createdAt);

      const replies: CommentReplyDto[] = [];
      for (const reply of replyRows) {
        const [replyAuthorRow] = await db
          .select({ id: users.id, name: users.name, image: users.image })
          .from(users)
          .where(eq(users.id, reply.authorId))
          .limit(1);
        replies.push(
          this.formatReply(
            reply,
            this.formatAuthor(
              replyAuthorRow ?? {
                id: reply.authorId,
                name: null,
                image: null,
              },
            ),
          ),
        );
      }

      result.push(this.formatComment(row, author, replies));
    }
    return result;
  }

  async createComment(
    storyboardId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentDto> {
    const [inserted] = await db
      .insert(comments)
      .values({
        storyboardId,
        authorId: userId,
        anchorType: dto.anchorType,
        anchorNodeId: dto.anchorNodeId ?? null,
        canvasX: dto.canvasX ?? null,
        canvasY: dto.canvasY ?? null,
        content: dto.content,
      })
      .returning();
    if (!inserted) throw new Error("Insert failed");

    const [authorRow] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const comment = this.formatComment(
      inserted,
      this.formatAuthor(authorRow ?? { id: userId, name: null, image: null }),
    );

    this.server?.to(storyboardId).emit("comment:created", { comment });
    return comment;
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!comment) throw new NotFoundException("Comment not found");
    if (comment.authorId !== userId)
      throw new ForbiddenException("Not authorized");

    await db.delete(comments).where(eq(comments.id, commentId));
    this.server
      ?.to(comment.storyboardId)
      .emit("comment:deleted", { commentId });
  }

  async updateCommentStatus(
    commentId: string,
    userId: string,
    dto: UpdateCommentStatusDto,
  ): Promise<CommentDto> {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!comment) throw new NotFoundException("Comment not found");

    const updateData =
      dto.status === "resolved"
        ? {
            status: "resolved" as const,
            resolvedBy: userId,
            resolvedAt: new Date(),
            updatedAt: new Date(),
          }
        : {
            status: "open" as const,
            resolvedBy: null,
            resolvedAt: null,
            updatedAt: new Date(),
          };

    const [updated] = await db
      .update(comments)
      .set(updateData)
      .where(eq(comments.id, commentId))
      .returning();
    if (!updated) throw new Error("Update failed");

    const [authorRow] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, updated.authorId))
      .limit(1);
    const result = this.formatComment(
      updated,
      this.formatAuthor(
        authorRow ?? { id: updated.authorId, name: null, image: null },
      ),
    );

    this.server?.to(comment.storyboardId).emit("comment:status_changed", {
      commentId,
      status: updated.status,
      resolvedBy: updated.resolvedBy ?? null,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    });
    return result;
  }

  async createReply(
    commentId: string,
    userId: string,
    dto: CreateReplyDto,
  ): Promise<CommentReplyDto> {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!comment) throw new NotFoundException("Comment not found");

    const [inserted] = await db
      .insert(commentReplies)
      .values({ commentId, authorId: userId, content: dto.content })
      .returning();
    if (!inserted) throw new Error("Insert failed");

    const [authorRow] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const reply = this.formatReply(
      inserted,
      this.formatAuthor(authorRow ?? { id: userId, name: null, image: null }),
    );

    this.server?.to(comment.storyboardId).emit("reply:created", { reply });
    return reply;
  }

  async updateReply(
    replyId: string,
    userId: string,
    dto: UpdateReplyDto,
  ): Promise<CommentReplyDto> {
    const [reply] = await db
      .select()
      .from(commentReplies)
      .where(eq(commentReplies.id, replyId))
      .limit(1);
    if (!reply) throw new NotFoundException("Reply not found");
    if (reply.authorId !== userId)
      throw new ForbiddenException("Not authorized");

    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, reply.commentId))
      .limit(1);

    const [updated] = await db
      .update(commentReplies)
      .set({ content: dto.content, updatedAt: new Date() })
      .where(eq(commentReplies.id, replyId))
      .returning();
    if (!updated) throw new Error("Update failed");

    const [authorRow] = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const result = this.formatReply(
      updated,
      this.formatAuthor(authorRow ?? { id: userId, name: null, image: null }),
    );

    if (comment) {
      this.server
        ?.to(comment.storyboardId)
        .emit("reply:updated", { reply: result });
    }
    return result;
  }

  async deleteReply(replyId: string, userId: string): Promise<void> {
    const [reply] = await db
      .select()
      .from(commentReplies)
      .where(eq(commentReplies.id, replyId))
      .limit(1);
    if (!reply) throw new NotFoundException("Reply not found");
    if (reply.authorId !== userId)
      throw new ForbiddenException("Not authorized");

    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, reply.commentId))
      .limit(1);

    await db.delete(commentReplies).where(eq(commentReplies.id, replyId));
    if (comment) {
      this.server
        ?.to(comment.storyboardId)
        .emit("reply:deleted", { replyId, commentId: reply.commentId });
    }
  }
}
