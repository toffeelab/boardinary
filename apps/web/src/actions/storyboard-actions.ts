"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import type { StoryboardDto } from "@repo/types";

export async function createStoryboardAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description =
    (formData.get("description") as string)?.trim() || undefined;
  const genre = (formData.get("genre") as string)?.trim() || undefined;
  const templateContentRaw = formData.get("templateContent") as string | null;

  if (!name) {
    return { error: "스토리보드 이름을 입력해주세요." };
  }

  let content: Record<string, unknown> | undefined;
  if (templateContentRaw) {
    try {
      content = JSON.parse(templateContentRaw) as Record<string, unknown>;
    } catch {
      // Ignore invalid JSON — create with empty content
    }
  }

  try {
    const storyboard = await apiClient<StoryboardDto>(
      `/api/organizations/${orgSlug}/projects/${projectSlug}/storyboards`,
      { method: "POST", body: { name, description, genre, content }, userId },
    );
    revalidatePath(`/dashboard/${orgSlug}/projects/${projectSlug}`);
    redirect(
      `/dashboard/${orgSlug}/projects/${projectSlug}/storyboards/${storyboard.id}`,
    );
  } catch {
    return { error: "스토리보드 생성에 실패했습니다." };
  }
}

export async function updateStoryboardAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const storyboardId = formData.get("storyboardId") as string;
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description =
    (formData.get("description") as string)?.trim() || undefined;
  const genre = (formData.get("genre") as string)?.trim() || undefined;

  if (!name) {
    return { error: "스토리보드 이름을 입력해주세요." };
  }

  try {
    await apiClient(`/api/storyboards/${storyboardId}`, {
      method: "PATCH",
      body: { name, description, genre },
      userId,
    });
    revalidatePath(`/dashboard/${orgSlug}/projects/${projectSlug}`);
    return { success: true };
  } catch {
    return { error: "스토리보드 수정에 실패했습니다." };
  }
}

export async function deleteStoryboardAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const storyboardId = formData.get("storyboardId") as string;
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;

  try {
    await apiClient(`/api/storyboards/${storyboardId}`, {
      method: "DELETE",
      userId,
    });
    revalidatePath(`/dashboard/${orgSlug}/projects/${projectSlug}`);
    redirect(`/dashboard/${orgSlug}/projects/${projectSlug}`);
  } catch {
    return { error: "스토리보드 삭제에 실패했습니다." };
  }
}
