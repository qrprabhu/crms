import { apiRequest } from "../../api/client";
import type { Deal as DealRecord, Product as DealProductRecord } from "../shared/crmTypes";

type BackendDeal = {
  id: number | string;
  name?: string;
  deal_name?: string;
  stage?: string;
  amount?: number | null;
  value?: number | null;
  expected_revenue?: number | null;
  probability?: number | null;
  closing_date?: string | null;
  account?: number | null;
  account_name?: string | null;
  contact?: number | null;
  contact_name?: string | null;
  lead?: number | null;
  lead_name?: string | null;
  owner?: number | null;
  owner_email?: string | null;
  owner_name?: string | null;
  owner_details?: { name?: string | null; email?: string | null } | null;
  created_at?: string;
  updated_at?: string;
  account_info?: { id?: number | null; name?: string | null } | null;
  contact_info?: { id?: number | null; name?: string | null } | null;
};

type BackendAccount = {
  id: number;
  name?: string;
  account_name?: string;
};

type BackendContact = {
  id: number;
  first_name?: string;
  last_name?: string;
};

type BackendDealProduct = {
  id: number | string;
  product: number | string;
  product_name?: string | null;
  product_code?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  discount?: number | string | null;
  total_price?: number | string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function toList<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

function normalizeDeal(item: BackendDeal): DealRecord {
  const amount = item.amount ?? item.value ?? item.expected_revenue ?? 0;
  const stage = item.stage ?? "Qualification";
  const closingDate = item.closing_date ?? item.updated_at ?? item.created_at ?? "";
  const dealName = item.name ?? item.deal_name ?? "Untitled Deal";
  const value = item.value ?? item.expected_revenue ?? item.amount ?? 0;

  return {
    id: String(item.id),
    dealId: item.contact ? String(item.contact) : item.lead ? String(item.lead) : String(item.id),
    parentId: item.lead ? String(item.lead) : item.contact ? String(item.contact) : String(item.account ?? ""),
    dealName,
    amount: Number(amount ?? 0),
    stage,
    probability: Number(item.probability ?? 0),
    closingDate,
    type: item.account_name || "",
    accountName: item.account_name ?? item.account_info?.name ?? "",
    accountId: item.account ? String(item.account) : item.account_info?.id ? String(item.account_info.id) : undefined,
    contactName: item.contact_name ?? item.contact_info?.name ?? "",
    contactId: item.contact ? String(item.contact) : item.contact_info?.id ? String(item.contact_info.id) : undefined,
    leadName: item.lead_name ?? "",
    leadId: item.lead ? String(item.lead) : undefined,
    dealOwner: item.owner_name ?? item.owner_details?.name ?? item.owner_email ?? "Assigned to you",
    ownerEmail: item.owner_email ?? item.owner_details?.email ?? "",
    value: Number(value ?? 0),
    createdAt: item.created_at ?? "",
    updatedAt: item.updated_at ?? "",
  };
}

async function resolveAccountIdByName(accountName?: string): Promise<number | null> {
  const name = (accountName ?? "").trim();
  if (!name) return null;
  if (/^\d+$/.test(name)) return Number(name);
  const data = await apiRequest<BackendAccount[] | Paginated<BackendAccount>>("/accounts", {
    query: { search: name, page_size: 50 },
  });
  const accounts = toList(data);
  const exact = accounts.find((a) => (a.account_name ?? a.name ?? "").toLowerCase() === name.toLowerCase());
  if (exact) return exact.id;
  return accounts[0]?.id ?? null;
}

async function resolveContactIdByName(contactName?: string): Promise<number | null> {
  const raw = (contactName ?? "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);

  const data = await apiRequest<BackendContact[] | Paginated<BackendContact>>("/contacts", {
    query: { search: raw, page_size: 50 },
  });
  const contacts = toList(data);
  const exact = contacts.find((c) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim().toLowerCase() === raw.toLowerCase());
  if (exact) return exact.id;
  return contacts[0]?.id ?? null;
}

export type CreateDealPayload = {
  dealOwner?: string;
  dealName: string;
  accountName: string;
  contactName?: string;
  amount?: string;
  closingDate?: string;
  stage?: string;
  probability?: string;
  type?: string;
  leadSource?: string;
  nextStep?: string;
  description?: string;
  expectedRevenue?: string;
  campaignSource?: string;
  forecastCategory?: string;
};

export type CreateDealProductPayload = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
};

function toBackendPayload(
  payload: Partial<CreateDealPayload>,
  accountId: number,
  contactId: number | null
): Record<string, unknown> {
  const normalizeDate = (value?: string): string | null => {
    const raw = (value ?? "").trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      return `${yyyy}-${mm}-${dd}`;
    }
    return raw;
  };

  const body: Record<string, unknown> = {
    account: accountId,
  };

  if (contactId) body.contact = contactId;
  if (payload.dealName !== undefined) body.deal_name = payload.dealName;
  if (payload.amount !== undefined) body.amount = payload.amount || null;
  if (payload.expectedRevenue !== undefined) body.expected_revenue = payload.expectedRevenue || null;
  if (payload.closingDate !== undefined) body.closing_date = normalizeDate(payload.closingDate);
  if (payload.stage !== undefined) body.stage = payload.stage || null;
  if (payload.probability !== undefined) {
    body.probability = payload.probability ? Number(payload.probability) : null;
  }
  if (payload.type !== undefined) body.type = payload.type || null;
  if (payload.leadSource !== undefined) body.lead_source = payload.leadSource || null;
  if (payload.nextStep !== undefined) body.next_step = payload.nextStep || null;
  if (payload.description !== undefined) body.description = payload.description || null;
  if (payload.campaignSource !== undefined) body.campaign_source = payload.campaignSource || null;
  if (payload.forecastCategory !== undefined) body.forecast_category = payload.forecastCategory || null;

  if (payload.dealOwner && /^\d+$/.test(payload.dealOwner.trim())) {
    body.deal_owner = Number(payload.dealOwner.trim());
  }
  return body;
}

