"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import {
  createStoryboard,
  updateStoryboard,
  deleteStoryboard,
} from "@/data-access/storyboards";
import { getProjectBySlug } from "@/data-access/projects";
import { getOrganizationBySlug, isOrgMember } from "@/data-access/organizations";

export async function createStoryboardAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const genre = (formData.get("genre") as string)?.trim() || null;

  if (!name) {
    return { error: "스토리보드 이름을 입력해주세요." };
  }

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !(await isOrgMember(org.id, userId))) {
    return { error: "접근 권한이 없습니다." };
  }

  const project = await getProjectBySlug(org.id, projectSlug);
  if (!project) {
    return { error: "프로젝트를 찾을 수 없습니다." };
  }

  const storyboard = await createStoryboard({
    projectId: project.id,
    createdBy: userId,
    updatedBy: userId,
    name,
    description,
    genre,
    content: {},
    contentVersion: 0,
  });

  revalidatePath(`/dashboard/${orgSlug}/projects/${projectSlug}`);
  redirect(
    `/dashboard/${orgSlug}/projects/${projectSlug}/storyboards/${storyboard.id}`,
  );
}

export async function updateStoryboardAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const storyboardId = formData.get("storyboardId") as string;
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const genre = (formData.get("genre") as string)?.trim() || null;

  if (!name) {
    return { error: "스토리보드 이름을 입력해주세요." };
  }

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !(await isOrgMember(org.id, userId))) {
    return { error: "접근 권한이 없습니다." };
  }

  await updateStoryboard(storyboardId, {
    name,
    description,
    genre,
    updatedBy: userId,
  });

  revalidatePath(`/dashboard/${orgSlug}/projects/${projectSlug}`);
  return { success: true };
}

export async function deleteStoryboardAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const storyboardId = formData.get("storyboardId") as string;
  const orgSlug = formData.get("orgSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !(await isOrgMember(org.id, userId))) {
    return { error: "접근 권한이 없습니다." };
  }

  await deleteStoryboard(storyboardId);
  revalidatePath(`/dashboard/${orgSlug}/projects/${projectSlug}`);
  redirect(`/dashboard/${orgSlug}/projects/${projectSlug}`);
}
