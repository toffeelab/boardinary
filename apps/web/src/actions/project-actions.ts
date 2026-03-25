"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import type { ProjectDto } from "@repo/types";

export async function createProjectAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const orgSlug = formData.get("orgSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description =
    (formData.get("description") as string)?.trim() || undefined;

  if (!name) {
    return { error: "프로젝트 이름을 입력해주세요." };
  }

  try {
    const project = await apiClient<ProjectDto>(
      `/api/organizations/${orgSlug}/projects`,
      { method: "POST", body: { name, description }, userId },
    );
    revalidatePath(`/dashboard/${orgSlug}`);
    redirect(`/dashboard/${orgSlug}/projects/${project.slug}`);
  } catch {
    return { error: "프로젝트 생성에 실패했습니다." };
  }
}

export async function updateProjectAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description =
    (formData.get("description") as string)?.trim() || undefined;

  if (!name) {
    return { error: "프로젝트 이름을 입력해주세요." };
  }

  try {
    await apiClient(`/api/organizations/${orgSlug}/projects/${projectSlug}`, {
      method: "PATCH",
      body: { name, description },
      userId,
    });
    revalidatePath(`/dashboard/${orgSlug}`);
    return { success: true };
  } catch {
    return { error: "프로젝트 수정에 실패했습니다." };
  }
}

export async function deleteProjectAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;

  try {
    await apiClient(`/api/organizations/${orgSlug}/projects/${projectSlug}`, {
      method: "DELETE",
      userId,
    });
    revalidatePath(`/dashboard/${orgSlug}`);
    redirect(`/dashboard/${orgSlug}`);
  } catch {
    return { error: "프로젝트 삭제에 실패했습니다." };
  }
}
