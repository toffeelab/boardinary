"use server";

import { getCurrentUserId } from "@/lib/auth";
import {
  getBlueprints as apiFetchBlueprints,
  getBlueprintById as apiFetchBlueprint,
  createBlueprint as apiCreateBlueprint,
  updateBlueprint as apiUpdateBlueprint,
  deleteBlueprint as apiDeleteBlueprint,
} from "@/lib/api-client";
import type { CreateBlueprintDto, UpdateBlueprintDto } from "@repo/types";

export async function fetchBlueprints(
  scope: "personal" | "organization",
  orgId?: string,
) {
  const userId = await getCurrentUserId();
  return apiFetchBlueprints(userId, scope, orgId);
}

export async function fetchBlueprintById(id: string) {
  const userId = await getCurrentUserId();
  return apiFetchBlueprint(userId, id);
}

export async function saveBlueprint(data: CreateBlueprintDto) {
  const userId = await getCurrentUserId();
  return apiCreateBlueprint(userId, data);
}

export async function editBlueprint(id: string, data: UpdateBlueprintDto) {
  const userId = await getCurrentUserId();
  return apiUpdateBlueprint(userId, id, data);
}

export async function removeBlueprint(id: string) {
  const userId = await getCurrentUserId();
  return apiDeleteBlueprint(userId, id);
}
