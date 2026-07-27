import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, UserPlus, Search,
  ShieldCheck, UserX, UserCheck, Trash2, ChevronRight,
} from "lucide-react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { readDashboardCache, writeDashboardCache } from "../../lib/dashboardCache";

type UserStatus = "active" | "inactive" | "terminated";

type CRMUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  role_display: string;
  status: UserStatus;
  status_display: string;
  is_active: boolean;
  manager_email: string | null;
  created_at: string;
};

const ROLE_COLOR: Record<string, string> = {
  admin:                "bg-purple-100 text-purple-700",
  sub_admin:            "bg-indigo-100 text-indigo-700",
  manager:              "bg-green-100 text-green-700",
  team_lead:            "bg-cyan-100 text-cyan-700",
  business_development: "bg-emerald-100 text-emerald-700",
  software_development: "bg-teal-100 text-teal-700",
  support_team:         "bg-amber-100 text-amber-700",
  employee:             "bg-slate-100 text-slate-600",
};

const STATUS_STYLE: Record<UserStatus, string> = {
  active:     "bg-green-100 text-green-700",
  inactive:   "bg-amber-100 text-amber-700",
  terminated: "bg-red-100 text-red-700",
};

type ConfirmAction = {
  userId: number;
  userEmail: string;
  action: "deactivate" | "reactivate" | "terminate";
};

const USERS_LIST_CACHE_KEY = "users-list-cache-v1";
const USERS_LIST_CACHE_TTL_MS = 5 * 60 * 1000;

export default function UsersListPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [initialCache] = useState(() => readDashboardCache<CRMUser[]>(USERS_LIST_CACHE_KEY, USERS_LIST_CACHE_TTL_MS));

  const [users, setUsers] = useState<CRMUser[]>(initialCache?.state ?? []);
  const [loading, setLoading] = useState(!initialCache?.state);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | UserStatus>("all");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadUsers = () => {
    setLoading(true);
    apiRequest<CRMUser[]>("/auth/manage-users/")
      .then((data) => {
        const nextUsers = Array.isArray(data) ? data : [];
        setUsers(nextUsers);
        writeDashboardCache(USERS_LIST_CACHE_KEY, nextUsers);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (initialCache?.state) {
      setLoading(false);
      return;
    }
    loadUsers();
  }, [initialCache?.state]);

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      u.role_display.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || u.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleAction = async () => {
    if (!confirm) return;
    setActioning(true);
    setActionError("");
    try {
      const updated = await apiRequest<CRMUser>(
        `/auth/manage-users/${confirm.userId}/${confirm.action}/`,
        { method: "POST" }
      );
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setConfirm(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActioning(false);
    }
  };

  const actionLabel: Record<ConfirmAction["action"], { label: string; color: string; icon: React.ReactNode }> = {
    deactivate: { label: "Deactivate",  color: "bg-amber-600 hover:bg-amber-700", icon: <UserX size={14} /> },
    reactivate: { label: "Reactivate",  color: "bg-green-600 hover:bg-green-700", icon: <UserCheck size={14} /> },
    terminate:  { label: "Terminate",   color: "bg-red-600 hover:bg-red-700",     icon: <Trash2 size={14} /> },
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {users.length} total · {users.filter((u) => u.status === "active").length} active ·{" "}
            {users.filter((u) => u.status === "inactive").length} inactive ·{" "}
            {users.filter((u) => u.status === "terminated").length} terminated
          </p>
        </div>
        <div className="flex items-center gap-2">

          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate("/team/users/create")}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              <UserPlus size={14} />
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm flex-1 min-w-[200px]">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by name, email or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Loading users...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
          No users found.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <th className="px-5 py-3">User</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Manager</th>
                {isAdmin && <th className="px-3 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className={`transition hover:bg-slate-50 ${!u.is_active ? "opacity-60" : ""}`}
                >
                  {/* User info */}
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/team/user/${u.id}`)}
                      className="flex items-center gap-2.5 text-left group"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase ${
                        u.status === "terminated" ? "bg-red-100 text-red-600"
                        : u.status === "inactive" ? "bg-slate-100 text-slate-500"
                        : "bg-green-100 text-green-700"
                      }`}>
                        {(u.name || u.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 group-hover:text-green-600 transition">
                          {u.name || "—"}
                        </p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </button>
                  </td>

                  {/* Role */}
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_COLOR[u.role] || "bg-slate-100 text-slate-600"}`}>
                      {u.role_display}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[u.status]}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.status === "active" ? "bg-green-500" : u.status === "inactive" ? "bg-amber-500" : "bg-red-500"}`} />
                      {u.status_display}
                    </span>
                  </td>

                  {/* Manager */}
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {u.manager_email || "—"}
                  </td>

                  {/* Actions */}
                  {isAdmin && (
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.status === "active" && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setConfirm({ userId: u.id, userEmail: u.email, action: "deactivate" }); setActionError(""); }}
                              title="Deactivate"
                              className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
                            >
                              <UserX size={12} /> Deactivate
                            </button>
                            <button
                              type="button"
                              onClick={() => { setConfirm({ userId: u.id, userEmail: u.email, action: "terminate" }); setActionError(""); }}
                              title="Terminate"
                              className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                            >
                              <Trash2 size={12} /> Terminate
                            </button>
                          </>
                        )}
                        {(u.status === "inactive" || u.status === "terminated") && (
                          <button
                            type="button"
                            onClick={() => { setConfirm({ userId: u.id, userEmail: u.email, action: "reactivate" }); setActionError(""); }}
                            title="Reactivate"
                            className="flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition"
                          >
                            <UserCheck size={12} /> Reactivate
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/team/user/${u.id}`)}
                          className="flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 transition"
                          title="View profile"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="mb-4 flex items-center gap-3">
              {confirm.action === "terminate" ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <Trash2 size={18} className="text-red-600" />
                </div>
              ) : confirm.action === "deactivate" ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <UserX size={18} className="text-amber-600" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <UserCheck size={18} className="text-green-600" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-slate-900 capitalize">
                  {confirm.action} User
                </h3>
                <p className="text-xs text-slate-500">{confirm.userEmail}</p>
              </div>
            </div>

            <p className="mb-2 text-sm text-slate-700">
              {confirm.action === "deactivate" &&
                "This will block the user's login immediately. Their data and history will be preserved. You can reactivate them later."}
              {confirm.action === "terminate" &&
                "This permanently disables the account. The user cannot log in. All their CRM records are preserved. You can still reactivate if needed."}
              {confirm.action === "reactivate" &&
                "This will restore the user's login access and set their status back to Active."}
            </p>

            {confirm.action !== "reactivate" && (
              <div className="mb-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                <ShieldCheck size={12} className="inline mr-1" />
                Please reassign their open tasks and meetings from their profile page before proceeding.
              </div>
            )}

            {actionError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setConfirm(null); setActionError(""); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actioning}
                onClick={() => void handleAction()}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${actionLabel[confirm.action].color}`}
              >
                {actioning ? <Loader2 size={14} className="animate-spin" /> : actionLabel[confirm.action].icon}
                {actioning ? "Processing..." : actionLabel[confirm.action].label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
