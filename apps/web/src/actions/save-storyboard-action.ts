"use server";

import { apiClient } from "@/lib/api-client";
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
    const message = error instanceof Error ? error.message : "Save failed";
    if (message.includes("modified") || message.includes("conflict")) {
      return { error: "conflict" };
    }
    return { error: message };
  }
}
