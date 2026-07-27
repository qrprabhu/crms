import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, CheckSquare, Clock3 } from "lucide-react";
import { apiRequest } from "../api/client";
import { useAuth } from "../hooks/useAuth";

type ApiList<T> = T[] | { results?: T[]; data?: T[] };

type ActivityTask = {
  id: number | string;
  subject?: string;
  due_date?: string | null;
  status?: string | null;
  priority?: string | null;
};

type ActivityMeeting = {
  id: number | string;
  title?: string;
  subject?: string;
  start_datetime?: string | null;
  from_datetime?: string | null;
  end_datetime?: string | null;
  to_datetime?: string | null;
};

type ProjectTask = {
  id: number | string;
  project_id?: number | string;
  title?: string;
  owner?: string | null;
  due_date?: string | null;
  status?: string | null;
  priority?: string | null;
};

type ProjectMeeting = {
  id: number | string;
  project_id?: number | string;
  title?: string;
  start_datetime?: string | null;
  participants?: string | null;
  meeting_type?: string | null;
  status?: string | null;
};

function extractList<T>(res: ApiList<T>): T[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.results)) return res.results;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(value: string | null | undefined, selectedDate: string) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return toInputDate(d) === selectedDate;
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMonthDays(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + last.getDate()) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startOffset + 1;
    if (dayNumber < 1 || dayNumber > last.getDate()) return null;
    return new Date(year, month, dayNumber);
  });
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const { canAccess } = useAuth();
  const canViewActivities = canAccess("activities");
  const canViewProjects = canAccess("projects");

  const [selectedDate, setSelectedDate] = useState(() => toInputDate(new Date()));
  const [viewDate, setViewDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<ActivityTask[]>([]);
  const [meetings, setMeetings] = useState<ActivityMeeting[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [projectMeetings, setProjectMeetings] = useState<ProjectMeeting[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [tasksRes, meetingsRes, projectTasksRes, projectMeetingsRes] = await Promise.allSettled([
          canViewActivities ? apiRequest<ApiList<ActivityTask>>("/tasks/") : Promise.resolve([] as ActivityTask[]),
          canViewActivities ? apiRequest<ApiList<ActivityMeeting>>("/meetings/") : Promise.resolve([] as ActivityMeeting[]),
          canViewProjects ? apiRequest<ApiList<ProjectTask>>("/projectdesk/tasks/") : Promise.resolve([] as ProjectTask[]),
          canViewProjects ? apiRequest<ApiList<ProjectMeeting>>("/projectdesk/meetings/") : Promise.resolve([] as ProjectMeeting[]),
        ]);

        if (!active) return;

        if (tasksRes.status === "fulfilled") setTasks(extractList(tasksRes.value));
        if (meetingsRes.status === "fulfilled") setMeetings(extractList(meetingsRes.value));
        if (projectTasksRes.status === "fulfilled") setProjectTasks(extractList(projectTasksRes.value));
        if (projectMeetingsRes.status === "fulfilled") setProjectMeetings(extractList(projectMeetingsRes.value));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [canViewActivities, canViewProjects]);

  const calendarDays = useMemo(() => buildMonthDays(viewDate), [viewDate]);

  const selectedActivityTasks = useMemo(
    () => tasks.filter((task) => isSameDay(task.due_date, selectedDate)),
    [selectedDate, tasks]
  );
  const selectedActivityMeetings = useMemo(
    () => meetings.filter((meeting) => isSameDay(meeting.start_datetime || meeting.from_datetime, selectedDate)),
    [meetings, selectedDate]
  );
  const selectedProjectTasks = useMemo(
    () => projectTasks.filter((task) => isSameDay(task.due_date, selectedDate)),
    [projectTasks, selectedDate]
  );
  const selectedProjectMeetings = useMemo(
    () => projectMeetings.filter((meeting) => isSameDay(meeting.start_datetime, selectedDate)),
    [projectMeetings, selectedDate]
  );

  const totalItems =
    selectedActivityTasks.length +
    selectedActivityMeetings.length +
    selectedProjectTasks.length +
    selectedProjectMeetings.length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-3xl font-bold text-slate-900">Calendar</h1>
            <p className="mt-1 text-sm text-slate-500">Pick a date to see what you have scheduled on that day.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600">Selected Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setViewDate(new Date(`${e.target.value}T00:00:00`));
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-lg font-semibold text-slate-900">
              {viewDate.toLocaleString("en-GB", { month: "long", year: "numeric" })}
            </h2>
            <button
              type="button"
              onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="h-11 rounded-lg bg-slate-50" />;
              const dayValue = toInputDate(day);
              const isSelected = dayValue === selectedDate;
              const hasItems =
                tasks.some((task) => isSameDay(task.due_date, dayValue)) ||
                meetings.some((meeting) => isSameDay(meeting.start_datetime || meeting.from_datetime, dayValue)) ||
                projectTasks.some((task) => isSameDay(task.due_date, dayValue)) ||
                projectMeetings.some((meeting) => isSameDay(meeting.start_datetime, dayValue));

              return (
                <button
                  key={dayValue}
                  type="button"
                  onClick={() => setSelectedDate(dayValue)}
                  className={`relative h-11 rounded-lg text-sm font-medium transition ${
                    isSelected
                      ? "bg-green-600 text-white"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {day.getDate()}
                  {hasItems && (
                    <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isSelected ? "bg-white" : "bg-green-500"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{totalItems} item(s) scheduled</p>
            </div>
            <CalendarDays className="h-6 w-6 text-blue-500" />
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-500">Loading calendar...</div>
          ) : totalItems === 0 ? (
            <div className="py-16 text-center text-slate-500">Nothing scheduled for this date.</div>
          ) : (
            <div className="space-y-6">
              {selectedActivityTasks.length > 0 && (
                <EventSection title="Activity Tasks" icon={<CheckSquare className="h-4 w-4 text-teal-600" />}>
                  {selectedActivityTasks.map((task) => (
                    <EventCard
                      key={`task-${task.id}`}
                      title={task.subject || "Untitled Task"}
                      subtitle={`Due: ${formatDateTime(task.due_date)}`}
                      meta={`${task.status || "N/A"} • ${task.priority || "N/A"}`}
                    />
                  ))}
                </EventSection>
              )}

              {selectedActivityMeetings.length > 0 && (
                <EventSection title="Activity Meetings" icon={<CalendarDays className="h-4 w-4 text-amber-600" />}>
                  {selectedActivityMeetings.map((meeting) => (
                    <EventCard
                      key={`meeting-${meeting.id}`}
                      title={meeting.title || meeting.subject || "Untitled Meeting"}
                      subtitle={`Starts: ${formatDateTime(meeting.start_datetime || meeting.from_datetime)}`}
                      meta={`Ends: ${formatDateTime(meeting.end_datetime || meeting.to_datetime)}`}
                    />
                  ))}
                </EventSection>
              )}

              {selectedProjectTasks.length > 0 && (
                <EventSection title="Project Tasks" icon={<CheckSquare className="h-4 w-4 text-indigo-600" />}>
                  {selectedProjectTasks.map((task) => (
                    <EventCard
                      key={`project-task-${task.id}`}
                      title={task.title || "Untitled Project Task"}
                      subtitle={`Assign To: ${task.owner || "N/A"}`}
                      meta={`${task.status || "N/A"} • ${task.priority || "N/A"}`}
                    />
                  ))}
                </EventSection>
              )}

              {selectedProjectMeetings.length > 0 && (
                <EventSection title="Project Meetings" icon={<Clock3 className="h-4 w-4 text-cyan-600" />}>
                  {selectedProjectMeetings.map((meeting) => (
                    <EventCard
                      key={`project-meeting-${meeting.id}`}
                      title={meeting.title || "Untitled Project Meeting"}
                      subtitle={`Time: ${formatDateTime(meeting.start_datetime)}`}
                      meta={`${meeting.meeting_type || "N/A"} • ${meeting.status || "N/A"}`}
                    />
                  ))}
                </EventSection>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function EventCard({ title, subtitle, meta }: { title: string; subtitle: string; meta: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <p className="mt-1 text-xs text-slate-500">{meta}</p>
    </div>
  );
}

