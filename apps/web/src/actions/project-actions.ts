"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import {
  createProject,
  updateProject,
  deleteProject,
} from "@/data-access/projects";
import { getOrganizationBySlug, isOrgMember } from "@/data-access/organizations";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function createProjectAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const orgSlug = formData.get("orgSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) {
    return { error: "프로젝트 이름을 입력해주세요." };
  }

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) {
    return { error: "조직을 찾을 수 없습니다." };
  }

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) {
    return { error: "이 조직에 접근 권한이 없습니다." };
  }

  const slug = slugify(name) || `project-${Date.now()}`;

  try {
    await createProject({
      orgId: org.id,
      name,
      description,
      slug,
    });
  } catch {
    return { error: "프로젝트 생성에 실패했습니다. 이름을 변경해보세요." };
  }

  revalidatePath(`/dashboard/${orgSlug}`);
  redirect(`/dashboard/${orgSlug}/projects/${slug}`);
}

export async function updateProjectAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const projectId = formData.get("projectId") as string;
  const orgSlug = formData.get("orgSlug") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) {
    return { error: "프로젝트 이름을 입력해주세요." };
  }

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !(await isOrgMember(org.id, userId))) {
    return { error: "접근 권한이 없습니다." };
  }

  await updateProject(projectId, { name, description });
  revalidatePath(`/dashboard/${orgSlug}`);
  return { success: true };
}

export async function deleteProjectAction(formData: FormData) {
  const userId = await getCurrentUserId();
  const projectId = formData.get("projectId") as string;
  const orgSlug = formData.get("orgSlug") as string;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !(await isOrgMember(org.id, userId))) {
    return { error: "접근 권한이 없습니다." };
  }

  await deleteProject(projectId);
  revalidatePath(`/dashboard/${orgSlug}`);
  redirect(`/dashboard/${orgSlug}`);
}
