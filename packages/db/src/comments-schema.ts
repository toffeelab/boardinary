import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  doublePrecision,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users, storyboards } from "./schema";

export const anchorTypeEnum = pgEnum("anchor_type", ["node", "canvas"]);
export const commentStatusEnum = pgEnum("comment_status", ["open", "resolved"]);

export const comments = pgTable(
  "comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    storyboardId: text("storyboard_id")
      .notNull()
      .references(() => storyboards.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    anchorType: anchorTypeEnum("anchor_type").notNull(),
    anchorNodeId: text("anchor_node_id"),
    canvasX: doublePrecision("canvas_x"),
    canvasY: doublePrecision("canvas_y"),
    content: text("content").notNull(),
    status: commentStatusEnum("status").notNull().default("open"),
    resolvedBy: text("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_comments_storyboard_status").on(
      table.storyboardId,
      table.status,
    ),
    index("idx_comments_storyboard_created").on(
      table.storyboardId,
      table.createdAt,
    ),
    check(
      "anchor_node_check",
      sql`(anchor_type = 'node' AND anchor_node_id IS NOT NULL AND canvas_x IS NULL AND canvas_y IS NULL)
        OR (anchor_type = 'canvas' AND anchor_node_id IS NULL AND canvas_x IS NOT NULL AND canvas_y IS NOT NULL)`,
    ),
    check(
      "resolved_pair_check",
      sql`(resolved_by IS NULL) = (resolved_at IS NULL)`,
    ),
  ],
);

export const commentReplies = pgTable(
  "comment_replies",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_replies_comment_created").on(table.commentId, table.createdAt),
  ],
);
