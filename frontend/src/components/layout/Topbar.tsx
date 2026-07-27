import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  Menu,
  User,
  X,
  Mail,
  Shield,
  LogOut,
  Building2,
  UserCog,
  Briefcase,
  Clock,
  Loader2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";

type TopbarProps = {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

type LoggedInUser = {
  name?: string;
  full_name?: string;
  firstName?: string;
  first_name?: string;
  username?: string;
  email?: string;
  role?: string;
  id?: string | number;
  is_admin?: boolean;
  allowed_modules?: string[];
};

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

type ProjectDeskTask = {
  id: number | string;
  project_id?: number | string;
  title?: string;
  owner?: string | null;
  due_date?: string | null;
  status?: string | null;
  priority?: string | null;
};

type ProjectDeskMeeting = {
  id: number | string;
  project_id?: number | string;
  title?: string;
  participants?: string | null;
  meeting_type?: string | null;
  start_datetime?: string | null;
  status?: string | null;
  attendance_records?: Array<{
    id: number | string;
    participant_name?: string | null;
    participant_email?: string | null;
    attendance_status?: string | null;
  }>;
  attended_count?: number;
  not_attended_count?: number;
  pending_count?: number;
};

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  dateLabel: string;
  route: string;
  category: "task" | "meeting" | "email";
  sortTs?: number;
};

type UnreadEmailSummary = {
  unread_count: number;
  recent: { id: number; subject: string; from_email: string; received_at: string }[];
};

type FullUserDetail = {
  id: number;
  email: string;
  name?: string;
  role: string;
  role_display?: string;
  department?: string;
  department_display?: string;
  status?: string;
  status_display?: string;
  is_active: boolean;
  must_change_password?: boolean;
  manager_email?: string | null;
  created_at?: string;
};

const ORGANIZATION_LABEL = "SSH Connect";

function getEmailHandle(email?: string | null) {
  const value = (email || "").trim();
  if (!value) return "";
  return value.split("@")[0]?.trim() || "";
}

function getRoleLabel(role?: string | null) {
  const normalized = (role || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    admin: "Admin",
    sub_admin: "Sub Admin",
    hr: "HR",
    manager: "Manager",
    team_lead: "Team Lead",
    business_development: "Business Development",
    software_development: "Software Development",
    support_team: "Support Team",
    employee: "Employee",
  };
  return labels[normalized] || "-";
}

function isAdminRole(role?: string | null) {
  return (role || "").trim().toLowerCase() === "admin";
}

function extractList<T>(res: ApiList<T>): T[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.results)) return res.results;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

function toTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === toTodayKey();
}

