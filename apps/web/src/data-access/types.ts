import type {
  organizations,
  projects,
  storyboards,
  orgMembers,
} from "@/db/schema";

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrgMember = typeof orgMembers.$inferSelect;
export type NewOrgMember = typeof orgMembers.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Storyboard = typeof storyboards.$inferSelect;
export type NewStoryboard = typeof storyboards.$inferInsert;

/** 목록 조회 시 content 제외한 스토리보드 메타 */
export type StoryboardMeta = Omit<Storyboard, "content">;
