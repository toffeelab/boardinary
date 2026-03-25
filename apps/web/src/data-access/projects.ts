import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import type { NewProject } from "./types";

export async function getProjectsByOrgId(orgId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.status, "active")))
    .orderBy(projects.createdAt);
}

export async function getProjectBySlug(orgId: string, slug: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.slug, slug)))
    .limit(1);
  return project ?? null;
}

export async function createProject(data: NewProject) {
  const [project] = await db.insert(projects).values(data).returning();
  return project!;
}

export async function updateProject(
  id: string,
  data: Partial<Pick<NewProject, "name" | "description" | "status">>,
) {
  const [project] = await db
    .update(projects)
    .set(data)
    .where(eq(projects.id, id))
    .returning();
  return project ?? null;
}

export async function deleteProject(id: string) {
  await db
    .update(projects)
    .set({ status: "archived" })
    .where(eq(projects.id, id));
}
