import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { storyboards } from "./schema";
import { users } from "./schema";

export const storyboardVersions = pgTable(
  "storyboard_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    storyboardId: text("storyboard_id")
      .notNull()
      .references(() => storyboards.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    label: text("label"),
    content: jsonb("content").notNull(),
    contentVersion: integer("content_version").notNull(),
    restoredFromId: text("restored_from_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_sv_content_version").on(
      table.storyboardId,
      table.contentVersion,
    ),
    index("idx_sv_list").on(table.storyboardId, table.createdAt),
  ],
);
