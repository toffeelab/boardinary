import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { eq, and, ne } from "drizzle-orm";
import { db, storyboards, projects, orgMembers } from "@repo/db";
import type { StoryboardContentV1 } from "@repo/types";

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
    data: {
      name: string;
      description?: string;
      genre?: string;
      content?: Record<string, unknown>;
    },
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
        content: data.content ?? {},
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
      content?: StoryboardContentV1;
      contentVersion?: number;
    },
  ) {
    const { content, contentVersion, ...metadata } = data;

    // Content update with optimistic locking
    if (content !== undefined) {
      if (contentVersion === undefined) {
        throw new ConflictException(
          "contentVersion is required when updating content",
        );
      }

      const [storyboard] = await db
        .update(storyboards)
        .set({
          ...metadata,
          content,
          contentVersion: contentVersion + 1,
          updatedBy: userId,
        })
        .where(
          and(
            eq(storyboards.id, id),
            eq(storyboards.contentVersion, contentVersion),
          ),
        )
        .returning();

      if (!storyboard) {
        // Check if storyboard exists to distinguish 404 from 409
        const [existing] = await db
          .select({ id: storyboards.id })
          .from(storyboards)
          .where(eq(storyboards.id, id))
          .limit(1);

        if (!existing) {
          throw new NotFoundException("Storyboard not found");
        }
        throw new ConflictException(
          "Content version conflict. Another user has modified this storyboard.",
        );
      }

      return storyboard;
    }

    // Metadata-only update (existing behavior)
    const [storyboard] = await db
      .update(storyboards)
      .set({ ...metadata, updatedBy: userId })
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
