import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, CircleDot, CheckSquare, CalendarDays, Loader2,
  ChevronLeft, ChevronRight, User, UserCog, Check, X, Pencil,
  UserX, UserCheck, Trash2, AlertTriangle,
} from "lucide-react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { removeDashboardCache } from "../../lib/dashboardCache";

const TEAM_UPDATED_EVENT = "team:updated";
const ADMIN_DASHBOARD_CACHE_KEY = "admin-dashboard-cache-v1";
const MANAGER_DASHBOARD_CACHE_KEY = "manager-dashboard-cache-v1";

// ── Types ─────────────────────────────────────────────────────────────────────

type Lead = {
  id: number | string;
  first_name?: string;
  last_name?: string;
  lead_name?: string;
  company?: string;
  lead_status?: string | null;
  lead_source?: string | null;
  created_at?: string;
};

type Task = {
  id: number | string;
  subject?: string;
  due_date?: string | null;
  status?: string | null;
  priority?: string | null;
};

type Meeting = {
  id: number | string;
  title?: string;
  subject?: string;
  start_datetime?: string | null;
  from_datetime?: string | null;
};

type EmployeeInfo = {
  id: number;
  email: string;
  name?: string;
  role: string;
  role_display?: string;
  department?: string;
  department_display?: string;
  status?: "active" | "inactive" | "terminated";
  status_display?: string;
  is_active: boolean;
  must_change_password?: boolean;
  manager?: number | null;
  manager_email: string | null;
  created_at?: string;
};

type UserRole = "admin" | "sub_admin" | "hr" | "manager" | "team_lead" | "employee";
type UserDepartment = "sales" | "business_development" | "software_development" | "support" | "";
type ManagerOption = { id: number; email: string; role: string; name?: string; department?: string };

const ORGANIZATION_LABEL = "SSH Connect";
const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "sub_admin", label: "Sub Admin" },
  { value: "hr", label: "HR" },
  { value: "manager", label: "Manager" },
  { value: "team_lead", label: "Team Lead" },
  { value: "employee", label: "Employee" },
];
const DEPARTMENT_OPTIONS: { value: UserDepartment; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "business_development", label: "Business Development" },
  { value: "software_development", label: "Software Development" },
  { value: "support", label: "Support" },
];
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

type ApiList<T> = T[] | { results?: T[]; data?: T[] };

function extractList<T>(res: ApiList<T>): T[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray((res as { results?: T[] }).results)) return (res as { results: T[] }).results;
  if (Array.isArray((res as { data?: T[] }).data)) return (res as { data: T[] }).data;
  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB");
}

function getLeadName(lead: Lead) {
  if (lead.lead_name) return lead.lead_name;
  const parts = [lead.first_name, lead.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

const PAGE_SIZE = 8;

function isAdminRole(role?: string | null) {
  return (role || "").trim().toLowerCase() === "admin";
}

function isManagerRole(role?: string | null) {
  return (role || "").trim().toLowerCase() === "manager";
}

function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { paged, page, totalPages, setPage, total: items.length };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
  const s = (status || "").toLowerCase();
  const cls =
    s.includes("complet") || s.includes("won") ? "bg-emerald-100 text-emerald-700"
    : s.includes("progress") ? "bg-green-100 text-green-700"
    : s.includes("lost") ? "bg-red-100 text-red-700"
    : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status || "—"}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: string | null }) {
  const p = (priority || "").toLowerCase();
  const cls =
    p === "highest" || p === "critical" ? "bg-red-100 text-red-700"
    : p === "high" ? "bg-orange-100 text-orange-700"
    : p === "normal" || p === "medium" ? "bg-sky-100 text-sky-700"
    : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {priority || "—"}
    </span>
  );
}

