import type { TimelineItem } from "../lib/shared/crmTypes";
import type { SupportImportFieldMapping } from "./types";

export function formatSupportDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function formatSupportDateOnly(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function formatStatusLabel(value?: string) {
  return value?.trim() || "-";
}

export function priorityBadgeClass(priority?: string) {
  const normalized = (priority || "").toLowerCase();
  if (normalized === "urgent") return "bg-rose-100 text-rose-700";
  if (normalized === "high") return "bg-amber-100 text-amber-700";
  if (normalized === "medium") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

export function buildInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "SU";
}

export function detectDuplicateMappings(mapping: SupportImportFieldMapping[]) {
  const counts = new Map<string, number>();
  mapping.forEach((item) => {
    if (!item.targetField) return;
    counts.set(item.targetField, (counts.get(item.targetField) || 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([field]) => field);
}

export function mapTimelineItems(items: Array<any>): TimelineItem[] {
  return items.map((item) => ({
    id: String(item.id),
    parentId: String(item.record_id || item.parentId || ""),
    type: "Update",
    title: item.message || item.action_type || "Updated",
    detail: item.message || item.action_type || "",
    at: item.timestamp || item.created_at || "",
    by: item.created_by_email || "",
  }));
}

