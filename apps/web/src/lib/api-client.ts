import type { ApiErrorResponse } from "@repo/types";

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
      const error = await res.json().catch((): ApiErrorResponse => ({
        statusCode: res.status,
        message: `API error: ${res.status}`,
      }));
      throw new ApiError(
        typeof error?.message === "string"
          ? error.message
          : `API error: ${res.status}`,
        (error as ApiErrorResponse)?.statusCode ?? res.status,
      );
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
