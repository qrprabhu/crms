import { buildApiUrl } from "../../api/config";
import { apiRequest } from "../../api/client";
import type { ConnectedRecord, EmailRecord, LeadRecord, Note, TimelineItem } from "../shared/crmTypes";

const API_BASE = buildApiUrl("").replace(/\/$/, "");

function api(path: string) {
  return `${API_BASE}${path.endsWith("/") ? path : `${path}/`}`;
}

type BackendLeadList = {
  id: number;
  first_name: string;
  last_name: string;
  lead_name?: string;
  company: string;
  email: string;
  phone?: string | null;
  lead_source?: string | null;
  owner?: number | null;
  owner_email?: string | null;
  owner_name?: string | null;
  owner_details?: { id?: number; email?: string | null; name?: string | null } | null;
  created_at?: string;
  latest_activity?: {
    date: string;
    type: "call" | "task" | "meeting" | "other";
    action: string;
  } | null;
};

type BackendLeadDetail = BackendLeadList & {
  title?: string | null;
  mobile?: string | null;
  website?: string | null;
  lead_status?: string | null;
  industry?: string | null;
  annual_revenue?: string | null;
  employee_count?: number | null;
  rating?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip_code?: string | null;
  skype_id?: string | null;
  secondary_email?: string | null;
  description?: string | null;
  updated_at?: string;
  tags?: string[] | null;
  converted_account?: number | null;
  converted_account_info?: { id?: number; name?: string | null } | null;
  converted_account_name?: string | null;
  converted_contact?: number | null;
  converted_contact_info?: { id?: number; name?: string | null } | null;
  converted_contact_name?: string | null;
  converted_deal?: number | null;
  converted_deal_info?: { id?: number; name?: string | null } | null;
  converted_deal_name?: string | null;
};

type BackendNote = {
  id: number;
  note: string;
  created_by?: string | null;
  created_at?: string;
};

type BackendActivity = {
  id: number;
  action: string;
  description?: string | null;
  user?: string | null;
  timestamp?: string;
};

type BackendLeadEmail = {
  id: number;
  subject: string;
  from_email: string;
  to_emails: string[];
  direction: string;
  status: string;
  received_at?: string;
  sent_at?: string | null;
  is_read?: boolean;
};

type BackendLeadConnectedRecord = {
  id: number;
  source_type: string;
  source_label: string;
  source_reference: string;
  created_at?: string;
};

type PaginatedResponse<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
};

type StoredUser = {
  id?: number | string;
  email?: string;
  name?: string;
  role?: string;
};

