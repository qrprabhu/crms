import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Mail, UserPlus } from "lucide-react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { removeDashboardCache } from "../../lib/dashboardCache";

const TEAM_UPDATED_EVENT = "team:updated";
const ADMIN_DASHBOARD_CACHE_KEY = "admin-dashboard-cache-v1";
const MANAGER_DASHBOARD_CACHE_KEY = "manager-dashboard-cache-v1";

type UserRole =
  | "admin"
  | "sub_admin"
  | "hr"
  | "manager"
  | "team_lead"
  | "business_development"
  | "software_development"
  | "support_team"
  | "employee";

type UserDepartment = "sales" | "business_development" | "software_development" | "support" | "";

const ROLE_OPTIONS: { value: UserRole; label: string; allowedFor: ("admin" | "sub_admin" | "manager" | "team_lead")[] }[] = [
  { value: "hr", label: "HR", allowedFor: ["admin", "sub_admin"] },
  { value: "manager", label: "Manager", allowedFor: ["admin", "sub_admin"] },
  { value: "team_lead", label: "Team Lead", allowedFor: ["admin", "sub_admin", "manager"] },
  { value: "employee", label: "Employee", allowedFor: ["admin", "sub_admin", "manager", "team_lead"] },
];

const DEPARTMENT_OPTIONS: { value: UserDepartment; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "business_development", label: "Business Development" },
  { value: "software_development", label: "Software Development" },
  { value: "support", label: "Support" },
];

type Manager = { id: number; email: string; name?: string; department?: string };

type FormState = {
  name: string;
  email: string;
  role: UserRole;
  department: UserDepartment;
  manager_id: string;
};

type CreatedUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  role_display?: string;
  email_sent?: boolean;
  temp_password?: string;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-blue-100";

export default function UserCreatePage() {
  const navigate = useNavigate();
  const { role: creatorRole, isAdmin, isManager } = useAuth();

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    role: "employee",
    department: "",
    manager_id: "",
  });
  const [managers, setManagers] = useState<Manager[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);

  const availableRoles = ROLE_OPTIONS.filter((item) =>
    item.allowedFor.includes(creatorRole as "admin" | "sub_admin" | "manager" | "team_lead"),
  );

  const showManagerDropdown =
    isAdmin &&
    (form.role === "employee" ||
      form.role === "team_lead" ||
      form.role === "business_development" ||
      form.role === "software_development" ||
      form.role === "support_team");

  useEffect(() => {
    if (!isAdmin) return;
    apiRequest<{ id: number; email: string; name?: string; role: string; department?: string }[]>("/auth/manage-users/")
      .then((data) => {
        const managerRows = (Array.isArray(data) ? data : []).filter(
          (item) => item.role === "manager" || item.role === "team_lead",
        );
        setManagers(managerRows);
      })
      .catch(() => setManagers([]));
  }, [isAdmin]);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: isAdmin ? form.role : "employee",
        department: form.department || "",
      };
      if (isAdmin && form.manager_id) {
        payload.manager = Number(form.manager_id);
      }

      const result = await apiRequest<CreatedUser>("/auth/manage-users/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreated(result);
      removeDashboardCache(ADMIN_DASHBOARD_CACHE_KEY);
      removeDashboardCache(MANAGER_DASHBOARD_CACHE_KEY);
      window.dispatchEvent(new Event(TEAM_UPDATED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-6">
        <div className="mx-auto max-w-lg">
          <div className="rounded-xl border border-green-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h2 className="mb-1 text-xl font-bold text-slate-900">User Created</h2>
            <p className="mb-6 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{created.name || created.email}</span> has been added as{" "}
              <span className="font-medium text-slate-700">{created.role_display || created.role}</span>.
            </p>

            {created.email_sent ? (
              <div className="mb-6 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-left">
                <div className="flex items-start gap-2">
                  <Mail size={16} className="mt-0.5 shrink-0 text-green-600" />
                  <div className="text-sm text-blue-800">
                    <p className="mb-0.5 font-medium">Credentials sent by email</p>
                    <p className="text-green-600">
                      A welcome email with the auto-generated password and login link has been sent to{" "}
                      <span className="font-medium">{created.email}</span>. The user must change their password on first login.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left">
                <div className="flex items-start gap-2">
                  <Mail size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <div className="w-full text-sm text-amber-800">
                    <p className="mb-1 font-medium">Email delivery failed - share credentials manually</p>
                    <p className="mb-2 text-xs text-amber-700">
                      The email could not be sent. Please share these credentials with the user directly.
                    </p>
                    <div className="space-y-1 rounded-md border border-amber-200 bg-white px-3 py-2">
                      <p className="text-xs">
                        <span className="font-medium text-slate-600">Email:</span> {created.email}
                      </p>
                      {created.temp_password && (
                        <p className="text-xs">
                          <span className="font-medium text-slate-600">Password:</span>{" "}
                          <span className="font-mono font-bold text-slate-900">{created.temp_password}</span>
                        </p>
                      )}
                      <p className="mt-1 text-xs text-amber-600">The user must change this password on first login.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCreated(null);
                  setForm({ name: "", email: "", role: "employee", department: "", manager_id: "" });
                }}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Create Another
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          <UserPlus size={20} className="text-green-600" />
          <h1 className="text-xl font-bold text-slate-900">{isAdmin ? "Create New User" : "Add Employee"}</h1>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Arjun Kumar"
              className={inputCls}
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="user@example.com"
              className={inputCls}
            />
          </div>

          {(isAdmin || isManager) && availableRoles.length > 0 && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    role: e.target.value as UserRole,
                    manager_id: "",
                  }))
                }
                className={inputCls}
              >
                {availableRoles.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
            <select
              value={form.department}
              onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value as UserDepartment }))}
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

          {showManagerDropdown && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Assign to Manager / Team Lead</label>
              {managers.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  No managers found. Create a manager or team lead first, or leave unassigned.
                </p>
              ) : (
                <select
                  value={form.manager_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selectedManager = managers.find((item) => String(item.id) === selectedId);
                    setForm((prev) => ({
                      ...prev,
                      manager_id: selectedId,
                      department: (selectedManager?.department as UserDepartment) || prev.department,
                    }));
                  }}
                  className={inputCls}
                >
                  <option value="">- Unassigned -</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name || manager.email}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="mb-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2.5 text-xs text-green-700">
            A secure password will be auto-generated and sent to the user's email along with the login link. The user must
            change their password on first login.
          </div>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              {saving ? "Creating..." : "Create User"}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
