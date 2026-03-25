import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { eq, and, ne } from "drizzle-orm";
import { db, storyboards, projects, orgMembers } from "@repo/db";

@Injectable()
export class StoryboardsService {
  async getStoryboardsByProjectId(projectId: string) {
    return db
      .select({
        id: storyboards.id,
        projectId: storyboards.projectId,
        createdBy: storyboards.createdBy,
        updatedBy: storyboards.updatedBy,
        name: storyboards.name,
        description: storyboards.description,
        contentVersion: storyboards.contentVersion,
        genre: storyboards.genre,
        tags: storyboards.tags,
        status: storyboards.status,
        createdAt: storyboards.createdAt,
        updatedAt: storyboards.updatedAt,
      })
      .from(storyboards)
      .where(
        and(
          eq(storyboards.projectId, projectId),
          ne(storyboards.status, "archived"),
        ),
      )
      .orderBy(storyboards.createdAt);
  }

  async getStoryboardById(id: string) {
    const [storyboard] = await db
      .select()
      .from(storyboards)
      .where(eq(storyboards.id, id))
      .limit(1);
    if (!storyboard) throw new NotFoundException("Storyboard not found");
    return storyboard;
  }

  /** Verify membership via storyboard -> project -> org path */
  async ensureStoryboardAccess(storyboardId: string, userId: string) {
    const storyboard = await this.getStoryboardById(storyboardId);
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, storyboard.projectId))
      .limit(1);
    if (!project) throw new NotFoundException("Project not found");

    const [member] = await db
      .select()
      .from(orgMembers)
      .where(
        and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.userId, userId)),
      )
      .limit(1);
    if (!member) throw new ForbiddenException("Not authorized");
  }

  async createStoryboard(
    projectId: string,
    userId: string,
    data: { name: string; description?: string; genre?: string },
  ) {
    const [storyboard] = await db
      .insert(storyboards)
      .values({
        projectId,
        createdBy: userId,
        updatedBy: userId,
        name: data.name,
        description: data.description ?? null,
        genre: data.genre ?? null,
        content: {},
        contentVersion: 0,
      })
      .returning();
    return storyboard!;
  }

  async updateStoryboard(
    id: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      genre?: string;
      tags?: string[];
    },
  ) {
    const [storyboard] = await db
      .update(storyboards)
      .set({ ...data, updatedBy: userId })
      .where(eq(storyboards.id, id))
      .returning();
    if (!storyboard) throw new NotFoundException("Storyboard not found");
    return storyboard;
  }

  async deleteStoryboard(id: string) {
    await db
      .update(storyboards)
      .set({ status: "archived" })
      .where(eq(storyboards.id, id));
  }
}