function buildHeaders(): Record<string, string> {
  const token = localStorage.getItem("accessToken");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem("loggedInUser");
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

function normalizeLeadList(item: BackendLeadList): LeadRecord {
  const ownerLabel = item.owner_name ?? item.owner_details?.name ?? item.owner_email ?? "Assigned to you";
  return {
    id: String(item.id),
    leadName: item.lead_name ?? `${item.first_name} ${item.last_name}`.trim(),
    firstName: item.first_name,
    lastName: item.last_name,
    company: item.company,
    title: "",
    email: item.email,
    secondaryEmail: "",
    phone: item.phone ?? "",
    mobile: "",
    leadSource: item.lead_source ?? "",
    leadOwner: ownerLabel,
    leadStatus: "",
    industry: "",
    annualRevenue: 0,
    website: "",
    noOfEmployees: 0,
    rating: "",
    fax: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    skypeId: "",
    description: "",
    createdBy: "",
    createdAt: item.created_at ?? "",
    updatedBy: "",
    updatedAt: "",
    ownerEmail: item.owner_email ?? item.owner_details?.email ?? undefined,
    nextActivity: item.latest_activity ?? undefined,
  };
}

function normalizeLeadDetail(item: BackendLeadDetail): LeadRecord {
  const ownerLabel = item.owner_name ?? item.owner_details?.name ?? item.owner_email ?? "Assigned to you";
  return {
    id: String(item.id),
    leadName: item.lead_name ?? `${item.first_name} ${item.last_name}`.trim(),
    firstName: item.first_name,
    lastName: item.last_name,
    company: item.company,
    title: item.title ?? "",
    email: item.email,
    secondaryEmail: item.secondary_email ?? "",
    phone: item.phone ?? "",
    mobile: item.mobile ?? "",
    leadSource: item.lead_source ?? "",
    leadOwner: ownerLabel,
    leadStatus: item.lead_status ?? "",
    industry: item.industry ?? "",
    annualRevenue: Number(item.annual_revenue ?? 0),
    website: item.website ?? "",
    noOfEmployees: item.employee_count ?? 0,
    rating: item.rating ?? "",
    fax: "",
    address: item.street ?? "",
    city: item.city ?? "",
    state: item.state ?? "",
    zipCode: item.zip_code ?? "",
    country: item.country ?? "",
    skypeId: item.skype_id ?? "",
    description: item.description ?? "",
    createdBy: "",
    createdAt: item.created_at ?? "",
    updatedBy: "",
    updatedAt: item.updated_at ?? "",
    ownerEmail: item.owner_email ?? item.owner_details?.email ?? undefined,
    tags: item.tags ?? undefined,
    convertedAccountId: item.converted_account ? String(item.converted_account) : item.converted_account_info?.id ? String(item.converted_account_info.id) : undefined,
    convertedAccountName: item.converted_account_name ?? item.converted_account_info?.name ?? undefined,
    convertedContactId: item.converted_contact ? String(item.converted_contact) : item.converted_contact_info?.id ? String(item.converted_contact_info.id) : undefined,
    convertedContactName: item.converted_contact_name ?? item.converted_contact_info?.name ?? undefined,
    convertedDealId: item.converted_deal ? String(item.converted_deal) : item.converted_deal_info?.id ? String(item.converted_deal_info.id) : undefined,
    convertedDealName: item.converted_deal_name ?? item.converted_deal_info?.name ?? undefined,
  };
}

function buildLeadPayload(payload: any) {
  const body: Record<string, unknown> = {
    first_name: payload.firstName ?? "",
    last_name: payload.lastName ?? "",
    company: payload.company ?? "",
    email: payload.email ?? "",
  };

  const optionalMappings: Array<[string, unknown]> = [
    ["title", payload.title],
    ["phone", payload.phone],
    ["mobile", payload.mobile],
    ["website", payload.website],
    ["lead_source", payload.leadSource],
    ["lead_status", payload.leadStatus],
    ["industry", payload.industry],
    ["rating", payload.rating],
    ["street", payload.street || payload.address],
    ["city", payload.city],
    ["state", payload.state],
    ["country", payload.country],
    ["zip_code", payload.zipCode],
    ["skype_id", payload.skypeId],
    ["secondary_email", payload.secondaryEmail],
    ["description", payload.description],
  ];

  optionalMappings.forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      body[key] = value;
    }
  });

  if (payload.noOfEmployees !== undefined && payload.noOfEmployees !== null && payload.noOfEmployees !== "") {
    body.employee_count = Number(payload.noOfEmployees);
  }

  if (payload.annualRevenue !== undefined && payload.annualRevenue !== null && payload.annualRevenue !== "") {
    body.annual_revenue = Number(payload.annualRevenue);
  }

  return body;
}

export async function getLeads(options?: { pageSize?: number; maxPages?: number; cacheTtlMs?: number }): Promise<LeadRecord[]> {
  const allLeads: BackendLeadList[] = [];
  const pageSize = options?.pageSize ?? 100;
  const maxPages = options?.maxPages ?? Number.POSITIVE_INFINITY;
  let pagesLoaded = 0;
  let nextUrl: string | null = `/leads?page_size=${pageSize}`;

  while (nextUrl && pagesLoaded < maxPages) {
    const data: BackendLeadList[] | PaginatedResponse<BackendLeadList> = await apiRequest(nextUrl, {
      cacheTtlMs: options?.cacheTtlMs,
    });

    if (Array.isArray(data)) {
      allLeads.push(...data);
      nextUrl = null;
    } else {
      allLeads.push(...(data.results ?? []));
      nextUrl = data.next ? data.next.replace(/^https?:\/\/[^/]+\/api/i, "") : null;
    }

    pagesLoaded += 1;
  }

  const storedUser = getStoredUser();
  const role = (storedUser?.role || "").toLowerCase();
  const userEmail = (storedUser?.email || "").toLowerCase();

  const filteredLeads =
    role === "employee"
      ? allLeads.filter((lead) => (lead.owner_email || "").toLowerCase() === userEmail)
      : allLeads;

  return filteredLeads.map(normalizeLeadList);
}

