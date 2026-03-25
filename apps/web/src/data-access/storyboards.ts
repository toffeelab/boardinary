import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { storyboards } from "@/db/schema";
import type { NewStoryboard } from "./types";

/** 목록 조회 — content 제외하여 성능 최적화 */
export async function getStoryboardsByProjectId(projectId: string) {
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

/** 단건 조회 — content 포함 */
export async function getStoryboardById(id: string) {
  const [storyboard] = await db
    .select()
    .from(storyboards)
    .where(eq(storyboards.id, id))
    .limit(1);
  return storyboard ?? null;
}

export async function createStoryboard(data: NewStoryboard) {
  const [storyboard] = await db
    .insert(storyboards)
    .values(data)
    .returning();
  return storyboard!;
}

export async function updateStoryboard(
  id: string,
  data: Partial<
    Pick<
      NewStoryboard,
      "name" | "description" | "genre" | "tags" | "status" | "updatedBy"
    >
  >,
) {
  const [storyboard] = await db
    .update(storyboards)
    .set(data)
    .where(eq(storyboards.id, id))
    .returning();
  return storyboard ?? null;
}

export async function deleteStoryboard(id: string) {
  await db
    .update(storyboards)
    .set({ status: "archived" })
    .where(eq(storyboards.id, id));
}
