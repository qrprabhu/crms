import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Filter, Pencil } from "lucide-react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import FilterSidebar from "../../../components/crm/FilterSidebar";
import { apiRequest } from "../../../api/client";
import type { FilterSection } from "../../../lib/shared/crmTypes";

type FilterMap = Record<string, string>;

const TASK_FILTER_SECTIONS: FilterSection[] = [
  {
    title: "Status",
    items: [{ label: "Status contains", key: "status" }],
  },
  {
    title: "Priority",
    items: [{ label: "Priority contains", key: "priority" }],
  },
  {
    title: "Owner",
    items: [{ label: "Owner name", key: "owner" }],
  },
  {
    title: "Related",
    items: [
      { label: "Related contact/account", key: "related" },
      { label: "Company / Account", key: "company" },
    ],
  },
];

type TaskDetail = {
  id: number | string;
  subject: string;
  description?: string | null;
  due_date?: string | null;
  status?: string | null;
  priority?: string | null;
  reminder: boolean;
  repeat: boolean;
  owner?: { id?: number; name?: string; email?: string } | null;
  contact_name?: string | null;
  account_name?: string | null;
  created_at?: string;
  updated_at?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-GB", { hour12: true });
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setFilters] = useState<FilterMap>({});

  useEffect(() => {
    let isMounted = true;
    if (!id) {
      setError("Invalid task identifier.");
      setLoading(false);
      return;
    }

    const fetchTask = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await apiRequest<TaskDetail>(`/tasks/${id}/`);
        if (isMounted) {
          setTask(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load task.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchTask();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const statRows = useMemo(() => {
    if (!task) return [];
    return [
      { label: "Status", value: task.status || "N/A" },
      { label: "Priority", value: task.priority || "N/A" },
      { label: "Due date", value: formatDate(task.due_date) },
      { label: "Created", value: formatDate(task.created_at) },
    ];
  }, [task]);

  return (
    <DashboardLayout>
      <div className="px-6 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate("/tasks")}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Back to tasks
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFilterOpen((prev) => !prev)}
              className={`flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition duration-150 hover:bg-slate-50 ${
                filterOpen ? "bg-slate-100 shadow-sm" : "bg-white"
              }`}
            >
              <Filter size={16} />
              <span>Filters</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/tasks/${id}/edit`)}
              className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Pencil size={15} />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          {filterOpen && (
            <FilterSidebar
              title="Filter Tasks by"
              sections={TASK_FILTER_SECTIONS}
              onApply={(activeFilters) => setFilters(activeFilters)}
              onClear={() => setFilters({})}
            />
          )}

          <div className="flex-1">
            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-3 text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Loading task...</span>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : (
              task && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-2">
                      {statRows.map((row) => (
                        <div key={row.label} className="space-y-1 text-sm text-slate-600">
                          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                            {row.label}
                          </p>
                          <p className="text-base font-medium text-slate-900">{row.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Owner
                        </p>
                        <p className="text-base font-medium text-slate-900">
                          {task.owner?.name ?? "Unassigned"}
                        </p>
                        {task.owner?.email && (
                          <p className="text-xs text-slate-500">{task.owner.email}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Contact
                        </p>
                        <p className="text-base font-medium text-slate-900">
                          {task.contact_name || "None"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Account
                        </p>
                        <p className="text-base font-medium text-slate-900">
                          {task.account_name || "None"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                        Description
                      </p>
                      <p className="text-sm text-slate-700">{task.description || "No description provided."}</p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
