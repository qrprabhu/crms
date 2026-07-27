import { getResolvedApiBaseUrl } from "./config";
import { getAccessToken, refreshAccessToken, clearAuthSession } from "../lib/api/authApi";

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | undefined | null>;
  cacheTtlMs?: number;
  forceFresh?: boolean;
};

type CacheEnvelope = {
  savedAt: number;
  data: unknown;
};

const RESPONSE_CACHE_STORAGE_KEY = "api-response-cache-v1";
const DEFAULT_GET_CACHE_TTL_MS = 30 * 1000;
const responseCache = new Map<string, CacheEnvelope>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function isGetRequest(options: RequestOptions) {
  return (options.method || "GET").toUpperCase() === "GET" && !options.body;
}

function flattenErrorPayload(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenErrorPayload);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nestedValue]) => {
      const nestedMessages = flattenErrorPayload(nestedValue);
      if (!nestedMessages.length) return [];
      if (key === "non_field_errors" || key === "detail" || key === "message" || key === "error") {
        return nestedMessages;
      }
      return nestedMessages.map((message) => `${key}: ${message}`);
    });
  }

  return [];
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const normalizedPathWithPrefix = path.startsWith("/") ? path : `/${path}`;
  const [pathname, search = ""] = normalizedPathWithPrefix.split("?", 2);
  const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const base = getResolvedApiBaseUrl();
  const url = new URL(`${base}${normalizedPath}${search ? `?${search}` : ""}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

function readPersistedCache() {
  if (typeof window === "undefined") return;
  if (responseCache.size > 0) return;

  try {
    const raw = window.sessionStorage.getItem(RESPONSE_CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEnvelope>;
    Object.entries(parsed).forEach(([key, value]) => {
      if (!value?.savedAt) return;
      responseCache.set(key, value);
    });
  } catch {
    // Ignore cache hydration errors.
  }
}

function persistCache() {
  if (typeof window === "undefined") return;

  try {
    const entries = Object.fromEntries(responseCache.entries());
    window.sessionStorage.setItem(RESPONSE_CACHE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage errors to avoid breaking requests.
  }
}

function getCachedResponse<T>(key: string, ttlMs: number): T | null {
  readPersistedCache();
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.savedAt > ttlMs) {
    responseCache.delete(key);
    persistCache();
    return null;
  }
  return cached.data as T;
}

function setCachedResponse(key: string, data: unknown) {
  responseCache.set(key, { savedAt: Date.now(), data });
  persistCache();
}

function clearResponseCache() {
  responseCache.clear();
  inFlightRequests.clear();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(RESPONSE_CACHE_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }
}

export function clearStoredAuth() {
  clearAuthSession();
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

async function executeRequest(path: string, options: RequestOptions) {
  const accessToken = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetch(buildUrl(path, options.query), {
    ...options,
    headers,
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);
  const isGet = isGetRequest(options);
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS;
  const cacheKey = isGet ? url : "";

  if (isGet && !options.forceFresh && cacheTtlMs > 0) {
    const cached = getCachedResponse<T>(cacheKey, cacheTtlMs);
    if (cached !== null) {
      return cached;
    }

    const existingRequest = inFlightRequests.get(cacheKey);
    if (existingRequest) {
      return existingRequest as Promise<T>;
    }
  }

  const requestPromise = (async () => {
    let response: Response;

    try {
      response = await executeRequest(path, options);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? `Network error: ${error.message}. Check that the backend server is running and the frontend API base URL is correct.`
          : "Network error. Check that the backend server is running and reachable.";
      throw new Error(message);
    }

    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        try {
          response = await executeRequest(path, options);
        } catch {
          clearStoredAuth();
          redirectToLogin();
          throw new Error("Session expired. Please log in again.");
        }
      } else {
        clearStoredAuth();
        redirectToLogin();
        throw new Error("Session expired. Please log in again.");
      }
    }

    const rawText = await response.text();
    let data: unknown = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }

    if (!response.ok) {
      const errorPayload =
        typeof data === "object" && data !== null
          ? (data as { detail?: string; message?: string; error?: string })
          : null;
      const fallbackStatusMessage = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
      const flattenedMessages = flattenErrorPayload(data);
      const message =
        errorPayload?.detail ||
        errorPayload?.message ||
        errorPayload?.error ||
        flattenedMessages.join(" | ") ||
        fallbackStatusMessage ||
        "Request failed";
      const error = new Error(message) as Error & { payload?: unknown; status?: number };
      error.payload = data;
      error.status = response.status;
      throw error;
    }

    if (isGet && cacheTtlMs > 0) {
      setCachedResponse(cacheKey, data);
    } else if (!isGet) {
      clearResponseCache();
    }

    return data as T;
  })();

  if (isGet && !options.forceFresh && cacheTtlMs > 0) {
    inFlightRequests.set(cacheKey, requestPromise as Promise<unknown>);
  }

  try {
    return await requestPromise;
  } finally {
    if (isGet && cacheTtlMs > 0) {
      inFlightRequests.delete(cacheKey);
    }
  }
}

export function getApiBaseUrl() {
  return getResolvedApiBaseUrl();
}
