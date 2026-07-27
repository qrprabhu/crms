import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout";
import { apiRequest } from "../../api/client";
import type { ProjectPriority, ProjectTaskStatus } from "../projects/types";

type ProjectOption = {
  id: number | string;
  name: string;
  project_code?: string;
};

type AssignableUser = {
  id: number | string;
  name?: string;
  email: string;
  role?: string;
};

const TASK_PRIORITIES: ProjectPriority[] = ["Low", "Medium", "High"];
const TASK_STATUSES: ProjectTaskStatus[] = ["Not Started", "In Progress", "On Hold", "Completed"];

function getCurrentUserEmail() {
  try {
    const raw = localStorage.getItem("loggedInUser");
    if (!raw) return "";
    const user = JSON.parse(raw) as { email?: string };
    return user.email ?? "";
  } catch {
    return "";
  }
}

function getCurrentUserRole() {
  try {
    const raw = localStorage.getItem("loggedInUser");
    if (!raw) return "";
    const user = JSON.parse(raw) as { role?: string };
    return user.role ?? "";
  } catch {
    return "";
  }
}

export default function CreateProjectDeskTaskPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserRole = getCurrentUserRole().trim().toLowerCase();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialProject = searchParams.get("project") ?? "";

  const [form, setForm] = useState({
    project: initialProject,
    title: "",
    description: "",
    assignee_role: "",
    owner: "",
    assigned_by: getCurrentUserEmail(),
    due_date: "",
    priority: "Medium" as ProjectPriority,
    status: "Not Started" as ProjectTaskStatus,
  });

  useEffect(() => {
    let active = true;
    apiRequest<ProjectOption[] | { results?: ProjectOption[] }>("/projects/")
      .then((response) => {
        if (!active) return;
        const items = Array.isArray(response) ? response : response.results ?? [];
        setProjects(items);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load projects.");
      })
      .finally(() => {
        if (active) setLoadingProjects(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<AssignableUser[]>("/auth/manage-users/")
      .then((response) => {
        if (!active) return;
        setUsers(Array.isArray(response) ? response : []);
      })
      .catch(() => {
        if (!active) return;
        setUsers([]);
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === form.project),
    [projects, form.project]
  );

  const assignTypeOptions = useMemo(() => {
    if (currentUserRole === "manager") {
      return [{ value: "employee", label: "Employee" }];
    }
    return [
      { value: "manager", label: "Manager" },
      { value: "employee", label: "Employee" },
    ];
  }, [currentUserRole]);

  useEffect(() => {
    if (currentUserRole === "manager" && !form.assignee_role) {
      setForm((current) => ({
        ...current,
        assignee_role: "employee",
      }));
    }
  }, [currentUserRole, form.assignee_role]);

  const assignableUsers = useMemo(() => {
    if (currentUserRole === "manager") {
      return users.filter((user) => user.role === "employee");
    }
    if (form.assignee_role === "manager") {
      return users.filter((user) => user.role === "manager");
    }
    if (form.assignee_role === "employee") {
      return users.filter((user) => user.role === "employee");
    }
    return [];
  }, [form.assignee_role, users]);

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-blue-100";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.project || !form.title.trim()) {
      setError("Project and task title are required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await apiRequest("/projectdesk/tasks/", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          project: Number(form.project),
          due_date: form.due_date || null,
        }),
      });
      navigate(`/projects/${form.project}?tab=tasks`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 px-6 py-6">
        <div className="mb-4">
          <Link
            to="/team"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Team
          </Link>
        </div>

        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Assign ProjectDesk Task</h1>
          <p className="mt-2 text-sm text-slate-500">
            Create a ProjectDesk task with its own form. Saved tasks appear in the selected project's Tasks tab.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Project</label>
                <select
                  className={inputCls}
                  value={form.project}
                  onChange={(event) => setForm((current) => ({ ...current, project: event.target.value }))}
                  disabled={loadingProjects}
                >
                  <option value="">{loadingProjects ? "Loading projects..." : "Select project"}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_code ? `${project.project_code} - ${project.name}` : project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Task Title</label>
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Enter task title"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  className={`${inputCls} min-h-[140px] resize-none`}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Enter task description"
                />
              </div>

              {currentUserRole !== "manager" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Assign To Type</label>
                  <select
                    className={inputCls}
                    value={form.assignee_role}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        assignee_role: event.target.value,
                        owner: "",
                      }))
                    }
                  >
                    <option value="">Select type</option>
                    {assignTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Assign To</label>
                <select
                  className={inputCls}
                  value={form.owner}
                  onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
                  disabled={loadingUsers || (currentUserRole !== "manager" && !form.assignee_role)}
                >
                  <option value="">
                    {loadingUsers
                      ? "Loading users..."
                      : currentUserRole === "manager"
                        ? "Select employee"
                        : form.assignee_role
                          ? "Select user"
                          : "Select type first"}
                  </option>
                  {assignableUsers.map((user) => {
                    const displayName = user.name?.trim() || user.email;
                    return (
                      <option key={user.id} value={displayName}>
                        {user.name?.trim() ? `${user.name} (${user.email})` : user.email}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Assigned By</label>
                <input
                  className={inputCls}
                  value={form.assigned_by}
                  onChange={(event) => setForm((current) => ({ ...current, assigned_by: event.target.value }))}
                  placeholder="Enter assigner"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Due Date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.due_date}
                  onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Priority</label>
                <select
                  className={inputCls}
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, priority: event.target.value as ProjectPriority }))
                  }
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                <select
                  className={inputCls}
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as ProjectTaskStatus }))
                  }
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Link
                to={selectedProject ? `/projects/${selectedProject.id}?tab=tasks` : "/team"}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Task"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
