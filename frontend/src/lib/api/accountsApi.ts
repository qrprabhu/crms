import { apiRequest } from "../../api/client";
import type { AccountRecord, Note } from "../shared/crmTypes";

function endpoint(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

type BackendAccount = {
  id: number;
  name?: string;
  account_name?: string;
  website?: string | null;
  phone?: string | null;
  industry?: string | null;
  annual_revenue?: string | null;
  employee_count?: number | null;
  employees?: number | null;
  owner?: number | null;
  owner_email?: string | null;
  owner_name?: string | null;
  account_owner?: number | null;
  owner_details?: { name?: string | null; email?: string | null } | null;
  billing_address?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type BackendNote = {
  id: number;
  note: string;
  created_by?: string | null;
  created_at?: string;
};

function toList<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

function asNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAccount(item: BackendAccount): AccountRecord {
  const accountName = item.account_name ?? item.name ?? "";
  const employees = item.employees ?? item.employee_count ?? 0;
  return {
    id: String(item.id),
    accountName,
    accountOwner:
      item.owner_name ??
      item.owner_email ??
      item.owner_details?.name ??
      (item.account_owner || item.owner ? `User #${item.account_owner ?? item.owner}` : "Assigned to you"),
    ownerEmail: item.owner_email ?? item.owner_details?.email ?? undefined,
    accountSite: "",
    parentAccount: "",
    accountNumber: "",
    rating: "",
    phone: item.phone ?? "",
    fax: "",
    website: item.website ?? "",
    tickerSymbol: "",
    ownership: "",
    industry: item.industry ?? "",
    employees,
    annualRevenue: asNumber(item.annual_revenue),
    sicCode: "",
    description: item.description ?? "",
    createdAt: item.created_at ?? "",
    updatedAt: item.updated_at ?? "",
  };
}

function toBillingAddress(payload: Partial<CreateAccountPayload>): string | undefined {
  const parts = [payload.street, payload.city, payload.state, payload.country, payload.zipCode]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  if (!parts.length) return undefined;
  return parts.join(", ");
}

function toBackendPayload(payload: Partial<CreateAccountPayload>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (payload.accountName !== undefined) body.account_name = payload.accountName;
  if (payload.accountType !== undefined) {
    const allowed = new Set([
      "Analyst",
      "Competitor",
      "Customer",
      "Integrator",
      "Investor",
      "Partner",
      "Press",
      "Prospect",
      "Reseller",
      "Other",
    ]);
    const raw = (payload.accountType || "").trim();
    body.account_type = !raw ? null : allowed.has(raw) ? raw : "Other";
  }
  if (payload.phone !== undefined) body.phone = payload.phone || null;
  if (payload.website !== undefined) body.website = payload.website || null;
  if (payload.industry !== undefined) body.industry = payload.industry || null;
  if (payload.annualRevenue !== undefined) body.annual_revenue = payload.annualRevenue || null;
  if (payload.employees !== undefined) {
    body.employees = payload.employees ? Number(payload.employees) : null;
  }
  if (payload.description !== undefined) body.description = payload.description || null;

  const billingAddress = toBillingAddress(payload);
  if (billingAddress !== undefined) body.billing_address = billingAddress;

  if (payload.accountOwner && /^\d+$/.test(payload.accountOwner.trim())) {
    body.account_owner = Number(payload.accountOwner.trim());
  }
  return body;
}

export async function getAccounts(options?: { pageSize?: number; cacheTtlMs?: number }): Promise<AccountRecord[]> {
  const data = await apiRequest<BackendAccount[] | Paginated<BackendAccount>>(endpoint("/accounts"), {
    query: options?.pageSize ? { page_size: options.pageSize } : undefined,
    cacheTtlMs: options?.cacheTtlMs,
  });
  return toList(data).map(normalizeAccount);
}

export async function getAccountById(id: string): Promise<AccountRecord | null> {
  try {
    const data = await apiRequest<BackendAccount>(endpoint(`/accounts/${id}`));
    return normalizeAccount(data);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

export type CreateAccountPayload = {
  accountOwner?: string;
  accountName: string;
  accountType?: string;
  phone?: string;
  website?: string;
  industry?: string;
  annualRevenue?: string;
  employees?: string;
  country?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  description?: string;
};

export async function updateAccount(
  id: string,
  payload: Partial<CreateAccountPayload>
): Promise<AccountRecord> {
  const body = toBackendPayload(payload);
  const data = await apiRequest<BackendAccount>(endpoint(`/accounts/${id}`), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return normalizeAccount(data);
}

export async function deleteAccount(id: string): Promise<void> {
  await apiRequest(endpoint(`/accounts/${id}`), { method: "DELETE" });
}

export async function createAccount(payload: CreateAccountPayload): Promise<AccountRecord> {
  const body = toBackendPayload(payload);
  const data = await apiRequest<BackendAccount>(endpoint("/accounts"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeAccount(data);
}

export async function addAccountNote(id: string, note: string): Promise<void> {
  await apiRequest(endpoint(`/accounts/${id}/notes`), {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function getAccountNotes(id: string): Promise<Note[]> {
  try {
    const data = await apiRequest<BackendNote[]>(endpoint(`/accounts/${id}/notes`));
    return data.map((item) => ({
      id: String(item.id),
      parentId: id,
      title: item.note.slice(0, 60),
      content: item.note,
      createdAt: item.created_at ?? "",
      createdBy: item.created_by ?? "",
    }));
  } catch {
    return [];
  }
}

export async function createAccountTask(
  id: string,
  payload: { subject: string; description?: string }
): Promise<void> {
  await apiRequest(endpoint(`/accounts/${id}/create-task`), {
    method: "POST",
    body: JSON.stringify({
      subject: payload.subject,
      description: payload.description ?? "",
    }),
  });
}

export async function logAccountCall(
  id: string,
  payload: { call_summary: string; call_outcome?: string }
): Promise<void> {
  await apiRequest(endpoint(`/accounts/${id}/log-call`), {
    method: "POST",
    body: JSON.stringify({
      call_summary: payload.call_summary,
      call_outcome: payload.call_outcome ?? "",
    }),
  });
}

export async function scheduleAccountMeeting(
  id: string,
  payload: { meeting_subject: string; agenda?: string }
): Promise<void> {
  await apiRequest(endpoint(`/accounts/${id}/schedule-meeting`), {
    method: "POST",
    body: JSON.stringify({
      meeting_subject: payload.meeting_subject,
      agenda: payload.agenda ?? "",
    }),
  });
}

export async function sendAccountEmail(
  id: string,
  payload: { subject: string; body: string; to?: string }
): Promise<void> {
  await apiRequest(endpoint(`/accounts/${id}/send-email`), {
    method: "POST",
    body: JSON.stringify({
      subject: payload.subject,
      body: payload.body,
      to_email: payload.to ?? "",
    }),
  });
}

export async function getAccountContacts(id: string): Promise<import("../shared/crmTypes").ContactRecord[]> {
  try {
    const data = await apiRequest<any>(endpoint(`/accounts/${id}/contacts`));
    const list = Array.isArray(data) ? data : (data as any).results ?? [];
    return list.map((item: any) => ({
      id: String(item.id),
      contactName: `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim(),
      firstName: item.first_name ?? "",
      lastName: item.last_name ?? "",
      accountName: item.account_info?.name ?? item.account_name ?? "",
      accountId: item.account ? String(item.account) : undefined,
      contactOwner: item.owner_details?.email ?? "",
      email: item.email ?? "",
      otherPhone: item.other_phone ?? "",
      phone: item.phone ?? "",
      mobile: item.mobile ?? "",
      fax: "",
      leadSource: "",
      vendorName: "",
      title: item.title ?? "",
      department: item.department ?? "",
      homePhone: "",
      tags: [],
      avatar: `${(item.first_name ?? "")[0] ?? ""}${(item.last_name ?? "")[0] ?? ""}`.toUpperCase(),
      createdAt: item.created_at ?? "",
      updatedAt: item.updated_at ?? "",
    }));
  } catch {
    return [];
  }
}

export async function getAccountDeals(id: string): Promise<import("../shared/crmTypes").Deal[]> {
  try {
    const data = await apiRequest<any>(endpoint(`/accounts/${id}/deals`));
    const list = Array.isArray(data) ? data : (data as any).results ?? [];
    return list.map((item: any) => ({
      id: String(item.id),
      parentId: id,
      dealName: item.deal_name ?? item.name ?? "Untitled Deal",
      amount: Number(item.amount ?? 0),
      stage: item.stage ?? "",
      probability: Number(item.probability ?? 0),
      closingDate: item.closing_date ?? "",
      type: item.type ?? "",
      accountName: item.account_name ?? "",
      contactName: item.contact_name ?? "",
      ownerEmail: item.owner_email ?? "",
    }));
  } catch {
    return [];
  }
}
