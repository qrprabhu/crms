export type ProjectStatus =
  | "Planning"
  | "Active"
  | "On Hold"
  | "Delayed"
  | "Completed"
  | "Cancelled";

export type ProjectPriority = "Low" | "Medium" | "High" | "Critical";

export type ProjectTaskStatus =
  | "Not Started"
  | "In Progress"
  | "On Hold"
  | "Completed";

export type ProjectIssueSeverity = "Low" | "Medium" | "High" | "Critical";

export interface ProjectTask {
  id: string | number;
  title: string;
  description: string;
  owner: string;
  assigned_by: string;
  due_date: string;
  status: ProjectTaskStatus;
  priority: ProjectPriority;
}

export interface ProjectIssue {
  id: string | number;
  title: string;
  severity: ProjectIssueSeverity;
  owner: string;
  status: "Open" | "Resolved" | "Closed";
  due_date: string;
}

export interface ProjectPhase {
  id: string | number;
  name: string;
  status: "Pending" | "In Progress" | "Completed";
  due_date: string;
}

export interface ProjectMember {
  id: string | number;
  name: string;
  role: string;
  email: string;
}

export interface ProjectFile {
  id: string | number;
  name: string;
  type: string;
  uploaded_by: string;
  uploaded_at: string;
  file_url?: string;
}

export interface ProjectNote {
  id: string | number;
  content: string;
  created_by: string;
  created_at: string;
}

export interface ProjectMeetingAttendanceRecord {
  id: string | number;
  participant_name: string;
  participant_email: string;
  attendance_status: "Pending" | "Attended" | "Not Attended";
  marked_at: string | null;
}

export interface ProjectMeeting {
  id: string | number;
  project_id: number;
  title: string;
  participants: string;
  meeting_type: "Online" | "Offline";
  meeting_link: string;
  location: string;
  start_datetime: string;
  status: "Scheduled" | "Completed" | "Cancelled" | "Rescheduled";
  attendance_records: ProjectMeetingAttendanceRecord[];
  attended_count: number;
  not_attended_count: number;
  pending_count: number;
}

export interface ProjectTimeLog {
  id: string | number;
  member: string;
  task: string;
  date: string;
  hours: number;
}

export interface Project {
  id: string | number;
  project_code: string;
  name: string;
  account_name: string;
  contact_name: string;
  deal_name: string;
  source_module?: string;
  source_record_id?: number | null;
  source_record_label?: string;
  owner: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  description: string;
  team_count: number;
  estimated_hours: number | null;
  logged_hours: number;
  tasks: ProjectTask[];
  meetings: ProjectMeeting[];
  phases: ProjectPhase[];
  issues: ProjectIssue[];
  members: ProjectMember[];
  files: ProjectFile[];
  notes: ProjectNote[];
  time_logs: ProjectTimeLog[];
}

export interface CreateProjectPayload {
  project_code: string;
  name: string;
  account_name: string;
  contact_name: string;
  deal_name: string;
  source_module?: string;
  source_record_id?: number | "";
  source_record_label?: string;
  owner: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  start_date: string;
  due_date: string;
  estimated_hours: number | "";
  description: string;
}
