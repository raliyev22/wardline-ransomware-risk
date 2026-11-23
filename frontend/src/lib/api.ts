/** Shared API client for the FastAPI backend. */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 15_000;

export type ApiErrorKind = "network" | "http" | "invalid_response";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function messageFromDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string") {
    return detail.message;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };
    if (typeof first?.msg === "string") return first.msg;
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(`Cannot reach the decision-support API at ${API_BASE_URL}.`, "network");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (response.ok) throw new ApiError("The API returned a response that is not valid JSON.", "invalid_response", response.status);
  }

  if (!response.ok) {
    const detail = body && typeof body === "object" && "detail" in body ? (body as { detail: unknown }).detail : body;
    throw new ApiError(messageFromDetail(detail, `Request failed with HTTP ${response.status}.`), "http", response.status, detail);
  }
  return body as T;
}

/** De-duplicates concurrent GETs for the same path (e.g. header + page both reading /api/hospital). */
const inflight = new Map<string, Promise<unknown>>();

export function apiGet<T>(path: string, options: { force?: boolean } = {}): Promise<T> {
  if (!options.force) {
    const existing = inflight.get(path);
    if (existing) return existing as Promise<T>;
  }
  const promise = request<T>(path).catch((error: unknown) => {
    inflight.delete(path); // never cache failures
    throw error;
  });
  inflight.set(path, promise);
  return promise;
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

/** Uncached health probe used by the header connection indicator. */
export function checkHealth<T>(): Promise<T> {
  return request<T>("/api/health", { signal: AbortSignal.timeout(5_000) });
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(error instanceof Error ? error.message : "Unexpected error.", "invalid_response");
}
