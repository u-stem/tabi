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

async function fetchApi(path: string, options: FetchOptions): Promise<Response> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: HeadersInit = { ...fetchOptions.headers };
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
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

  return res;
}

/**
 * Call a JSON API endpoint that returns a body of type T.
 * Use {@link apiVoid} for endpoints that return 204 No Content.
 */
export async function api<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const res = await fetchApi(path, options);

  if (res.status === 204) {
    throw new ApiError(
      `Expected JSON body from ${path} but got 204 No Content. Use apiVoid() for endpoints that return no body.`,
      204,
    );
  }

  return res.json();
}

/**
 * Call an API endpoint that returns no body (typically 204 No Content).
 * Throws if the endpoint returns a non-2xx status; ignores the body otherwise.
 */
export async function apiVoid(path: string, options: FetchOptions = {}): Promise<void> {
  await fetchApi(path, options);
}

/**
 * Extract a user-facing error message from an unknown catch value.
 * Handles ApiError (conflict / not-found) with dedicated messages.
 */
export function getApiErrorMessage(
  err: unknown,
  fallback: string,
  opts?: { badRequest?: string; conflict?: string; notFound?: string },
): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return opts?.badRequest ?? err.message;
    if (err.status === 409) return opts?.conflict ?? err.message;
    if (err.status === 404) return opts?.notFound ?? err.message;
    // Server errors (5xx) may contain technical details; use fallback instead
    if (err.status >= 500) return fallback;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
