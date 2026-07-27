import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { apiRequest } from "../../api/client";
import type { CreateProjectPayload, Project } from "./types";

const emptyForm: CreateProjectPayload = {
  project_code: "",
  name: "",
  account_name: "",
  contact_name: "",
  deal_name: "",
  source_module: "",
  source_record_id: "",
  source_record_label: "",
  owner: "",
  status: "Planning",
  priority: "Medium",
  start_date: "",
  due_date: "",
  estimated_hours: "",
  description: "",
};

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateProjectPayload>(emptyForm);

  useEffect(() => {
    if (isEdit) return;
    apiRequest<{ project_code: string }>("/projects/next-code/")
      .then((data) =>
        setFormData((prev) => ({
          ...prev,
          project_code: data.project_code,
          name: prev.name || searchParams.get("name") || "",
          account_name: prev.account_name || searchParams.get("accountName") || "",
          contact_name: prev.contact_name || searchParams.get("contactName") || "",
          deal_name: prev.deal_name || searchParams.get("dealName") || "",
          source_module: prev.source_module || searchParams.get("sourceModule") || "",
          source_record_id:
            prev.source_record_id ||
            (searchParams.get("sourceId") ? Number(searchParams.get("sourceId")) : ""),
          source_record_label: prev.source_record_label || searchParams.get("sourceLabel") || searchParams.get("name") || "",
          owner: prev.owner || searchParams.get("owner") || "",
          due_date: prev.due_date || searchParams.get("dueDate") || "",
          description:
            prev.description ||
            (searchParams.get("sourceModule")
              ? `Created from ${searchParams.get("sourceModule")} #${searchParams.get("sourceId") || ""}`.trim()
              : ""),
        }))
      )
      .catch(() => {});
  }, [isEdit, searchParams]);

  useEffect(() => {
    if (!isEdit) return;
    const fetchProject = async () => {
      try {
        const project = await apiRequest<Project>(`/projects/${id}/`);
        setFormData({
          project_code: project.project_code ?? "",
          name: project.name ?? "",
          account_name: project.account_name ?? "",
          contact_name: project.contact_name ?? "",
          deal_name: project.deal_name ?? "",
          source_module: project.source_module ?? "",
          source_record_id: project.source_record_id ?? "",
          source_record_label: project.source_record_label ?? "",
          owner: project.owner ?? "",
          status: project.status,
          priority: project.priority,
          start_date: project.start_date ?? "",
          due_date: project.due_date ?? "",
          estimated_hours: project.estimated_hours ?? "",
          description: project.description ?? "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setFetching(false);
      }
    };
    fetchProject();
  }, [id, isEdit]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "estimated_hours"
          ? value === ""
            ? ""
            : Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_code || !formData.name) {
      setError("Project name is required");
      return;
    }
    const payload = {
      ...formData,
      source_record_id: formData.source_record_id === "" ? null : Number(formData.source_record_id),
      estimated_hours: formData.estimated_hours === "" ? 0 : formData.estimated_hours,
    };
    try {
      setLoading(true);
      setError(null);
      if (isEdit) {
        await apiRequest(`/projects/${id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        navigate(`/projects/${id}`);
      } else {
        const response = await apiRequest("/projects/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const created = response as { id: string | number };
        navigate(`/projects/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? "update" : "create"} project`);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Loading project...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 px-6 py-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-slate-900">
              {isEdit ? "Edit Project" : "Create Project"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isEdit
                ? "Update the project details below."
                : "Add a new project with the core planning details."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {formData.source_module && formData.source_record_id ? (
              <div className="rounded-lg border border-blue-200 bg-green-50 px-4 py-3 text-sm text-blue-900">
                Linked source: {formData.source_module.replace(/-/g, " ")} #{formData.source_record_id}
                {formData.source_record_label ? ` - ${formData.source_record_label}` : ""}
              </div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Project Code">
                <input
                  type="text"
                  name="project_code"
                  value={formData.project_code}
                  onChange={isEdit ? handleChange : undefined}
                  readOnly={!isEdit}
                  placeholder="PRJ0001"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none ${
                    isEdit
                      ? "border-slate-300 focus:border-green-500"
                      : "cursor-default border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                  required
                />
              </FormField>

              <FormField label="Project Name">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter project name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                  required
                />
              </FormField>

              <FormField label="Assigned Manager">
                <input
                  type="text"
                  name="owner"
                  value={formData.owner}
                  onChange={handleChange}
                  placeholder="Enter assigned manager"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                />
              </FormField>

              <FormField label="Status">
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                >
                  {["Planning", "Active", "On Hold", "Delayed", "Completed", "Cancelled"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Priority">
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                >
                  {["Low", "Medium", "High"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Start Date">
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                />
              </FormField>

              <FormField label="Due Date">
                <input
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                />
              </FormField>


            </div>

            <FormField label="Project Description">
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                placeholder="Enter project description"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
              />
            </FormField>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Saving..." : isEdit ? "Update Project" : "Save Project"}
              </button>
              <button
                type="button"
                onClick={() => navigate(isEdit ? `/projects/${id}` : "/projects")}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
