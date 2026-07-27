import { apiRequest } from "../api/client";
import type { DealRecord } from "../lib/types/dealTypes";

type BackendDeal = {
  id: number | string;
  name?: string;
  deal_name?: string;
  account?: number | null;
  account_name?: string | null;
  contact?: number | null;
  contact_name?: string | null;
  owner?: number | null;
  owner_email?: string | null;
  amount?: number | null;
  stage?: string | null;
  probability?: number | null;
  expected_revenue?: number | string | null;
  closing_date?: string | null;
  type?: string | null;
  lead_source?: string | null;
  campaign_source?: string | null;
  next_step?: string | null;
  description?: string | null;
  lead?: number | null;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function asNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toList<T>(payload: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

function normalizeDeal(item: BackendDeal): DealRecord {
  return {
    id: String(item.id),
    dealName: item.deal_name ?? item.name ?? "Untitled Deal",
    accountId: item.account ? String(item.account) : undefined,
    accountName: item.account_name ?? "",
    contactId: item.contact ? String(item.contact) : undefined,
    contactName: item.contact_name ?? "",
    ownerId: item.owner ? String(item.owner) : undefined,
    ownerName: item.owner_email ?? "",
    amount: asNumber(item.amount),
    closingDate: item.closing_date ?? "",
    stage: item.stage ?? "",
    probability: asNumber(item.probability),
    expectedRevenue: asNumber(item.expected_revenue),
    type: item.type ?? "",
    leadSource: item.lead_source ?? "",
    campaignSource: item.campaign_source ?? "",
    nextStep: item.next_step ?? "",
    description: item.description ?? "",
    leadId: item.lead ? String(item.lead) : undefined,
  };
}

export async function getDeals(): Promise<DealRecord[]> {
  const data = await apiRequest<BackendDeal[] | PaginatedResponse<BackendDeal>>("/deals");
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

export async function createDeal(data: Partial<DealRecord>): Promise<DealRecord> {
  const created = await apiRequest<BackendDeal>("/deals", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return normalizeDeal(created);
}

export async function updateDeal(id: string, data: Partial<DealRecord>): Promise<DealRecord> {
  const updated = await apiRequest<BackendDeal>(`/deals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return normalizeDeal(updated);
}

export async function deleteDeal(id: string): Promise<void> {
  await apiRequest(`/deals/${id}`, {
    method: "DELETE",
  });
}

export async function convertLeadToDeal(leadId: string, payload: unknown): Promise<DealRecord> {
  const converted = await apiRequest<BackendDeal>(`/leads/${leadId}/convert`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeDeal(converted);
}
