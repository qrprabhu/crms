import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { apiRequest } from "../../api/client";
import type { Project } from "./types";
import { ProjectPriorityBadge,ProjectStatusBadge } from "./ProjectStatusBadge";
import { FolderKanban, Search, Plus, Filter, LayoutList, KanbanSquare } from "lucide-react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [view, setView] = useState<"list" | "cards">("list");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiRequest("/projects/");
        const res = response as Project[] | { results: Project[] };
        const data = Array.isArray(res) ? res : res.results || [];
        setProjects(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch projects");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.name?.toLowerCase().includes(search.toLowerCase()) ||
        project.account_name?.toLowerCase().includes(search.toLowerCase()) ||
        project.owner?.toLowerCase().includes(search.toLowerCase()) ||
        project.project_code?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === "Active").length;
  const delayedProjects = projects.filter((p) => p.status === "Delayed").length;
  const completedProjects = projects.filter((p) => p.status === "Completed").length;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 px-6 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Projects</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage project delivery, progress, tasks, issues, and execution.
            </p>
          </div>

          <Link
            to="/projects/create"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Total Projects" value={String(totalProjects)} />
          <SummaryCard title="Active Projects" value={String(activeProjects)} />
          <SummaryCard title="Delayed Projects" value={String(delayedProjects)} />
          <SummaryCard title="Completed Projects" value={String(completedProjects)} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search projects, project code, owner..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 py-2.5 pl-9 pr-8 text-sm outline-none focus:border-green-500"
                >
                  <option value="All">All Status</option>
                  <option value="Planning">Planning</option>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setView("list")}
                className={`rounded-lg border px-3 py-2 ${
                  view === "list"
                    ? "border-blue-600 bg-green-50 text-green-700"
                    : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("cards")}
                className={`rounded-lg border px-3 py-2 ${
                  view === "cards"
                    ? "border-blue-600 bg-green-50 text-green-700"
                    : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                <KanbanSquare className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">Loading projects...</div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : view === "list" ? (
            <ProjectsTable projects={filteredProjects} />
          ) : (
            <ProjectsCards projects={filteredProjects} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <h3 className="mt-2 text-2xl font-semibold text-slate-900">{value}</h3>
    </div>
  );
}

function ProjectsTable({ projects }: { projects: Project[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-slate-200 text-left text-sm text-slate-500">
            <th className="px-4 py-3 font-medium">Project Code</th>
            <th className="px-4 py-3 font-medium">Project Name</th>
            <th className="px-4 py-3 font-medium">Owner</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Progress</th>
            <th className="px-4 py-3 font-medium">Due Date</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-b border-slate-100 text-sm">
              <td className="px-4 py-4 text-slate-700">{project.project_code || "—"}</td>
              <td className="px-4 py-4">
                <Link
                  to={`/projects/${project.id}`}
                  className="font-medium text-green-600 hover:text-green-700"
                >
                  {project.name}
                </Link>
              </td>
              <td className="px-4 py-4 text-slate-700">{project.owner || "—"}</td>
              <td className="px-4 py-4">
                <ProjectStatusBadge status={project.status} />
              </td>
              <td className="px-4 py-4">
                <ProjectPriorityBadge priority={project.priority} />
              </td>
              <td className="px-4 py-4">
                <div className="min-w-[120px]">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{project.progress ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-green-600"
                      style={{ width: `${project.progress ?? 0}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-slate-700">{project.due_date || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <FolderKanban className="mb-3 h-10 w-10 text-slate-300" />
          <h3 className="text-lg font-medium text-slate-800">No projects found</h3>
          <p className="mt-1 text-sm text-slate-500">Try changing the search or filter.</p>
        </div>
      )}
    </div>
  );
}

function ProjectsCards({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <FolderKanban className="mb-3 h-10 w-10 text-slate-300" />
        <h3 className="text-lg font-medium text-slate-800">No projects found</h3>
        <p className="mt-1 text-sm text-slate-500">Try changing the search or filter.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <Link
          key={project.id}
          to={`/projects/${project.id}`}
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {project.project_code || "—"}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{project.name}</h3>
            </div>
            <ProjectStatusBadge status={project.status} />
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <p><span className="font-medium text-slate-800">Owner:</span> {project.owner || "—"}</p>
            <p><span className="font-medium text-slate-800">Due:</span> {project.due_date || "—"}</p>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span>{project.progress ?? 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-green-600"
                style={{ width: `${project.progress ?? 0}%` }}
              />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}