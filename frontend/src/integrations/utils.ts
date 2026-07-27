import type {
  AuthenticationStatus,
  ConfirmationStatus,
  IntegrationProtocolType,
  IntegrationProviderType,
  SocialPlatform,
  SourceType,
} from "./types";

const providerLabels: Record<IntegrationProviderType, string> = {
  zoho_mail: "Business Mail",
  gmail: "Gmail",
  yahoo: "Yahoo Mail",
  office365: "Office 365",
  outlook: "Outlook",
  other: "Other Mail",
};

const protocolLabels: Record<IntegrationProtocolType, string> = {
  imap_oauth: "IMAP + OAuth",
  imap: "IMAP",
  smtp: "SMTP",
  relay: "Relay",
};

const confirmationLabels: Record<ConfirmationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
};

const authenticationLabels: Record<AuthenticationStatus, string> = {
  not_applicable: "Not Applicable",
  available: "Available",
  pending: "Pending",
  authenticated: "Authenticated",
  failed: "Failed",
};

const platformLabels: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  x: "X",
};

const sourceLabels: Record<SourceType, string> = {
  email: "Email",
  social: "Social",
  website: "Website",
  parser: "Parser",
  bcc_dropbox: "BCC Dropbox",
  salesiq: "SalesIQ",
};

export function getProviderLabel(value: IntegrationProviderType | string | null | undefined) {
  return value && value in providerLabels ? providerLabels[value as IntegrationProviderType] : fallbackValue(value);
}

export function getProtocolLabel(value: IntegrationProtocolType | string | null | undefined) {
  return value && value in protocolLabels ? protocolLabels[value as IntegrationProtocolType] : fallbackValue(value);
}

export function getConfirmationStatusLabel(value: ConfirmationStatus | string | null | undefined) {
  return value && value in confirmationLabels ? confirmationLabels[value as ConfirmationStatus] : fallbackValue(value);
}

export function getAuthenticationStatusLabel(value: AuthenticationStatus | string | null | undefined) {
  return value && value in authenticationLabels ? authenticationLabels[value as AuthenticationStatus] : fallbackValue(value);
}

export function getPlatformLabel(value: SocialPlatform | string | null | undefined) {
  return value && value in platformLabels ? platformLabels[value as SocialPlatform] : fallbackValue(value);
}

export function getSourceTypeLabel(value: SourceType | string | null | undefined) {
  return value && value in sourceLabels ? sourceLabels[value as SourceType] : fallbackValue(value);
}

export function getStatusBadgeClass(value: string | boolean | null | undefined) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "true" || normalized === "authenticated" || normalized === "confirmed" || normalized === "verified" || normalized === "success" || normalized === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized === "pending" || normalized === "available" || normalized === "running") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (normalized === "failed" || normalized === "false" || normalized === "inactive") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function formatCredibilityScore(value: number | null | undefined) {
  const safe = Number(value ?? 0);
  return `${Math.max(0, Math.min(100, safe))}/100`;
}

export function formatTrackingCode(code: string | null | undefined) {
  return code?.trim() || "<script>Tracking code unavailable</script>";
}

export function formatPortalUrl(value: string | null | undefined) {
  return value?.replace(/^https?:\/\//, "") || "-";
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function fallbackValue<T>(value: T | null | undefined, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function splitCommaValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