function formatNotificationDate(value?: string | null) {
  if (!value) return "Today";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAttendanceSummary(meeting: ProjectDeskMeeting) {
  const records = meeting.attendance_records || [];
  const attendedNames = records
    .filter((record) => record.attendance_status === "Attended")
    .map((record) => record.participant_name || record.participant_email || "User");
  const notAttendedNames = records
    .filter((record) => record.attendance_status === "Not Attended")
    .map((record) => record.participant_name || record.participant_email || "User");
  const pendingCount =
    typeof meeting.pending_count === "number"
      ? meeting.pending_count
      : records.filter((record) => record.attendance_status === "Pending").length;

  const parts: string[] = [];
  if (attendedNames.length > 0) parts.push(`Attended: ${attendedNames.join(", ")}`);
  if (notAttendedNames.length > 0) parts.push(`Not Attended: ${notAttendedNames.join(", ")}`);
  if (pendingCount > 0) parts.push(`Pending: ${pendingCount}`);
  return parts.join(" | ") || "Attendance pending";
}

const getPageTitle = (pathname: string) => {
  if (pathname === "/home") return "Home";
  if (pathname === "/calendar") return "Calendar";
  if (pathname === "/team" || pathname.startsWith("/team/")) return "My Team";
  if (pathname === "/leads" || pathname.startsWith("/leads/")) return "Leads";
  if (pathname === "/contacts" || pathname.startsWith("/contacts/")) return "Contacts";
  if (pathname === "/accounts" || pathname.startsWith("/accounts/")) return "Accounts";
  if (pathname === "/deals" || pathname.startsWith("/deals/")) return "Deals";
  if (pathname === "/campaigns" || pathname.startsWith("/campaigns/")) return "Campaigns";
  if (pathname === "/support/cases" || pathname.startsWith("/support/cases/")) return "Cases";
  if (pathname === "/support/solutions" || pathname.startsWith("/support/solutions/")) return "Solutions";
  if (pathname === "/services/business-hours" || pathname.startsWith("/services/business-hours/")) return "Business Hours";
  if (pathname === "/services/catalog" || pathname.startsWith("/services/catalog/")) return "Services Catalog";
  if (pathname === "/services/appointments" || pathname.startsWith("/services/appointments/")) return "Appointments";
  if (pathname === "/services/job-sheets" || pathname.startsWith("/services/job-sheets/")) return "Job Sheets";
  if (pathname === "/services/settings/company-details") return "Company Details";
  if (pathname === "/services/settings/domain-mapping") return "Domain Mapping";
  if (pathname === "/services/settings/fiscal-year") return "Fiscal Year";
  if (pathname === "/services/settings/holidays") return "Holidays";
  if (pathname === "/products" || pathname.startsWith("/products/")) return "Products";
  if (pathname === "/price-books" || pathname.startsWith("/price-books/")) return "Price Books";
  if (pathname === "/quotes" || pathname.startsWith("/quotes/")) return "Quotes";
  if (pathname === "/sales-orders" || pathname.startsWith("/sales-orders/")) return "Sales Orders";
  if (pathname === "/purchase-orders" || pathname.startsWith("/purchase-orders/")) return "Purchase Orders";
  if (pathname === "/invoices" || pathname.startsWith("/invoices/")) return "Invoices";
  if (pathname === "/vendors" || pathname.startsWith("/vendors/")) return "Vendors";
  if (pathname === "/reports") return "Reports";
  if (pathname === "/analytics") return "Analytics";
  if (pathname === "/my-requests") return "My Requests";
  return "";
};

export default function Topbar({
  sidebarOpen,
  setSidebarOpen,
}: TopbarProps) {
  const { canAccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = getPageTitle(location.pathname);
  const canViewActivities = canAccess("activities");
  const canViewProjects = canAccess("projects");

  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [emailInboxOpen, setEmailInboxOpen] = useState(false);
  const [unreadEmailCount, setUnreadEmailCount] = useState(0);
  const [recentUnreadEmails, setRecentUnreadEmails] = useState<{ id: number; subject: string; from_email: string; received_at: string }[]>([]);
  const [user, setUser] = useState<LoggedInUser>({});
  const [fullUser, setFullUser] = useState<FullUserDetail | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem("loggedInUser");
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error("Failed to parse logged in user:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!profileOpen || fullUser) return;
    setLoadingFull(true);
    apiRequest<FullUserDetail>("/auth/manage-users/me/")
      .then((data) => setFullUser(data))
      .catch(() => {})
      .finally(() => setLoadingFull(false));
  }, [profileOpen, fullUser]);

  const preferredHandle =
    getEmailHandle(fullUser?.email) ||
    user.username ||
    getEmailHandle(user.email);

  const displayName =
    preferredHandle ||
    fullUser?.name ||
    user.name ||
    user.full_name ||
    user.firstName ||
    user.first_name ||
    user.email ||
    "User";

  const displayEmail = fullUser?.email || user.email || "No email";
  const allowedEmailDomains = useMemo(() => {
    const domain = (displayEmail.includes("@") ? displayEmail.split("@")[1] : "").toLowerCase();
    const domains = domain ? [`@${domain}`] : [];
    return [...domains, ...STATIC_ALLOWED_EMAIL_DOMAINS];
  }, [displayEmail]);
  const activeRole = fullUser?.role || user.role;
  const canManageProjectAttendance = ["admin", "sub_admin", "manager"].includes(
    (activeRole || "").trim().toLowerCase()
  );
  const showDepartment = !isAdminRole(activeRole);
  const currentUserKeys = useMemo(
    () =>
      [displayEmail, fullUser?.name, user.name, user.full_name, user.firstName, user.first_name]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase()),
    [displayEmail, fullUser?.name, user.firstName, user.first_name, user.full_name, user.name]
  );
  const notificationStorageKey = useMemo(
    () => `today-notifications:${displayEmail || "user"}:${toTodayKey()}`,
    [displayEmail]
  );
  const dismissedNotificationStorageKey = `${notificationStorageKey}:dismissed`;
  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(notificationStorageKey);
      setReadNotificationIds(raw ? JSON.parse(raw) as string[] : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(dismissedNotificationStorageKey);
      setDismissedNotificationIds(raw ? JSON.parse(raw) as string[] : []);
    } catch {
      setDismissedNotificationIds([]);
    }
  }, [dismissedNotificationStorageKey]);

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      if (!notificationsOpen) return;
      setNotificationsLoading(true);
      try {
        const [tasksRes, meetingsRes, projectTasksRes, projectMeetingsRes, unreadEmailsRes] = await Promise.allSettled([
          canViewActivities
            ? apiRequest<ApiList<ActivityTask>>("/tasks/", { query: { page_size: 25 }, cacheTtlMs: 60 * 1000 })
            : Promise.resolve([] as ActivityTask[]),
          canViewActivities
            ? apiRequest<ApiList<ActivityMeeting>>("/meetings/", { query: { page_size: 25 }, cacheTtlMs: 60 * 1000 })
            : Promise.resolve([] as ActivityMeeting[]),
          canViewProjects
            ? apiRequest<ApiList<ProjectDeskTask>>("/projectdesk/tasks/", { query: { page_size: 25 }, cacheTtlMs: 60 * 1000 })
            : Promise.resolve([] as ProjectDeskTask[]),
          canViewProjects
            ? apiRequest<ApiList<ProjectDeskMeeting>>("/projectdesk/meetings/", { query: { page_size: 25 }, cacheTtlMs: 60 * 1000 })
            : Promise.resolve([] as ProjectDeskMeeting[]),
          apiRequest<UnreadEmailSummary>("/email/unread-count/", { cacheTtlMs: 30 * 1000 }),
        ]);

        if (!active) return;

        const nextNotifications: NotificationItem[] = [];

        if (tasksRes.status === "fulfilled") {
          extractList(tasksRes.value)
            .filter((task) => isSameDay(task.due_date))
            .forEach((task) => {
              nextNotifications.push({
                id: `task-${task.id}`,
                title: task.subject || "Task",
                description: `Task due today • ${task.status || "No status"}`,
                dateLabel: formatNotificationDate(task.due_date),
                route: `/tasks/${task.id}`,
                category: "task",
                sortTs: new Date(task.due_date || "").getTime() || 0,
              });
            });
        }

        if (meetingsRes.status === "fulfilled") {
          extractList(meetingsRes.value)
            .filter((meeting) => isSameDay(meeting.start_datetime || meeting.from_datetime))
            .forEach((meeting) => {
              nextNotifications.push({
                id: `meeting-${meeting.id}`,
                title: meeting.title || meeting.subject || "Meeting",
                description: "Meeting scheduled for today",
                dateLabel: formatNotificationDate(meeting.start_datetime || meeting.from_datetime),
                route: `/meetings/${meeting.id}`,
                category: "meeting",
                sortTs: new Date(meeting.start_datetime || meeting.from_datetime || "").getTime() || 0,
              });
            });
        }

        if (projectTasksRes.status === "fulfilled") {
          extractList(projectTasksRes.value)
            .filter((task) => isSameDay(task.due_date))
            .filter((task) => currentUserKeys.some((key) => (task.owner || "").toLowerCase().includes(key)))
            .forEach((task) => {
              nextNotifications.push({
                id: `project-task-${task.id}`,
                title: task.title || "Project Task",
                description: `Project task due today • ${task.status || "No status"}`,
                dateLabel: formatNotificationDate(task.due_date),
                route: `/projects/${task.project_id}?tab=tasks`,
                category: "task",
                sortTs: new Date(task.due_date || "").getTime() || 0,
              });
            });
        }

        if (projectMeetingsRes.status === "fulfilled") {
          extractList(projectMeetingsRes.value)
            .filter((meeting) => isSameDay(meeting.start_datetime))
            .filter((meeting) =>
              canManageProjectAttendance
                ? true
                : currentUserKeys.some((key) => (meeting.participants || "").toLowerCase().includes(key))
            )
            .forEach((meeting) => {
              nextNotifications.push({
                id: `project-meeting-${meeting.id}`,
                title: meeting.title || "Project Meeting",
                description: canManageProjectAttendance
                  ? getAttendanceSummary(meeting)
                  : `Project meeting today - ${meeting.meeting_type || "Meeting"}`,
                dateLabel: formatNotificationDate(meeting.start_datetime),
                route: `/projects/${meeting.project_id}?tab=meetings`,
                category: "meeting",
                sortTs: new Date(meeting.start_datetime || "").getTime() || 0,
              });
            });
        }

        if (unreadEmailsRes.status === "fulfilled") {
          (unreadEmailsRes.value.recent || [])
            .filter((email) => isRelevantEmailAddress(email.from_email, allowedEmailDomains))
            .filter((email) => isSameDay(email.received_at))
            .forEach((email) => {
              nextNotifications.push({
                id: `email-${email.id}`,
                title: email.subject || "(No subject)",
                description: `Email received from ${email.from_email || "Unknown sender"}`,
                dateLabel: formatNotificationDate(email.received_at),
                route: `/email/${email.id}`,
                category: "email",
                sortTs: new Date(email.received_at || "").getTime() || 0,
              });
            });
        }

        nextNotifications.sort((left, right) => (right.sortTs || 0) - (left.sortTs || 0));
        setNotifications(nextNotifications.filter((item) => !dismissedNotificationIds.includes(item.id)));
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };

    void loadNotifications();
    return () => {
      active = false;
    };
  }, [
    canManageProjectAttendance,
    canViewActivities,
    canViewProjects,
    allowedEmailDomains,
    currentUserKeys,
    dismissedNotificationIds,
    notificationsOpen,
  ]);

  useEffect(() => {
    const fetchUnread = () => {
      if (!localStorage.getItem("accessToken")) {
        setUnreadEmailCount(0);
        setRecentUnreadEmails([]);
        return;
      }

      apiRequest<{ unread_count: number; recent: { id: number; subject: string; from_email: string; received_at: string }[] }>(
        "/email/unread-count/"
      )
        .then((data) => {
          const filtered = (data.recent ?? []).filter((email) => isRelevantEmailAddress(email.from_email, allowedEmailDomains));
          setUnreadEmailCount(filtered.length);
          setRecentUnreadEmails(filtered);
        })
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, [allowedEmailDomains]);

  const handleLogout = () => {
    // Clear all auth keys and fire the logout event so RequireAuth updates
    ["accessToken", "refreshToken", "loggedInUser", "isLoggedIn"].forEach(
      (key) => localStorage.removeItem(key)
    );
    window.dispatchEvent(new CustomEvent("auth:logout"));
    navigate("/login");
  };

  const handleNotificationClick = (item: NotificationItem) => {
    const nextReadIds = Array.from(new Set([...readNotificationIds, item.id]));
    setReadNotificationIds(nextReadIds);
    localStorage.setItem(notificationStorageKey, JSON.stringify(nextReadIds));

    if (item.category === "email") {
      const emailId = item.id.replace(/^email-/, "");
      if (emailId) {
        void apiRequest(`/email/${emailId}/`, {
          method: "PATCH",
          body: JSON.stringify({ is_read: true }),
        }).catch(() => {});
      }
      setUnreadEmailCount((count) => Math.max(0, count - 1));
      setRecentUnreadEmails((prev) => prev.filter((email) => String(email.id) !== emailId));
    }

    setNotificationsOpen(false);
    navigate(item.route);
  };

  const handleClearNotifications = () => {
    const idsToClear = notifications.map((item) => item.id);
    const nextDismissedIds = Array.from(new Set([...dismissedNotificationIds, ...idsToClear]));
    const nextReadIds = Array.from(new Set([...readNotificationIds, ...idsToClear]));

    setDismissedNotificationIds(nextDismissedIds);
    setReadNotificationIds(nextReadIds);
    localStorage.setItem(dismissedNotificationStorageKey, JSON.stringify(nextDismissedIds));
    localStorage.setItem(notificationStorageKey, JSON.stringify(nextReadIds));
    setNotifications([]);
    setNotificationsOpen(false);
  };

  return (
    <>
      <header className="flex h-[62px] items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="mr-3 flex h-[36px] w-[36px] items-center justify-center rounded-md hover:bg-slate-100 md:hidden"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <Menu size={18} />
          </button>

          <h1 className="truncate text-[18px] font-medium text-slate-800">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="relative">
            <button
              onClick={() => { setNotificationsOpen((prev) => !prev); setEmailInboxOpen(false); }}
              className="relative flex h-[32px] w-[32px] items-center justify-center rounded-md hover:bg-slate-100"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-10 z-50 w-[340px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Today's Notifications</p>
                    <p className="text-xs text-slate-500">{notifications.length} item(s) today</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearNotifications}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Clear today's notifications"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="max-h-[360px] overflow-y-auto p-2">
                  {notificationsLoading ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-slate-500">
                      <Loader2 size={16} className="animate-spin" />
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-slate-500">
                      No notifications for today.
                    </div>
                  ) : (
                    notifications.map((item, index) => {
                      const isRead = readNotificationIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNotificationClick(item)}
                          className={`mb-2 flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${
                            isRead
                              ? "border-slate-100 bg-slate-50 text-slate-500"
                              : "border-green-100 bg-green-50/70 text-slate-800 hover:bg-green-50"
                          }`}
                        >
                          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                            isRead ? "bg-slate-200 text-slate-500" : "bg-green-600 text-white"
                          }`}>
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold">{item.title}</p>
                              {!isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />}
                            </div>
                            <p className="mt-1 text-xs">{item.description}</p>
                            <p className="mt-1 text-[11px] text-slate-400">{item.dateLabel}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => { setEmailInboxOpen((prev) => !prev); setNotificationsOpen(false); }}
              className="relative flex h-[32px] w-[32px] items-center justify-center rounded-md hover:bg-slate-100"
            >
              <Mail size={16} />
              {unreadEmailCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                  {unreadEmailCount > 99 ? "99+" : unreadEmailCount}
                </span>
              )}
            </button>

            {emailInboxOpen && (
              <div className="absolute right-0 top-10 z-50 w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Unread Emails</p>
                    <p className="text-xs text-slate-500">{unreadEmailCount} unread message{unreadEmailCount !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadEmailCount > 0 && (
                      <button
                        type="button"
                        title="Mark all as read"
                        onClick={() => {
                          void apiRequest("/email/mark-all-read/", { method: "POST" }).catch(() => {});
                          setUnreadEmailCount(0);
                          setRecentUnreadEmails([]);
                        }}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-green-600 hover:bg-green-50"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEmailInboxOpen(false)}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="max-h-[360px] overflow-y-auto p-2">
                  {recentUnreadEmails.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-slate-500">
                      No unread emails.
                    </div>
                  ) : (
                    recentUnreadEmails.map((email) => (
                      <button
                        key={email.id}
                        type="button"
                        onClick={() => {
                          setEmailInboxOpen(false);
                          // mark as read
                          void apiRequest(`/email/${email.id}/`, { method: "PATCH", body: JSON.stringify({ is_read: true }) }).catch(() => {});
                          setUnreadEmailCount((c) => Math.max(0, c - 1));
                          setRecentUnreadEmails((prev) => prev.filter((e) => e.id !== email.id));
                          navigate(`/email/${email.id}`);
                        }}
                        className="mb-2 flex w-full items-start gap-3 rounded-lg border border-green-100 bg-green-50/70 px-3 py-3 text-left transition hover:bg-green-50"
                      >
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                          <Mail size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {email.subject || "(No subject)"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{email.from_email}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {email.received_at
                              ? new Date(email.received_at).toLocaleString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {unreadEmailCount > 0 && (
                  <div className="border-t border-slate-100 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => { setEmailInboxOpen(false); navigate("/email/inbox"); }}
                      className="w-full rounded-md py-1.5 text-center text-xs font-medium text-green-600 hover:bg-green-50"
                    >
                      View all in inbox
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

            <button
              onClick={() => navigate("/calendar")}
              className="flex h-[32px] w-[32px] items-center justify-center rounded-md hover:bg-slate-100"
            >
              <CalendarDays size={16} />
            </button>

            <button
              onClick={() => setProfileOpen(true)}
              className="flex h-[32px] w-[32px] items-center justify-center rounded-md hover:bg-slate-100"
            >
              <User size={16} />
            </button>
        </div>
      </header>

      {profileOpen && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/25"
            onClick={() => setProfileOpen(false)}
          />

          <div className="absolute right-0 top-0 h-full w-full max-w-[360px] bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-800">
                  User Details
                </h2>

                <button
                  onClick={() => setProfileOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {/* Avatar + name */}
                <div className="mb-5 flex items-center gap-4">
                  <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold uppercase ${
                    fullUser?.status === "terminated" ? "bg-red-100 text-red-600"
                    : fullUser?.status === "inactive" ? "bg-slate-100 text-slate-500"
                    : "bg-green-100 text-green-700"
                  }`}>
                    {displayName[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-slate-900">{displayName}</h3>
                    <p className="truncate text-xs text-slate-400">{displayEmail}</p>
                    {fullUser?.status && (
                      <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        fullUser.status === "active" ? "bg-green-100 text-green-700"
                        : fullUser.status === "inactive" ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          fullUser.status === "active" ? "bg-green-500"
                          : fullUser.status === "inactive" ? "bg-amber-500"
                          : "bg-red-500"
                        }`} />
                        {fullUser.status_display || fullUser.status}
                      </span>
                    )}
                  </div>
                </div>

                {loadingFull ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <Loader2 size={20} className="animate-spin mr-2" /> Loading details...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { icon: <Mail size={14} />, label: "Email", value: fullUser?.email || displayEmail },
                      { icon: <Shield size={14} />, label: "Role", value: getRoleLabel(activeRole) },
                      ...(showDepartment
                        ? [{ icon: <Briefcase size={14} />, label: "Department", value: fullUser?.department_display || fullUser?.department || "N/A" }]
                        : []),
                      { icon: <Building2 size={14} />, label: "Organization", value: ORGANIZATION_LABEL },
                      ...(fullUser?.manager_email ? [{ icon: <UserCog size={14} />, label: "Manager", value: fullUser.manager_email }] : []),
                      { icon: <Clock size={14} />, label: "Member Since", value: fullUser?.created_at ? new Date(fullUser.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-" },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                        <span className="mt-0.5 text-slate-400">{icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                          <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 p-4">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


const STATIC_ALLOWED_EMAIL_DOMAINS = [] as string[]; // optional extras: ["@client.com"]
const BLOCKED_EMAIL_SUBSTRINGS = [
  "@facebookmail.com",
  "@dare2compete",
  "@workday.com",
  "@njoyn.com",
  "career postings",
  "job alert",
  "newsletter",
  "no-reply",
  "noreply",
];

function isRelevantEmailAddress(email?: string | null, allowedDomains: string[] = []) {
  if (!email) return false;
  const value = email.trim().toLowerCase();
  if (allowedDomains.length > 0) {
    if (allowedDomains.some((domain) => value.endsWith(domain.toLowerCase()))) {
      return true;
    }
  }
  return !BLOCKED_EMAIL_SUBSTRINGS.some((needle) => value.includes(needle.toLowerCase()));
}
