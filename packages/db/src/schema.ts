import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member"]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const organizations = pgTable(
  "organizations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isPersonal: boolean("is_personal").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_organizations_slug").on(table.slug),
    uniqueIndex("idx_organizations_personal")
      .on(table.ownerId)
      .where(sql`is_personal = true`),
  ],
);

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.userId] }),
    index("idx_org_members_user_id").on(table.userId),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    slug: text("slug").notNull(),
    status: text("status", { enum: ["active", "archived"] })
      .default("active")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_projects_org_id").on(table.orgId),
    index("idx_projects_org_status").on(table.orgId, table.status),
    uniqueIndex("idx_projects_org_slug").on(table.orgId, table.slug),
  ],
);

export const storyboards = pgTable(
  "storyboards",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    content: jsonb("content").default({}).notNull(),
    contentVersion: integer("content_version").default(0).notNull(),
    genre: text("genre"),
    tags: text("tags").array(),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .default("draft")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_storyboards_project_id").on(table.projectId),
    index("idx_storyboards_project_status").on(table.projectId, table.status),
    index("idx_storyboards_created_by").on(table.createdBy),
    index("idx_storyboards_tags").using("gin", table.tags),
  ],
);

export const blueprintTypeEnum = pgEnum("blueprint_type", [
  "preset",
  "flow",
  "template",
]);

export const blueprintScopeEnum = pgEnum("blueprint_scope", [
  "personal",
  "organization",
  "project",
]);

export const blueprints = pgTable(
  "blueprints",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    type: blueprintTypeEnum("type").notNull(),
    scope: blueprintScopeEnum("scope").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    orgId: text("org_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    description: text("description"),
    content: jsonb("content").notNull().default({}),
    contentVersion: integer("content_version").notNull().default(1),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`),
    icon: text("icon"),
    color: text("color"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_blueprints_personal").on(table.createdBy),
    index("idx_blueprints_org").on(table.orgId, table.type),
    index("idx_blueprints_tags").using("gin", table.tags),
  ],
);
