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
  await getCurrentUserId();
  return apiFetchBlueprints(scope, orgId);
}

export async function fetchBlueprintById(id: string) {
  await getCurrentUserId();
  return apiFetchBlueprint(id);
}

export async function saveBlueprint(data: CreateBlueprintDto) {
  await getCurrentUserId();
  return apiCreateBlueprint(data);
}

export async function editBlueprint(id: string, data: UpdateBlueprintDto) {
  await getCurrentUserId();
  return apiUpdateBlueprint(id, data);
}

export async function removeBlueprint(id: string) {
  await getCurrentUserId();
  return apiDeleteBlueprint(id);
}
