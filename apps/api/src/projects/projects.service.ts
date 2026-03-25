import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { db, projects } from "@repo/db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

@Injectable()
export class ProjectsService {
  async getProjectsByOrgId(orgId: string) {
    return db
      .select()
      .from(projects)
      .where(and(eq(projects.orgId, orgId), eq(projects.status, "active")))
      .orderBy(projects.createdAt);
  }

  async getProjectBySlug(orgId: string, slug: string) {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.orgId, orgId), eq(projects.slug, slug)))
      .limit(1);
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async createProject(
    orgId: string,
    data: { name: string; description?: string },
  ) {
    const slug = slugify(data.name) || `project-${Date.now()}`;
    const [project] = await db
      .insert(projects)
      .values({
        orgId,
        name: data.name,
        description: data.description ?? null,
        slug,
      })
      .returning();
    return project!;
  }

  async updateProject(
    id: string,
    data: { name?: string; description?: string },
  ) {
    const [project] = await db
      .update(projects)
      .set(data)
      .where(eq(projects.id, id))
      .returning();
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async deleteProject(id: string) {
    await db
      .update(projects)
      .set({ status: "archived" })
      .where(eq(projects.id, id));
  }
}
