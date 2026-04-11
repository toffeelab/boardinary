export type AnchorType = "node" | "canvas";
export type CommentStatus = "open" | "resolved";

export interface CommentAuthor {
  id: string;
  name: string | null;
  image: string | null;
}

export interface CommentReplyDto {
  id: string;
  commentId: string;
  author: CommentAuthor;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDto {
  id: string;
  storyboardId: string;
  author: CommentAuthor;
  anchorType: AnchorType;
  anchorNodeId: string | null;
  canvasX: number | null;
  canvasY: number | null;
  content: string;
  status: CommentStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  replies: CommentReplyDto[];
}

// API request types
export interface CreateCommentDto {
  anchorType: AnchorType;
  anchorNodeId?: string;
  canvasX?: number;
  canvasY?: number;
  content: string;
}

export interface CreateReplyDto {
  content: string;
}

export interface UpdateCommentStatusDto {
  status: CommentStatus;
}

export interface UpdateReplyDto {
  content: string;
}

// Socket.io events
export interface CommentCreatedEvent {
  comment: CommentDto;
}

export interface CommentDeletedEvent {
  commentId: string;
}

export interface CommentStatusChangedEvent {
  commentId: string;
  status: CommentStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface ReplyCreatedEvent {
  reply: CommentReplyDto;
}

export interface ReplyUpdatedEvent {
  reply: CommentReplyDto;
}

export interface ReplyDeletedEvent {
  replyId: string;
  commentId: string;
}
