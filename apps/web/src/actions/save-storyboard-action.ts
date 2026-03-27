"use server";

import { apiClient, ApiError } from "@/lib/api-client";
import type { StoryboardContentV1 } from "@repo/types";

export async function saveStoryboardAction(
  storyboardId: string,
  userId: string,
  content: StoryboardContentV1,
  contentVersion: number,
): Promise<{ contentVersion?: number; error?: string }> {
  try {
    const result = await apiClient<{ contentVersion: number }>(
      `/api/storyboards/${storyboardId}`,
      {
        method: "PATCH",
        body: { content, contentVersion },
        userId,
      },
    );
    return { contentVersion: result.contentVersion };
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 409) {
      return { error: "conflict" };
    }
    const message = error instanceof Error ? error.message : "Save failed";
    return { error: message };
  }
}