function SectionHeader({
  title, total, icon, page, totalPages, onPrev, onNext,
}: {
  title: string; total: number; icon: React.ReactNode;
  page: number; totalPages: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{total}</span>
      </div>
      {total > PAGE_SIZE && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <button type="button" onClick={onPrev} disabled={page === 1} className="rounded p-0.5 hover:bg-slate-100 disabled:opacity-30">
            <ChevronLeft size={14} />
          </button>
          <span>{page} / {totalPages}</span>
          <button type="button" onClick={onNext} disabled={page === totalPages} className="rounded p-0.5 hover:bg-slate-100 disabled:opacity-30">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  // Manager assignment state
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [editingManager, setEditingManager] = useState(false);
  const [selectedManager, setSelectedManager] = useState("");
  const [savingManager, setSavingManager] = useState(false);
  const [managerError, setManagerError] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [editForm, setEditForm] = useState<{
    name: string;
    role: UserRole;
    department: UserDepartment;
    manager_id: string;
  }>({
    name: "",
    role: "employee",
    department: "",
    manager_id: "",
  });

  // Offboarding state
  const [offboardAction, setOffboardAction] = useState<"deactivate" | "reactivate" | "terminate" | null>(null);
  const [offboardSaving, setOffboardSaving] = useState(false);
  const [offboardError, setOffboardError] = useState("");

  // Permanent delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setLeads([]);
    setTasks([]);
    setMeetings([]);

    void apiRequest<EmployeeInfo>(`/auth/manage-users/${id}/`)
      .then((data) => {
        if (active) setEmployee(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    setLoadingLeads(true);
    void apiRequest<ApiList<Lead>>("/leads/", { query: { owner_id: id } })
      .then((data) => {
        if (active) setLeads(extractList(data));
      })
      .catch(() => {
        if (active) setLeads([]);
      })
      .finally(() => {
        if (active) setLoadingLeads(false);
      });

    setLoadingTasks(true);
    void apiRequest<ApiList<Task>>("/tasks/", { query: { user_id: id } })
      .then((data) => {
        if (active) setTasks(extractList(data));
      })
      .catch(() => {
        if (active) setTasks([]);
      })
      .finally(() => {
        if (active) setLoadingTasks(false);
      });

    setLoadingMeetings(true);
    void apiRequest<ApiList<Meeting>>("/meetings/", { query: { owner_id: id } })
      .then((data) => {
        if (active) setMeetings(extractList(data));
      })
      .catch(() => {
        if (active) setMeetings([]);
      })
      .finally(() => {
        if (active) setLoadingMeetings(false);
      });

    return () => { active = false; };
  }, [id]);

  // Fetch managers for admin reassignment
  useEffect(() => {
    if (!isAdmin) return;
    apiRequest<ManagerOption[]>("/auth/manage-users/")
      .then((data) => {
        setManagers((Array.isArray(data) ? data : []).filter((u) => u.role === "manager" || u.role === "team_lead"));
      })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!employee) return;
    setEditForm({
      name: employee.name || "",
      role: (employee.role as UserRole) || "employee",
      department: (employee.department as UserDepartment) || "",
      manager_id: employee.manager ? String(employee.manager) : "",
    });
  }, [employee]);

  const handleAssignManager = async () => {
    if (!selectedManager || !id) return;
    setSavingManager(true);
    setManagerError("");
    try {
      const updated = await apiRequest<EmployeeInfo>(`/auth/manage-users/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ manager: Number(selectedManager) }),
      });
      setEmployee(updated);
      setEditingManager(false);
      setSelectedManager("");
      removeDashboardCache(ADMIN_DASHBOARD_CACHE_KEY);
      removeDashboardCache(MANAGER_DASHBOARD_CACHE_KEY);
      window.dispatchEvent(new Event(TEAM_UPDATED_EVENT));
    } catch (err) {
      setManagerError(err instanceof Error ? err.message : "Failed to assign.");
    } finally {
      setSavingManager(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!id) return;
    setSavingDetails(true);
    setDetailsError("");
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        role: editForm.role,
        department: editForm.role === "admin" ? "" : editForm.department,
        manager: editForm.manager_id ? Number(editForm.manager_id) : null,
      };
      const updated = await apiRequest<EmployeeInfo>(`/auth/manage-users/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setEmployee(updated);
      setEditingDetails(false);
      removeDashboardCache(ADMIN_DASHBOARD_CACHE_KEY);
      removeDashboardCache(MANAGER_DASHBOARD_CACHE_KEY);
      window.dispatchEvent(new Event(TEAM_UPDATED_EVENT));
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to update details.");
    } finally {
      setSavingDetails(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!id || !employee) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiRequest(`/auth/manage-users/${id}/permanent-delete/`, { method: "POST" });
      removeDashboardCache(ADMIN_DASHBOARD_CACHE_KEY);
      removeDashboardCache(MANAGER_DASHBOARD_CACHE_KEY);
      window.dispatchEvent(new Event(TEAM_UPDATED_EVENT));
      navigate("/team");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  };

  const handleOffboard = async (action: "deactivate" | "reactivate" | "terminate") => {
    if (!id) return;
    setOffboardSaving(true);
    setOffboardError("");
    try {
      const updated = await apiRequest<EmployeeInfo>(`/auth/manage-users/${id}/${action}/`, { method: "POST" });
      setEmployee(updated);
      setOffboardAction(null);
      removeDashboardCache(ADMIN_DASHBOARD_CACHE_KEY);
      removeDashboardCache(MANAGER_DASHBOARD_CACHE_KEY);
      window.dispatchEvent(new Event(TEAM_UPDATED_EVENT));
    } catch (err) {
      setOffboardError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setOffboardSaving(false);
    }
  };

  const leadPag = usePagination(leads);
  const taskPag = usePagination(tasks);
  const meetPag = usePagination(meetings);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-400">
        <User size={36} />
        <p className="text-sm">Employee not found.</p>
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-green-600 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const showDepartment = !isAdminRole(employee.role);
  const showManagerField = Boolean(employee.manager_email) || !isManagerRole(employee.role);

  const statusBanner = employee.status === "terminated"
    ? { bg: "bg-red-50 border-red-200", icon: <Trash2 size={14} className="text-red-500 shrink-0" />, text: "text-red-700", label: "This account has been terminated. The user cannot log in." }
    : employee.status === "inactive"
    ? { bg: "bg-amber-50 border-amber-200", icon: <AlertTriangle size={14} className="text-amber-500 shrink-0" />, text: "text-amber-700", label: "This account is deactivated. The user cannot log in." }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6">
      {/* Back + Profile header */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      {/* Status banner */}
      {statusBanner && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${statusBanner.bg} ${statusBanner.text}`}>
          {statusBanner.icon}
          {statusBanner.label}
        </div>
      )}

      <div className="mb-6 flex items-start gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold uppercase shrink-0 ${
          employee.status === "terminated" ? "bg-red-100 text-red-600"
          : employee.status === "inactive" ? "bg-slate-100 text-slate-500"
          : "bg-emerald-100 text-emerald-700"
        }`}>
          {(employee.name || employee.email)[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{employee.name || employee.email}</h1>
              {employee.name && <p className="text-xs text-slate-400">{employee.email}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Offboarding actions (admin only) */}
              {isAdmin && (
                <>
                {employee.status === "active" && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setOffboardAction("deactivate"); setOffboardError(""); }}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
                    >
                      <UserX size={13} /> Deactivate
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOffboardAction("terminate"); setOffboardError(""); }}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                    >
                      <Trash2 size={13} /> Terminate
                    </button>
                  </>
                )}
                {(employee.status === "inactive" || employee.status === "terminated") && (
                  <button
                    type="button"
                    onClick={() => { setOffboardAction("reactivate"); setOffboardError(""); }}
                    className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition"
                  >
                    <UserCheck size={13} /> Reactivate
                  </button>
                )}
                {employee.status === "terminated" && (
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(true); setDeleteInput(""); setDeleteError(""); }}
                    className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                  >
                    <Trash2 size={13} /> Delete User
                  </button>
                )}
                </>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="capitalize rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-semibold">
              {employee.role_display || employee.role}
            </span>
            {showDepartment && employee.department && (
              <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 font-semibold">
                {employee.department_display || employee.department}
              </span>
            )}
            <span>{ORGANIZATION_LABEL}</span>
            {employee.status && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                employee.status === "active" ? "bg-green-100 text-green-700"
                : employee.status === "inactive" ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  employee.status === "active" ? "bg-green-500"
                  : employee.status === "inactive" ? "bg-amber-500"
                  : "bg-red-500"
                }`} />
                {employee.status_display || employee.status}
              </span>
            )}
          </div>

          {/* Manager info + reassign (admin only) */}
          {isAdmin && showManagerField && (
            <div className="mt-3">
              {!editingManager ? (
                <div className="flex items-center gap-2">
                  <UserCog size={13} className="text-slate-400" />
                  <span className="text-xs text-slate-500">
                    Manager:{" "}
                    <span className="font-medium text-slate-700">
                      {employee.manager_email ?? "Unassigned"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingManager(true);
                      setManagerError("");
                    }}
                    className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition"
                  >
                    <Pencil size={10} />
                    Change
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="rounded-lg border border-violet-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="">— Select manager —</option>
                    {managers.map((mgr) => (
                      <option key={mgr.id} value={mgr.id}>{mgr.email}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedManager || savingManager}
                    onClick={handleAssignManager}
                    className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition"
                  >
                    {savingManager ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    {savingManager ? "Saving..." : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingManager(false); setSelectedManager(""); setManagerError(""); }}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    <X size={11} />
                    Cancel
                  </button>
                  {managerError && <p className="w-full text-xs text-red-500">{managerError}</p>}
                </div>
              )}
            </div>
          )}

          {/* Non-admin: just show manager */}
          {!isAdmin && employee.manager_email && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <UserCog size={13} className="text-slate-400" />
              <span>Manager: <span className="font-medium text-slate-700">{employee.manager_email}</span></span>
            </div>
          )}
        </div>
      </div>

      {/* User details card */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">User Details</h2>
          {isAdmin && (
            !editingDetails ? (
              <button
                type="button"
                onClick={() => {
                  setEditingDetails(true);
                  setDetailsError("");
                }}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-violet-100 hover:text-violet-700"
              >
                <Pencil size={12} />
                Edit Details
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveDetails()}
                  disabled={savingDetails}
                  className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {savingDetails ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {savingDetails ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDetails(false);
                    setDetailsError("");
                    setEditForm({
                      name: employee.name || "",
                      role: (employee.role as UserRole) || "employee",
                      department: (employee.department as UserDepartment) || "",
                      manager_id: employee.manager ? String(employee.manager) : "",
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <X size={12} />
                  Cancel
                </button>
              </div>
            )
          )}
        </div>
        {editingDetails ? (
          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <input type="text" value={employee.email} disabled className={`${inputCls} bg-slate-50 text-slate-500`} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      role: e.target.value as UserRole,
                      department: e.target.value === "admin" ? "" : prev.department,
                    }))
                  }
                  className={inputCls}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {editForm.role !== "admin" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value as UserDepartment }))}
                    className={inputCls}
                  >
                    <option value="">- None -</option>
                    {DEPARTMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {editForm.role !== "admin" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Manager / Team Lead</label>
                  <select
                    value={editForm.manager_id}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, manager_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">- Unassigned -</option>
                    {managers
                      .filter((mgr) => mgr.id !== employee.id)
                      .map((mgr) => (
                        <option key={mgr.id} value={mgr.id}>
                          {mgr.name || mgr.email}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            {detailsError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{detailsError}</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-0 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
            {[
              { label: "Full Name", value: employee.name || "???" },
              { label: "Email", value: employee.email },
              { label: "Role", value: employee.role_display || employee.role || "N/A" },
              ...(showDepartment ? [{ label: "Department", value: employee.department_display || employee.department || "N/A" }] : []),
              { label: "Organization", value: ORGANIZATION_LABEL },
              ...(showManagerField ? [{ label: "Manager", value: employee.manager_email || "Unassigned" }] : []),
              {
                label: "Status",
                value: employee.status_display || employee.status || "???",
                badge: employee.status === "active"
                  ? "bg-green-100 text-green-700"
                  : employee.status === "inactive"
                  ? "bg-amber-100 text-amber-700"
                  : employee.status === "terminated"
                  ? "bg-red-100 text-red-700"
                  : undefined,
              },
              {
                label: "Account Active",
                value: employee.is_active ? "Yes" : "No",
                badge: employee.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
              },
              { label: "Member Since", value: formatDate(employee.created_at) },
            ].map(({ label, value, badge }) => (
              <div key={label} className="px-5 py-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                {badge ? (
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>{value}</span>
                ) : (
                  <p className="text-sm font-medium text-slate-800 break-words">{value}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stat summary */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <CircleDot size={16} className="text-violet-500" />
          <div>
            <p className="text-lg font-bold text-slate-900">{leads.length}</p>
            <p className="text-xs text-slate-500">Leads</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <CheckSquare size={16} className="text-teal-500" />
          <div>
            <p className="text-lg font-bold text-slate-900">{tasks.length}</p>
            <p className="text-xs text-slate-500">Tasks</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <CalendarDays size={16} className="text-amber-500" />
          <div>
            <p className="text-lg font-bold text-slate-900">{meetings.length}</p>
            <p className="text-xs text-slate-500">Meetings</p>
          </div>
        </div>
      </div>

      {/* Data tables */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Leads */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <SectionHeader
            title="Leads"
            total={leadPag.total}
            icon={<CircleDot size={14} className="text-violet-500" />}
            page={leadPag.page}
            totalPages={leadPag.totalPages}
            onPrev={() => leadPag.setPage((p) => Math.max(1, p - 1))}
            onNext={() => leadPag.setPage((p) => Math.min(leadPag.totalPages, p + 1))}
          />
          {loadingLeads ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Loading leads...</p>
          ) : leadPag.total === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No leads found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Company</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leadPag.paged.map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer hover:bg-slate-50 transition"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <td className="px-5 py-3 font-medium text-green-600 hover:underline">{getLeadName(lead)}</td>
                    <td className="px-3 py-3 text-slate-600 text-xs">{lead.company || "—"}</td>
                    <td className="px-3 py-3"><StatusBadge status={lead.lead_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Tasks */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <SectionHeader
            title="Tasks"
            total={taskPag.total}
            icon={<CheckSquare size={14} className="text-teal-500" />}
            page={taskPag.page}
            totalPages={taskPag.totalPages}
            onPrev={() => taskPag.setPage((p) => Math.max(1, p - 1))}
            onNext={() => taskPag.setPage((p) => Math.min(taskPag.totalPages, p + 1))}
          />
          {loadingTasks ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Loading tasks...</p>
          ) : taskPag.total === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No tasks found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-5 py-2.5">Subject</th>
                  <th className="px-3 py-2.5">Due</th>
                  <th className="px-3 py-2.5">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {taskPag.paged.map((task) => (
                  <tr
                    key={task.id}
                    className="cursor-pointer hover:bg-slate-50 transition"
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <td className="px-5 py-3 font-medium text-green-600 hover:underline line-clamp-1">{task.subject || "—"}</td>
                    <td className="px-3 py-3 text-slate-600 text-xs whitespace-nowrap">{formatDate(task.due_date)}</td>
                    <td className="px-3 py-3"><PriorityBadge priority={task.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Meetings */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:col-span-2">
          <SectionHeader
            title="Meetings"
            total={meetPag.total}
            icon={<CalendarDays size={14} className="text-amber-500" />}
            page={meetPag.page}
            totalPages={meetPag.totalPages}
            onPrev={() => meetPag.setPage((p) => Math.max(1, p - 1))}
            onNext={() => meetPag.setPage((p) => Math.min(meetPag.totalPages, p + 1))}
          />
          {loadingMeetings ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Loading meetings...</p>
          ) : meetPag.total === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No meetings found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-5 py-2.5">Title</th>
                  <th className="px-3 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {meetPag.paged.map((m) => (
                  <tr
                    key={m.id}
                    className="cursor-pointer hover:bg-slate-50 transition"
                    onClick={() => navigate(`/meetings/${m.id}`)}
                  >
                    <td className="px-5 py-3 font-medium text-green-600 hover:underline">{m.title || m.subject || "—"}</td>
                    <td className="px-3 py-3 text-slate-600 text-xs">{formatDate(m.start_datetime || m.from_datetime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Permanent delete confirmation modal */}
      {showDeleteConfirm && employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Permanently Delete User</h3>
                <p className="text-xs text-slate-500">{employee.email}</p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={12} className="inline mr-1" />
              This will <strong>permanently delete</strong> the account and all associated data. This action <strong>cannot be undone</strong>.
            </div>

            <p className="mb-3 text-sm text-slate-700">
              Type <span className="font-semibold text-slate-900">{employee.email}</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={employee.email}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />

            {deleteError && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{deleteError}</p>
            )}

            <div className="mt-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); setDeleteError(""); }}
                disabled={deleting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteInput !== employee.email || deleting}
                onClick={() => void handlePermanentDelete()}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-60"
              >
                {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete Permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offboarding confirmation modal */}
      {offboardAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="mb-4 flex items-center gap-3">
              {offboardAction === "terminate" ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <Trash2 size={18} className="text-red-600" />
                </div>
              ) : offboardAction === "deactivate" ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <UserX size={18} className="text-amber-600" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <UserCheck size={18} className="text-green-600" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-slate-900 capitalize">{offboardAction} User</h3>
                <p className="text-xs text-slate-500">{employee.email}</p>
              </div>
            </div>

            <p className="mb-4 text-sm text-slate-700">
              {offboardAction === "deactivate" &&
                "This will block the user's login immediately. Their data and records are preserved. You can reactivate them later."}
              {offboardAction === "terminate" &&
                "This permanently disables the account. The user cannot log in. All CRM records are preserved. You can still reactivate if needed."}
              {offboardAction === "reactivate" &&
                "This will restore the user's login access and set their status back to Active."}
            </p>

            {offboardError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{offboardError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setOffboardAction(null); setOffboardError(""); }}
                disabled={offboardSaving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={offboardSaving}
                onClick={() => void handleOffboard(offboardAction)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${
                  offboardAction === "reactivate" ? "bg-green-600 hover:bg-green-700"
                  : offboardAction === "deactivate" ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {offboardSaving ? (
                  <><Loader2 size={14} className="animate-spin" /> Processing...</>
                ) : offboardAction === "deactivate" ? (
                  <><UserX size={14} /> Deactivate</>
                ) : offboardAction === "reactivate" ? (
                  <><UserCheck size={14} /> Reactivate</>
                ) : (
                  <><Trash2 size={14} /> Terminate</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
