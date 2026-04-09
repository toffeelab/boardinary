import type {
  ApiErrorResponse,
  BlueprintDto,
  BlueprintMetaDto,
  CreateBlueprintDto,
  UpdateBlueprintDto,
} from "@repo/types";

const API_URL = process.env.API_URL ?? "http://localhost:4001";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiClient<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    userId?: string;
    timeout?: number;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeout ?? 5000,
  );

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
        ...(options.userId ? { "X-User-Id": options.userId } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const error = await res.json().catch(
        (): ApiErrorResponse => ({
          statusCode: res.status,
          message: `API error: ${res.status}`,
        }),
      );
      throw new ApiError(
        typeof error?.message === "string"
          ? error.message
          : `API error: ${res.status}`,
        res.status,
      );
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getBlueprints(
  userId: string,
  scope: "personal" | "organization",
  orgId?: string,
) {
  const params = new URLSearchParams({ scope });
  if (orgId) params.set("orgId", orgId);
  return apiClient<BlueprintMetaDto[]>(`/api/blueprints?${params}`, { userId });
}

export async function getBlueprintById(userId: string, id: string) {
  return apiClient<BlueprintDto>(`/api/blueprints/${id}`, { userId });
}

export async function createBlueprint(
  userId: string,
  data: CreateBlueprintDto,
) {
  return apiClient<BlueprintDto>("/api/blueprints", {
    method: "POST",
    body: data,
    userId,
  });
}

export async function updateBlueprint(
  userId: string,
  id: string,
  data: UpdateBlueprintDto,
) {
  return apiClient<BlueprintDto>(`/api/blueprints/${id}`, {
    method: "PATCH",
    body: data,
    userId,
  });
}

export async function deleteBlueprint(userId: string, id: string) {
  return apiClient<{ success: boolean }>(`/api/blueprints/${id}`, {
    method: "DELETE",
    userId,
  });
}
