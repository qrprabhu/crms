import type { ProjectPriority, ProjectStatus } from "./types";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const styles: Record<ProjectStatus, string> = {
    Planning: "bg-slate-100 text-slate-700",
    Active: "bg-emerald-100 text-emerald-700",
    "On Hold": "bg-amber-100 text-amber-700",
    Delayed: "bg-red-100 text-red-700",
    Completed: "bg-green-100 text-green-700",
    Cancelled: "bg-zinc-200 text-zinc-700",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
  const styles: Record<ProjectPriority, string> = {
    Low: "bg-slate-100 text-slate-700",
    Medium: "bg-sky-100 text-sky-700",
    High: "bg-orange-100 text-orange-700",
    Critical: "bg-red-100 text-red-700",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[priority]}`}>
      {priority}
    </span>
  );
}