import type { BusinessHours, BusinessHoursDayKey, JobSheetField } from "./types";

function createJobSheetFieldKey() {
  return `job-field-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  );
}

export function formatDuration(minutes: number) {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

export function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function formatDateOnly(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function formatTimeValue(value?: string) {
  if (!value) return "-";
  const [hours = "00", minutes = "00"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatBusinessHoursSummary(hours?: BusinessHours | null) {
  if (!hours) return "No business hours linked";
  const enabledDays = Object.entries(hours.days)
    .filter(([, value]) => value.enabled)
    .map(([key]) => key.slice(0, 3).toUpperCase());
  return enabledDays.length ? `${hours.name} • ${enabledDays.join(", ")}` : hours.name;
}

export function businessHoursPayloadFromForm(days: BusinessHours["days"]) {
  return Object.entries(days).reduce<Record<string, string | boolean | undefined>>((acc, [day, value]) => {
    acc[`${day}_enabled`] = value.enabled;
    acc[`${day}_start`] = value.enabled ? value.start || undefined : undefined;
    acc[`${day}_end`] = value.enabled ? value.end || undefined : undefined;
    return acc;
  }, {});
}

export function normalizeBusinessHoursDays(record: any): BusinessHours["days"] {
  const dayKeys: BusinessHoursDayKey[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  return dayKeys.reduce<BusinessHours["days"]>((acc, day) => {
    acc[day] = {
      enabled: Boolean(record?.[`${day}_enabled`]),
      start: record?.[`${day}_start`] || "",
      end: record?.[`${day}_end`] || "",
    };
    return acc;
  }, {} as BusinessHours["days"]);
}

export function validateDayWindow(enabled: boolean, start: string, end: string) {
  if (!enabled) return "";
  if (!start || !end) return "Start and end times are required.";
  if (start >= end) return "End time must be after start time.";
  return "";
}

export function buildEmptyJobSheetField(): JobSheetField {
  return {
    clientKey: createJobSheetFieldKey(),
    fieldName: "",
    fieldLabel: "",
    fieldType: "text",
    fieldValue: "",
  };
}
