import { apiRequest } from "../../api/client";
import { buildApiUrl } from "../../api/config";

type BackendCampaign = {
  id: number;
  campaign_name: string;
  type?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  expected_revenue?: string | null;
  budgeted_cost?: string | null;
  actual_cost?: string | null;
  expected_response?: number | null;
  numbers_sent?: number | null;
  description?: string | null;
  owner?: number | null;
  owner_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type CampaignRecord = {
  id: string;
  campaignName: string;
  campaignOwnerId: string;
  campaignOwnerEmail: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  expectedRevenue: string;
  budgetedCost: string;
  actualCost: string;
  expectedResponse: string;
  numbersSent: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignFormData = {
  campaignOwner?: string;
  campaignName: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  expectedRevenue: string;
  budgetedCost: string;
  actualCost: string;
  expectedResponse: string;
  numbersSent: string;
  description: string;
};

function toList<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

function asString(value: unknown) {
  return value == null ? "" : String(value);
}

function normalizeDate(value?: string): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw;
}

function mapCampaign(item: BackendCampaign): CampaignRecord {
  return {
    id: asString(item.id),
    campaignName: asString(item.campaign_name),
    campaignOwnerId: asString(item.owner),
    campaignOwnerEmail: asString(item.owner_email),
    type: asString(item.type),
    status: asString(item.status),
    startDate: asString(item.start_date),
    endDate: asString(item.end_date),
    expectedRevenue: asString(item.expected_revenue),
    budgetedCost: asString(item.budgeted_cost),
    actualCost: asString(item.actual_cost),
    expectedResponse: asString(item.expected_response),
    numbersSent: asString(item.numbers_sent),
    description: asString(item.description),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  };
}

function toBackendPayload(payload: CampaignFormData): Record<string, unknown> {
  const body: Record<string, unknown> = {
    campaign_name: payload.campaignName.trim(),
  };

  if (payload.type !== undefined) body.type = payload.type || null;
  if (payload.status !== undefined) body.status = payload.status || null;
  if (payload.startDate !== undefined) body.start_date = normalizeDate(payload.startDate);
  if (payload.endDate !== undefined) body.end_date = normalizeDate(payload.endDate);
  if (payload.expectedRevenue !== undefined) body.expected_revenue = payload.expectedRevenue || null;
  if (payload.budgetedCost !== undefined) body.budgeted_cost = payload.budgetedCost || null;
  if (payload.actualCost !== undefined) body.actual_cost = payload.actualCost || null;
  if (payload.expectedResponse !== undefined) {
    body.expected_response = payload.expectedResponse ? Number(payload.expectedResponse) : null;
  }
  if (payload.numbersSent !== undefined) {
    body.numbers_sent = payload.numbersSent ? Number(payload.numbersSent) : null;
  }
  if (payload.description !== undefined) body.description = payload.description || null;
  if (payload.campaignOwner && /^\d+$/.test(payload.campaignOwner.trim())) {
    body.campaign_owner = Number(payload.campaignOwner.trim());
  }

  return body;
}

export async function getCampaigns(query?: { search?: string; sort?: string }) {
  const data = await apiRequest<BackendCampaign[] | Paginated<BackendCampaign>>("/campaigns/", {
    query: {
      search: query?.search,
      sort: query?.sort,
    },
  });
  return toList(data).map(mapCampaign);
}

export async function createCampaign(payload: CampaignFormData) {
  const data = await apiRequest<BackendCampaign>("/campaigns/", {
    method: "POST",
    body: JSON.stringify(toBackendPayload(payload)),
  });
  return mapCampaign(data);
}

export async function getCampaignById(id: string): Promise<CampaignRecord | null> {
  try {
    const data = await apiRequest<BackendCampaign>(`/campaigns/${id}/`);
    return mapCampaign(data);
  } catch {
    return null;
  }
}

export async function updateCampaign(id: string, payload: Partial<CampaignFormData>) {
  const data = await apiRequest<BackendCampaign>(`/campaigns/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(toBackendPayload(payload as CampaignFormData)),
  });
  return mapCampaign(data);
}

export async function deleteCampaign(id: string): Promise<void> {
  await apiRequest<void>(`/campaigns/${id}/`, { method: "DELETE" });
}

// ── Submissions ───────────────────────────────────────────────────────────

export type CampaignSubmission = {
  id: number;
  campaign: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  notes: string;
  source: string;
  isConverted: boolean;
  convertedLead: number | null;
  submittedAt: string;
};

type BackendSubmission = {
  id: number;
  campaign: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  website?: string | null;
  notes?: string | null;
  source?: string | null;
  is_converted: boolean;
  converted_lead?: number | null;
  submitted_at: string;
};

function mapSubmission(s: BackendSubmission): CampaignSubmission {
  return {
    id: s.id,
    campaign: s.campaign,
    firstName: s.first_name,
    lastName: s.last_name,
    email: s.email,
    phone: s.phone ?? "",
    company: s.company ?? "",
    website: s.website ?? "",
    notes: s.notes ?? "",
    source: s.source ?? "",
    isConverted: s.is_converted,
    convertedLead: s.converted_lead ?? null,
    submittedAt: s.submitted_at,
  };
}

export async function getCampaignSubmissions(
  campaignId: string,
  filter?: "all" | "converted" | "not_converted"
): Promise<CampaignSubmission[]> {
  const query: Record<string, string> = {};
  if (filter === "converted") query.converted = "true";
  if (filter === "not_converted") query.converted = "false";
  const data = await apiRequest<BackendSubmission[]>(`/campaigns/${campaignId}/submissions/`, { query });
  return (Array.isArray(data) ? data : (data as { results: BackendSubmission[] }).results).map(mapSubmission);
}

export async function convertSubmissionToLead(
  submissionId: number
): Promise<{ message: string; lead_id: number }> {
  return apiRequest<{ message: string; lead_id: number }>(
    `/campaign-submissions/${submissionId}/convert-to-lead/`,
    { method: "POST" }
  );
}

export async function bulkConvertSubmissions(
  campaignId: string,
  submissionIds: number[]
): Promise<{ results: { id: number; success: boolean; lead_id?: number; error?: string }[] }> {
  return apiRequest(`/campaigns/${campaignId}/convert-submissions/`, {
    method: "POST",
    body: JSON.stringify({ submission_ids: submissionIds }),
  });
}

// ── Public form submit (no auth — passes tenant via header) ───────────────

export type PublicFormPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  website?: string;
  notes?: string;
};

export async function submitCampaignForm(
  campaignId: string,
  payload: PublicFormPayload,
): Promise<{ message: string; id: number }> {
  const url = buildApiUrl(`/public/campaigns/${campaignId}/submit-form/`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      phone: payload.phone ?? "",
      company: payload.company ?? "",
      website: payload.website ?? "",
      notes: payload.notes ?? "",
    }),
  });
  if (!res.ok) {
    const rawText = await res.text();
    let err: unknown = {};
    try {
      err = rawText ? JSON.parse(rawText) : {};
    } catch {
      err = rawText;
    }
    const msg =
      (typeof err === "object" && err !== null
        ? (err as Record<string, unknown>).detail ??
          (err as Record<string, unknown>).message ??
          (err as Record<string, unknown>).error ??
          (err as Record<string, unknown>).email
        : typeof err === "string" && err.trim()
          ? err
          : null) ??
      `Submission failed (HTTP ${res.status}).`;
    throw new Error(String(msg));
  }
  return res.json() as Promise<{ message: string; id: number }>;
}
