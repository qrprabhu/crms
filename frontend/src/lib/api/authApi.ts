import { getResolvedApiBaseUrl } from "../../api/config";

export type UserRole =
  | "admin"
  | "sub_admin"
  | "manager"
  | "team_lead"
  | "business_development"
  | "software_development"
  | "support_team"
  | "employee";

export type AuthUser = {
  id: number | string;
  email: string;
  name: string;
  is_admin: boolean;
  role: UserRole;
  role_display: string;
  department?: string;
  must_change_password: boolean;
  allowed_modules: string[];
};

export type LoginResponse = {
  success: boolean;
  message: string;
  data: {
    access_token: string;
    refresh_token: string;
    user: AuthUser;
  };
};

export type ChangePasswordResponse = {
  success: boolean;
  message: string;
};

// Keys used in localStorage
export const AUTH_KEYS = {
  isLoggedIn: "isLoggedIn",
  loggedInUser: "loggedInUser",
  accessToken: "accessToken",
  refreshToken: "refreshToken",
} as const;

export function storeAuthSession(data: LoginResponse["data"]) {
  localStorage.setItem(AUTH_KEYS.isLoggedIn, "true");
  localStorage.setItem(AUTH_KEYS.accessToken, data.access_token);
  localStorage.setItem(AUTH_KEYS.refreshToken, data.refresh_token);
  localStorage.setItem(AUTH_KEYS.loggedInUser, JSON.stringify(data.user));
}

export function clearAuthSession() {
  Object.values(AUTH_KEYS).forEach((key) => localStorage.removeItem(key));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEYS.loggedInUser);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_KEYS.accessToken);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(AUTH_KEYS.refreshToken);
}

function extractErrorMessage(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractErrorMessage(item);
      if (nested) return nested;
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      const nested = extractErrorMessage(nestedValue);
      if (nested) return nested;
    }
  }

  return null;
}

async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getResolvedApiBaseUrl()}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      extractErrorMessage((data as { message?: unknown })?.message) ||
      extractErrorMessage((data as { detail?: unknown })?.detail) ||
      extractErrorMessage(data) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>("/auth/login/", { email, password });
}

export async function changePassword(
  newPassword: string,
  confirmPassword: string,
  accessToken: string
): Promise<ChangePasswordResponse> {
  return apiPost<ChangePasswordResponse>(
    "/auth/change-password/",
    { new_password: newPassword, confirm_password: confirmPassword },
    accessToken
  );
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const res = await fetch(`${getResolvedApiBaseUrl()}/auth/token/refresh/`, {
      method: "POST",
      headers,
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { access?: string };
    if (data.access) {
      localStorage.setItem(AUTH_KEYS.accessToken, data.access);
      return data.access;
    }
    return null;
  } catch {
    return null;
  }
}
