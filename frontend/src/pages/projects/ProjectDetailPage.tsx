import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { apiRequest } from "../../api/client";
import type {
  Project,
  ProjectTask,
  ProjectPriority,
  ProjectTaskStatus,
  ProjectMeeting,
  ProjectMeetingAttendanceRecord,
} from "./types";
import { ProjectPriorityBadge, ProjectStatusBadge } from "./ProjectStatusBadge";
import { CalendarDays, FileText, FolderKanban, ArrowLeft, Pencil, Plus, Trash2, Check, X, Eye } from "lucide-react";

type TabKey = "overview" | "tasks" | "files" | "notes" | "meetings";

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

function getCurrentUserProfile() {
  try {
    const raw = localStorage.getItem("loggedInUser");
    if (!raw) return { email: "", name: "", role: "" };
    const user = JSON.parse(raw) as { email?: string; name?: string; full_name?: string; role?: string };
    return {
      email: user.email ?? "",
      name: user.name ?? user.full_name ?? "",
      role: user.role ?? "",
    };
  } catch {
    return { email: "", name: "", role: "" };
  }
}

function getSourceRoute(project: Project) {
  if (!project.source_module || !project.source_record_id) return null;
  return `/${project.source_module}/${project.source_record_id}`;
}

function formatSourceModuleLabel(value?: string) {
  if (!value) return "-";
  return value
    .split("-")
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [noteActionLoading, setNoteActionLoading] = useState<string | number | null>(null);
  const [attendanceLoadingId, setAttendanceLoadingId] = useState<string | number | null>(null);
  const currentUser = useMemo(() => getCurrentUserProfile(), []);
  const canManageMeetingAttendance = ["admin", "sub_admin", "manager"].includes(
    currentUser.role.trim().toLowerCase()
  );

  const fetchProject = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest(`/projects/${id}/`);
      setProject(response as Project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void fetchProject();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (!requestedTab) return;
    const allowedTabs: TabKey[] = ["overview", "tasks", "files", "notes", "meetings"];
    if (allowedTabs.includes(requestedTab as TabKey)) {
      setActiveTab(requestedTab as TabKey);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleTopbarSearch = (event: Event) => {
      const nextQuery = (event as CustomEvent<string>).detail || "";
      setSearchQuery(nextQuery.trim().toLowerCase());
    };

    window.addEventListener("topbar:search", handleTopbarSearch as EventListener);
    return () => {
      window.removeEventListener("topbar:search", handleTopbarSearch as EventListener);
    };
  }, []);

  const completedTasks = useMemo(
    () => project?.tasks?.filter((t) => t.status === "Completed").length ?? 0,
    [project]
  );

  const filteredTasks = useMemo(() => {
    const tasks = project?.tasks || [];
    if (!searchQuery) return tasks;
    return tasks.filter((task) =>
      [
        task.title,
        task.description,
        task.owner,
        task.assigned_by,
        task.due_date,
        task.status,
        task.priority,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery)
    );
  }, [project?.tasks, searchQuery]);

  const filteredFiles = useMemo(() => {
    const files = project?.files || [];
    if (!searchQuery) return files;
    return files.filter((file) =>
      [file.name, file.type, file.uploaded_by, file.uploaded_at]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery)
    );
  }, [project?.files, searchQuery]);

  const filteredNotes = useMemo(() => {
    const notes = project?.notes || [];
    if (!searchQuery) return notes;
    return notes.filter((note) =>
      [note.content, note.created_by, note.created_at]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery)
    );
  }, [project?.notes, searchQuery]);

  const filteredMeetings = useMemo(() => {
    const meetings = project?.meetings || [];
    if (!searchQuery) return meetings;
    return meetings.filter((meeting) =>
      [
        meeting.title,
        meeting.participants,
        meeting.meeting_type,
        meeting.meeting_link,
        meeting.location,
        meeting.start_datetime,
        meeting.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery)
    );
  }, [project?.meetings, searchQuery]);

  const handleUpdateAttendance = async (
    meetingId: string | number,
    participantId: string | number,
    attendanceStatus: "Pending" | "Attended" | "Not Attended"
  ) => {
    try {
      setAttendanceLoadingId(`${meetingId}-${participantId}`);
      await apiRequest(`/projectdesk/meetings/${meetingId}/attendance/`, {
        method: "PATCH",
        body: JSON.stringify({
          participant_id: Number(participantId),
          attendance_status: attendanceStatus,
        }),
      });
      await fetchProject();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update meeting attendance.");
    } finally {
      setAttendanceLoadingId(null);
    }
  };

  const handleCreateNote = async () => {
    if (!id) return;
    if (!newNote.trim()) {
      setNoteError("Note content is required.");
      return;
    }

    try {
      setNoteSaving(true);
      setNoteError(null);
      await apiRequest(`/projects/${id}/notes/`, {
        method: "POST",
        body: JSON.stringify({
          content: newNote.trim(),
          created_by: getCurrentUserEmail(),
        }),
      });
      setNewNote("");
      await fetchProject();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to create note.");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleStartEditNote = (noteId: string | number, content: string) => {
    setEditingNoteId(noteId);
    setEditingNoteContent(content);
    setNoteError(null);
  };

  const handleSaveEditedNote = async (noteId: string | number) => {
    if (!id) return;
    if (!editingNoteContent.trim()) {
      setNoteError("Note content is required.");
      return;
    }

    try {
      setNoteActionLoading(noteId);
      setNoteError(null);
      await apiRequest(`/projects/${id}/notes/${noteId}/`, {
        method: "PATCH",
        body: JSON.stringify({ content: editingNoteContent.trim() }),
      });
      setEditingNoteId(null);
      setEditingNoteContent("");
      await fetchProject();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to update note.");
    } finally {
      setNoteActionLoading(null);
    }
  };

  const handleDeleteNote = async (noteId: string | number) => {
    if (!id) return;
    if (!confirm("Delete this note?")) return;

    try {
      setNoteActionLoading(noteId);
      setNoteError(null);
      await apiRequest(`/projects/${id}/notes/${noteId}/`, {
        method: "DELETE",
      });
      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setEditingNoteContent("");
      }
      await fetchProject();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to delete note.");
    } finally {
      setNoteActionLoading(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="text-sm text-slate-500">Loading project...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-slate-900">
              {error || "Project not found"}
            </h2>
            <Link to="/projects" className="mt-3 inline-block text-green-600 hover:text-green-700">
              Back to Projects
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 px-6 py-6">
        <div className="mb-4">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {project.project_code || "—"}
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">{project.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                {project.description || "No description available."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ProjectStatusBadge status={project.status} />
              <ProjectPriorityBadge priority={project.priority} />
              <Link
                to={`/projects/${project.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <InfoCard label="Assigned Manager" value={project.owner} />
            <InfoCard label="Start Date" value={project.start_date ?? ""} icon={<CalendarDays className="h-4 w-4" />} />
            <InfoCard label="Due Date" value={project.due_date ?? ""} icon={<CalendarDays className="h-4 w-4" />} />
            <InfoCard label="Account" value={project.account_name ?? ""} />
            <InfoCard label="Contact" value={project.contact_name ?? ""} />
            <InfoCard label="Deal" value={project.deal_name ?? ""} />
          </div>

          {project.source_module && project.source_record_id ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-green-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Linked Source</div>
              <div className="mt-1">
                {formatSourceModuleLabel(project.source_module)} #{project.source_record_id}
                {project.source_record_label ? ` - ${project.source_record_label}` : ""}
              </div>
              {getSourceRoute(project) ? (
                <Link to={getSourceRoute(project)!} className="mt-2 inline-flex text-sm font-medium text-green-700 hover:underline">
                  Open source record
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
            <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</TabButton>
            <TabButton active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")}>Tasks</TabButton>
            <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>Files</TabButton>
            <TabButton active={activeTab === "notes"} onClick={() => setActiveTab("notes")}>Notes</TabButton>
            <TabButton active={activeTab === "meetings"} onClick={() => setActiveTab("meetings")}>Meeting</TabButton>
          </div>

          {activeTab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <OverviewCard
                title="Tasks Summary"
                icon={<FolderKanban className="h-5 w-5 text-green-600" />}
                items={[
                  `Total Tasks: ${project.tasks?.length ?? 0}`,
                  `Completed: ${completedTasks}`,
                  `Pending: ${(project.tasks?.length ?? 0) - completedTasks}`,
                ]}
              />
              <OverviewCard
                title="Files & Notes"
                icon={<FileText className="h-5 w-5 text-sky-600" />}
                items={[
                  `Files: ${project.files?.length ?? 0}`,
                  `Notes: ${project.notes?.length ?? 0}`,
                  `Meetings: ${project.meetings?.length ?? 0}`,
                ]}
              />
            </div>
          )}

          {activeTab === "tasks" && (
            <EditableTasksTable
              projectId={id!}
              projectName={project.name}
              tasks={filteredTasks}
              onRefresh={fetchProject}
            />
          )}

          {activeTab === "files" && (
            <div className="space-y-3">
              {filteredFiles.length === 0 ? (
                <EmptyState />
              ) : (
                filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{file.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {file.type} • {file.uploaded_by} • {file.uploaded_at}
                      </p>
                    </div>
                    {file.file_url && (
                      <a
                        href={file.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-green-600 hover:text-green-700"
                      >
                        Open
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Add Note</label>
                    <textarea
                      value={newNote}
                      onChange={(event) => setNewNote(event.target.value)}
                      rows={4}
                      placeholder="Write your project note here"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-green-500 focus:ring-1 focus:ring-blue-200"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      Created by: {getCurrentUserEmail() || "Current user"}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCreateNote()}
                      disabled={noteSaving}
                      className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {noteSaving ? "Saving..." : "Add Note"}
                    </button>
                  </div>

                </div>
              </div>

              {noteError ? (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {noteError}
                </div>
              ) : null}

              {filteredNotes.length === 0 ? (
                <EmptyState />
              ) : (
                filteredNotes.map((note) => (
                  <div key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    {editingNoteId === note.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editingNoteContent}
                          onChange={(event) => setEditingNoteContent(event.target.value)}
                          rows={4}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-green-500 focus:ring-1 focus:ring-blue-200"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-slate-500">
                            {note.created_by} • {note.created_at}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveEditedNote(note.id)}
                              disabled={noteActionLoading === note.id}
                              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                            >
                              {noteActionLoading === note.id ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(null);
                                setEditingNoteContent("");
                                setNoteError(null);
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm leading-6 text-slate-700">{note.content}</p>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-slate-500">
                            {note.created_by} • {note.created_at}
                          </div>
                          {note.created_by === getCurrentUserEmail() ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditNote(note.id, note.content)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteNote(note.id)}
                                disabled={noteActionLoading === note.id}
                                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {noteActionLoading === note.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "meetings" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-600">
                  {filteredMeetings.length} meeting{filteredMeetings.length === 1 ? "" : "s"}
                </p>
                <Link
                  to={`/projectdesk/meetings/create?project=${project.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Schedule Meeting
                </Link>
              </div>

              {filteredMeetings.length === 0 ? (
                <EmptyState />
              ) : (
                filteredMeetings.map((meeting) => (
                  <div key={meeting.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-base font-semibold text-slate-900">{meeting.title}</p>
                        <div className="space-y-1 text-sm text-slate-600">
                          <p>Date & Time: {meeting.start_datetime || "—"}</p>
                          <p>Participants: {meeting.participants || "—"}</p>
                          <p>Meeting Type: {meeting.meeting_type || "—"}</p>
                          {meeting.meeting_type === "Online" ? (
                            <p>Meeting Link: {meeting.meeting_link || "—"}</p>
                          ) : (
                            <p>Location: {meeting.location || "—"}</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {meeting.status}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Attendance</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Attended: {meeting.attended_count} • Not Attended: {meeting.not_attended_count} • Pending: {meeting.pending_count}
                          </p>
                        </div>
                      </div>

                      {(meeting.attendance_records || []).length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">No attendance records yet.</p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {meeting.attendance_records.map((participant) => (
                            <MeetingAttendanceRow
                              key={participant.id}
                              meeting={meeting}
                              participant={participant}
                              currentUserEmail={currentUser.email}
                              currentUserName={currentUser.name}
                              canManage={canManageMeetingAttendance}
                              loading={attendanceLoadingId === `${meeting.id}-${participant.id}`}
                              onUpdate={handleUpdateAttendance}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-800">{value || "—"}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? "bg-green-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function OverviewCard({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <p key={item} className="text-sm text-slate-600">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function MeetingAttendanceRow({
  meeting,
  participant,
  currentUserEmail,
  currentUserName,
  canManage,
  loading,
  onUpdate,
}: {
  meeting: ProjectMeeting;
  participant: ProjectMeetingAttendanceRecord;
  currentUserEmail: string;
  currentUserName: string;
  canManage: boolean;
  loading: boolean;
  onUpdate: (
    meetingId: string | number,
    participantId: string | number,
    attendanceStatus: "Pending" | "Attended" | "Not Attended"
  ) => Promise<void>;
}) {
  const belongsToCurrentUser =
    participant.participant_email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase() ||
    participant.participant_name.trim().toLowerCase() === currentUserName.trim().toLowerCase();

  const canEdit = canManage || belongsToCurrentUser;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{participant.participant_name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {participant.participant_email || "No email"} • {participant.marked_at || "Not marked yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AttendanceBadge status={participant.attendance_status} />
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={() => void onUpdate(meeting.id, participant.id, "Attended")}
                disabled={loading}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
              >
                Attended
              </button>
              <button
                type="button"
                onClick={() => void onUpdate(meeting.id, participant.id, "Not Attended")}
                disabled={loading}
                className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                Not Attended
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AttendanceBadge({
  status,
}: {
  status: "Pending" | "Attended" | "Not Attended";
}) {
  const styles: Record<string, string> = {
    Pending: "bg-amber-50 text-amber-700 border border-amber-200",
    Attended: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    "Not Attended": "bg-rose-50 text-rose-700 border border-rose-200",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status] || "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

function EmptyState() {
  return <div className="py-16 text-center text-sm text-slate-500">No records available.</div>;
}

// ── Editable Tasks Table ──────────────────────────────────────────────────────

const TASK_STATUSES: ProjectTaskStatus[] = ["Not Started", "In Progress", "On Hold", "Completed"];
const TASK_PRIORITIES: ProjectPriority[] = ["Low", "Medium", "High"];

type TaskRow = Omit<ProjectTask, "id"> & { id?: string | number };

// ── Task Detail / Edit Modal ──────────────────────────────────────────────────

function TaskModal({
  task,
  projectName,
  onClose,
  onRefresh,
}: {
  task: ProjectTask;
  projectName: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<TaskRow>({ ...task });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-blue-200";

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await apiRequest(`/projectdesk/tasks/${task.id}/`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      await onRefresh();
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this task?")) return;
    try {
      await apiRequest(`/projectdesk/tasks/${task.id}/`, { method: "DELETE" });
      await onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const statusColors: Record<ProjectTaskStatus, string> = {
    Completed: "bg-emerald-100 text-emerald-700",
    "In Progress": "bg-green-100 text-green-700",
    "On Hold": "bg-amber-100 text-amber-700",
    "Not Started": "bg-slate-100 text-slate-600",
  };

  const priorityColors: Record<ProjectPriority, string> = {
    Critical: "bg-red-100 text-red-700",
    High: "bg-orange-100 text-orange-700",
    Medium: "bg-sky-100 text-sky-700",
    Low: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {isEditing ? "Edit Task" : "Task Details"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          {isEditing ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Project</label>
                  <input className={`${inputCls} bg-slate-50`} value={projectName} readOnly />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Task Title *</label>
                  <input
                    className={inputCls}
                    value={form.title}
                    onChange={(e) => setForm((previous) => ({ ...previous, title: e.target.value }))}
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Description</label>
                <textarea
                  className={`${inputCls} min-h-[110px] resize-none`}
                  value={form.description ?? ""}
                  onChange={(e) => setForm((previous) => ({ ...previous, description: e.target.value }))}
                  placeholder="Enter task description"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Assign To</label>
                  <input
                    className={inputCls}
                    value={form.owner ?? ""}
                    onChange={(e) => setForm((previous) => ({ ...previous, owner: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Assigned By</label>
                  <input
                    className={inputCls}
                    value={form.assigned_by ?? ""}
                    onChange={(e) => setForm((previous) => ({ ...previous, assigned_by: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Due Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.due_date ?? ""}
                    onChange={(e) => setForm((previous) => ({ ...previous, due_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Priority</label>
                  <select
                    className={inputCls}
                    value={form.priority}
                    onChange={(e) => setForm((previous) => ({ ...previous, priority: e.target.value as ProjectPriority }))}
                  >
                    {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
                  <select
                    className={inputCls}
                    value={form.status}
                    onChange={(e) => setForm((previous) => ({ ...previous, status: e.target.value as ProjectTaskStatus }))}
                  >
                    {TASK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Project</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{projectName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Task Title</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{task.title || "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Description</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{task.description || "-"}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Assign To</p>
                  <p className="mt-1 text-sm text-slate-700">{task.owner || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Assigned By</p>
                  <p className="mt-1 text-sm text-slate-700">{task.assigned_by || "-"}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Due Date</p>
                  <p className="mt-1 text-sm text-slate-700">{task.due_date || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Priority</p>
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityColors[task.priority] ?? "bg-slate-100 text-slate-600"}`}>
                    {task.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[task.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {task.status}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setForm({ ...task });
                    setError(null);
                  }}
                  className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  <Check className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableTasksTable({
  projectId,
  projectName,
  tasks,
  onRefresh,
}: {
  projectId: string;
  projectName: string;
  tasks: ProjectTask[];
  onRefresh: () => Promise<void>;
}) {
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [form, setForm] = useState<TaskRow>({
    title: "",
    description: "",
    owner: "",
    assigned_by: getCurrentUserEmail(),
    due_date: "",
    status: "Not Started",
    priority: "Medium",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAdd = () => {
    setAddingNew(true);
    setForm({
      title: "",
      description: "",
      owner: "",
      assigned_by: getCurrentUserEmail(),
      due_date: "",
      status: "Not Started",
      priority: "Medium",
    });
    setError(null);
  };

  const cancelAdd = () => {
    setAddingNew(false);
    setError(null);
  };

  const handleAddSave = async () => {
    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await apiRequest("/projectdesk/tasks/", {
        method: "POST",
        body: JSON.stringify({ ...form, project: Number(projectId) }),
      });
      setAddingNew(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (taskId: string | number, status: ProjectTaskStatus) => {
    try {
      await apiRequest(`/projectdesk/tasks/${taskId}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    }
  };

  const inputCls = "w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500";

  return (
    <div>
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          projectName={projectName}
          onClose={() => setSelectedTask(null)}
          onRefresh={async () => {
            setSelectedTask(null);
            await onRefresh();
          }}
        />
      )}

      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
        <button
          onClick={startAdd}
          disabled={addingNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {addingNew && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Project</label>
              <input className={`${inputCls} bg-white`} value={projectName} readOnly />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Task Title *</label>
              <input
                className={`${inputCls} bg-white`}
                value={form.title}
                onChange={(e) => setForm((previous) => ({ ...previous, title: e.target.value }))}
                placeholder="Enter task title"
                autoFocus
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Description</label>
              <textarea
                className={`${inputCls} min-h-[110px] resize-none bg-white`}
                value={form.description ?? ""}
                onChange={(e) => setForm((previous) => ({ ...previous, description: e.target.value }))}
                placeholder="Enter task description"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Assign To</label>
              <input
                className={`${inputCls} bg-white`}
                value={form.owner ?? ""}
                onChange={(e) => setForm((previous) => ({ ...previous, owner: e.target.value }))}
                placeholder="Enter assignee"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Assigned By</label>
              <input
                className={`${inputCls} bg-white`}
                value={form.assigned_by ?? ""}
                onChange={(e) => setForm((previous) => ({ ...previous, assigned_by: e.target.value }))}
                placeholder="Enter assigner"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Due Date</label>
              <input
                type="date"
                className={`${inputCls} bg-white`}
                value={form.due_date ?? ""}
                onChange={(e) => setForm((previous) => ({ ...previous, due_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Priority</label>
              <select
                className={`${inputCls} bg-white`}
                value={form.priority}
                onChange={(e) => setForm((previous) => ({ ...previous, priority: e.target.value as ProjectPriority }))}
              >
                {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
              <select
                className={`${inputCls} bg-white`}
                value={form.status}
                onChange={(e) => setForm((previous) => ({ ...previous, status: e.target.value as ProjectTaskStatus }))}
              >
                {TASK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={cancelAdd}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleAddSave()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? "Saving..." : "Save Task"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Task Title</th>
              <th className="px-4 py-3">Assign To</th>
              <th className="px-4 py-3">Assigned By</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3 w-16">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.length === 0 && !addingNew && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No tasks yet. Click "Add Task" to create one.</td></tr>
            )}

            {tasks.map((task) => (
              <tr
                key={task.id}
                className="cursor-pointer hover:bg-slate-50 transition"
                onClick={() => setSelectedTask(task)}
              >
                <td className="px-4 py-3 font-medium text-slate-800">{task.title || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{task.owner || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{task.assigned_by || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{task.due_date || "-"}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={task.status}
                    onChange={(e) => void handleStatusChange(task.id, e.target.value as ProjectTaskStatus)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border-0 outline-none cursor-pointer ${
                      task.status === "Completed" ? "bg-emerald-100 text-emerald-700"
                      : task.status === "In Progress" ? "bg-green-100 text-green-700"
                      : task.status === "On Hold" ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {TASK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    task.priority === "Critical" ? "bg-red-100 text-red-700"
                    : task.priority === "High" ? "bg-orange-100 text-orange-700"
                    : task.priority === "Medium" ? "bg-sky-100 text-sky-700"
                    : "bg-slate-100 text-slate-600"
                  }`}>{task.priority}</span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-green-600"
                    title="View / Edit"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
