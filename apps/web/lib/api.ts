const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

export async function api<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: HeadersInit = { ...fetchOptions.headers };
  if (fetchOptions.body) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...fetchOptions,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    const error = body.error;
    const message = typeof error === "string" ? error : `API error: ${res.status}`;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

/**
 * Extract a user-facing error message from an unknown catch value.
 * Handles ApiError (conflict / not-found) with dedicated messages.
 */
export function getApiErrorMessage(
  err: unknown,
  fallback: string,
  opts?: { conflict?: string; notFound?: string },
): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return opts?.conflict ?? err.message;
    if (err.status === 404) return opts?.notFound ?? err.message;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