export async function getLeadById(id: string): Promise<LeadRecord | null> {
  const res = await fetch(api(`/leads/${id}`), { headers: buildHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load lead");
  const item = (await res.json()) as BackendLeadDetail;
  return normalizeLeadDetail(item);
}

export async function createLead(payload: any): Promise<LeadRecord> {
  const body = buildLeadPayload(payload);

  const res = await fetch(api("/leads"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as BackendLeadDetail;
  return normalizeLeadDetail(data);
}

export async function updateLead(id: string, payload: any) {
  const body = buildLeadPayload(payload);
  const res = await fetch(api(`/leads/${id}`), {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteLead(id: string) {
  const res = await fetch(api(`/leads/${id}`), {
    method: "DELETE",
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete lead");
}

export async function getLeadNotes(id: string): Promise<Note[]> {
  const res = await fetch(api(`/leads/${id}/notes`), { headers: buildHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((item: BackendNote) => ({
    id: String(item.id),
    parentId: id,
    title: item.note,
    content: item.note,
    createdAt: item.created_at ?? "",
    createdBy: item.created_by ?? "",
  }));
}

export async function getLeadTimeline(id: string): Promise<TimelineItem[]> {
  const res = await fetch(api(`/leads/${id}/timeline`), { headers: buildHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((item: BackendActivity) => ({
    id: String(item.id),
    parentId: id,
    type: "Update",
    title: item.action,
    detail: item.description ?? "",
    at: item.timestamp ?? "",
    by: item.user ?? "",
  }));
}

export async function getLeadEmails(id: string): Promise<EmailRecord[]> {
  const res = await fetch(api(`/leads/${id}/emails`), { headers: buildHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  const items: BackendLeadEmail[] = Array.isArray(data) ? data : [];
  return items.map((item) => ({
    id: String(item.id),
    parentId: id,
    subject: item.subject,
    sentAt: item.received_at || item.sent_at || "",
    sentBy:
      item.direction?.toLowerCase() === "outgoing"
        ? item.to_emails?.find(Boolean) || item.from_email
        : item.from_email,
    status:
      item.status === "draft"
        ? "Draft"
        : item.direction?.toLowerCase() === "incoming"
          ? "Received"
          : "Sent",
  }));
}

export async function getLeadConnectedRecords(id: string): Promise<ConnectedRecord[]> {
  const res = await fetch(api(`/leads/${id}/connected-records`), { headers: buildHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  const items: BackendLeadConnectedRecord[] = Array.isArray(data) ? data : [];
  return items.map((item) => ({
    id: String(item.id),
    parentId: id,
    recordType: item.source_type,
    name: item.source_label,
    owner: "",
    status: item.source_type === "email" ? "Linked" : item.source_reference,
  }));
}

export async function logLeadCall(
  id: string,
  payload: {
    call_summary: string;
    call_outcome?: string;
    call_type?: string;
    call_start_time?: string;
    reminder?: string;
    duration_minutes?: number;
    duration_seconds?: number;
    voice_recording?: string;
  }
) {
  const res = await fetch(api(`/leads/${id}/log-call`), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function addLeadNote(id: string, note: string) {
  const res = await fetch(api(`/leads/${id}/notes`), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function sendLeadEmail(id: string, payload: { subject: string; body: string; to?: string }) {
  const res = await fetch(api(`/leads/${id}/send-email`), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      subject: payload.subject,
      body: payload.body,
      to_email: payload.to ?? "",
    }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function sendEmail(_payload: {
  to: string;
  subject: string;
  body: string;
  from_email?: string;
}) {
  throw new Error("Direct provider send is not available here. Send from a CRM record with integrations enabled.");
}

export async function createLeadTask(id: string, payload: { subject: string; description?: string }) {
  const res = await fetch(api(`/leads/${id}/create-task`), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      subject: payload.subject,
      description: payload.description ?? "",
    }),
  });
  if (!res.ok) throw new Error((await res.text()) || "Failed to create task");
}

export async function scheduleLeadMeeting(id: string, payload: { meeting_subject: string; agenda?: string }) {
  const res = await fetch(api(`/leads/${id}/schedule-meeting`), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function convertLead(
  id: string,
  payload: { create_deal: boolean; deal_name?: string; deal_value?: number }
) {
  const res = await fetch(api(`/leads/${id}/convert`), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
}