export async function getDeals(options?: { pageSize?: number; cacheTtlMs?: number }): Promise<DealRecord[]> {
  const data = await apiRequest<BackendDeal[] | Paginated<BackendDeal>>("/deals", {
    query: options?.pageSize ? { page_size: options.pageSize } : undefined,
    cacheTtlMs: options?.cacheTtlMs,
  });
  return toList(data).map(normalizeDeal);
}

export async function getDealById(id: string): Promise<DealRecord | null> {
  try {
    const data = await apiRequest<BackendDeal>(`/deals/${id}`);
    return normalizeDeal(data);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

export async function createDeal(payload: CreateDealPayload): Promise<DealRecord> {
  const accountId = await resolveAccountIdByName(payload.accountName);
  if (!accountId) {
    throw new Error("Account not found. Please provide a valid Account Name.");
  }
  const contactId = await resolveContactIdByName(payload.contactName);
  const body = toBackendPayload(payload, accountId, contactId);
  const data = await apiRequest<BackendDeal>("/deals", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeDeal(data);
}

export async function updateDeal(id: string, payload: Partial<CreateDealPayload>): Promise<DealRecord> {
  const accountId = payload.accountName ? await resolveAccountIdByName(payload.accountName) : null;
  const contactId = payload.contactName ? await resolveContactIdByName(payload.contactName) : null;
  const body = toBackendPayload(payload, accountId ?? 0, contactId);
  if (!accountId) {
    delete body.account;
  }
  const data = await apiRequest<BackendDeal>(`/deals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return normalizeDeal(data);
}

export async function deleteDeal(id: string): Promise<void> {
  await apiRequest(`/deals/${id}`, { method: "DELETE" });
}

export async function createDealTask(
  id: string,
  payload: { subject: string; description?: string }
): Promise<void> {
  await apiRequest(`/deals/${id}/create-task`, {
    method: "POST",
    body: JSON.stringify({
      subject: payload.subject,
      description: payload.description ?? "",
    }),
  });
}

export async function logDealCall(
  id: string,
  payload: { call_summary: string; call_outcome?: string }
): Promise<void> {
  await apiRequest(`/deals/${id}/log-call`, {
    method: "POST",
    body: JSON.stringify({
      call_summary: payload.call_summary,
      call_outcome: payload.call_outcome ?? "",
    }),
  });
}

export async function scheduleDealMeeting(
  id: string,
  payload: { meeting_subject: string; agenda?: string }
): Promise<void> {
  await apiRequest(`/deals/${id}/schedule-meeting`, {
    method: "POST",
    body: JSON.stringify({
      meeting_subject: payload.meeting_subject,
      agenda: payload.agenda ?? "",
    }),
  });
}

function normalizeDealProduct(dealId: string, item: BackendDealProduct): DealProductRecord {
  return {
    id: String(item.id),
    parentId: dealId,
    productId: String(item.product),
    productName: item.product_name ?? "Product",
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unit_price ?? 0),
    discount: Number(item.discount ?? 0),
    amount: Number(item.unit_price ?? 0),
    total: Number(item.total_price ?? 0),
  };
}

export async function getDealProducts(id: string): Promise<DealProductRecord[]> {
  const data = await apiRequest<BackendDealProduct[]>(`/deals/${id}/products`);
  return data.map((item) => normalizeDealProduct(id, item));
}

export async function addDealProduct(
  id: string,
  payload: CreateDealProductPayload
): Promise<DealProductRecord> {
  const data = await apiRequest<BackendDealProduct>(`/deals/${id}/products`, {
    method: "POST",
    body: JSON.stringify({
      product: Number(payload.productId),
      quantity: payload.quantity,
      unit_price: payload.unitPrice,
      discount: payload.discount ?? 0,
    }),
  });
  return normalizeDealProduct(id, data);
}
