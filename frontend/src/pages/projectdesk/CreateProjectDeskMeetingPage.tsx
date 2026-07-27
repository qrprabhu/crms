import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout";
import { apiRequest } from "../../api/client";

type ProjectOption = {
  id: number | string;
  name: string;
  project_code?: string;
};

type SelectableUser = {
  id: number | string;
  name?: string;
  email: string;
};

type SelectedParticipant = {
  name: string;
  email: string;
};

type MeetingStatus = "Scheduled" | "Completed" | "Cancelled" | "Rescheduled";
type MeetingType = "Online" | "Offline";

export default function CreateProjectDeskMeetingPage() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<SelectableUser[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialProject = searchParams.get("project") ?? "";

  const [form, setForm] = useState({
    project: initialProject,
    title: "",
    participants: [] as SelectedParticipant[],
    meeting_type: "Online" as MeetingType,
    meeting_link: "",
    location: "",
    start_datetime: "",
    status: "Scheduled" as MeetingStatus,
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
    apiRequest<SelectableUser[]>("/auth/manage-users/")
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

  const availableParticipants = useMemo(
    () =>
      users.filter((user) => {
        return !form.participants.some(
          (participant) => participant.email.toLowerCase() === user.email.toLowerCase()
        );
      }),
    [form.participants, users]
  );

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-blue-100";

  const handleAddParticipant = () => {
    if (!selectedParticipant) return;
    const matchedUser = users.find((user) => String(user.id) === selectedParticipant);
    if (!matchedUser) return;
    setForm((current) => ({
      ...current,
      participants: [
        ...current.participants,
        {
          name: matchedUser.name?.trim() || matchedUser.email,
          email: matchedUser.email,
        },
      ],
    }));
    setSelectedParticipant("");
  };

  const handleRemoveParticipant = (participantToRemove: string) => {
    setForm((current) => ({
      ...current,
      participants: current.participants.filter(
        (participant) => participant.email !== participantToRemove
      ),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.project || !form.title.trim() || !form.start_datetime) {
      setError("Project, meeting title, and date & time are required.");
      return;
    }

    if (form.meeting_type === "Online" && !form.meeting_link.trim()) {
      setError("Meeting link is required for online meetings.");
      return;
    }

    if (form.meeting_type === "Offline" && !form.location.trim()) {
      setError("Location is required for offline meetings.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await apiRequest("/projectdesk/meetings/", {
        method: "POST",
        body: JSON.stringify({
          project: Number(form.project),
          title: form.title,
          meeting_type: form.meeting_type,
          start_datetime: form.start_datetime,
          status: form.status,
          participant_entries: form.participants.map((participant) => ({
            name: participant.name,
            email: participant.email,
          })),
          meeting_link: form.meeting_type === "Online" ? form.meeting_link.trim() : "",
          location: form.meeting_type === "Offline" ? form.location.trim() : "",
        }),
      });
      alert("Meeting was scheduled successfully.");
      setSelectedParticipant("");
      setForm({
        project: form.project,
        title: "",
        participants: [],
        meeting_type: "Online",
        meeting_link: "",
        location: "",
        start_datetime: "",
        status: "Scheduled",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule meeting.");
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
          <h1 className="text-3xl font-semibold text-slate-900">Schedule ProjectDesk Meeting</h1>
          <p className="mt-2 text-sm text-slate-500">
            This meeting is created only for ProjectDesk and stays separate from the Activity module.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Meeting Title</label>
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Enter meeting title"
                />
              </div>

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
                <label className="mb-2 block text-sm font-medium text-slate-700">Date & Time</label>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={form.start_datetime}
                  onChange={(event) => setForm((current) => ({ ...current, start_datetime: event.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Participants</label>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex min-h-[52px] flex-wrap items-center gap-2">
                    {form.participants.length > 0 ? (
                      form.participants.map((participant) => (
                        <span
                          key={participant.email}
                          className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-sm text-green-700"
                        >
                          {participant.name}
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(participant.email)}
                            className="text-blue-500 transition hover:text-green-700"
                          >
                            x
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">Selected users will appear here</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-3 md:flex-row">
                    <select
                      className={inputCls}
                      value={selectedParticipant}
                      onChange={(event) => setSelectedParticipant(event.target.value)}
                      disabled={loadingUsers || availableParticipants.length === 0}
                    >
                      <option value="">
                        {loadingUsers
                          ? "Loading users..."
                          : availableParticipants.length === 0
                            ? "No more users available"
                            : "Select participant"}
                      </option>
                      {availableParticipants.map((user) => {
                        return (
                          <option key={user.id} value={String(user.id)}>
                            {user.name?.trim() ? `${user.name} (${user.email})` : user.email}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={handleAddParticipant}
                      disabled={!selectedParticipant}
                      className="rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      Add User
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Meeting Type</label>
                <select
                  className={inputCls}
                  value={form.meeting_type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      meeting_type: event.target.value as MeetingType,
                      meeting_link: event.target.value === "Online" ? current.meeting_link : "",
                      location: event.target.value === "Offline" ? current.location : "",
                    }))
                  }
                >
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>

              {form.meeting_type === "Online" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Meeting Link</label>
                  <input
                    type="url"
                    className={inputCls}
                    value={form.meeting_link}
                    onChange={(event) => setForm((current) => ({ ...current, meeting_link: event.target.value }))}
                    placeholder="Enter meeting link"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Location</label>
                  <input
                    className={inputCls}
                    value={form.location}
                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                    placeholder="Enter meeting location"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <Link
                to={selectedProject ? `/projects/${selectedProject.id}` : "/team"}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Schedule Meeting"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
