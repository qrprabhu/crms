import { apiRequest } from "./client";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type LeadListItemDto = {
  id: number;
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  phone: string | null;
  lead_source: string | null;
  owner: number | null;
  owner_email?: string | null;
  created_at: string;
};

export type LeadDetailDto = LeadListItemDto & {
  title: string | null;
  mobile: string | null;
  website: string | null;
  lead_status: string | null;
  industry: string | null;
  annual_revenue: string | null;
  employee_count: number | null;
  rating: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  skype_id: string | null;
  secondary_email: string | null;
  description: string | null;
  updated_at: string;
};

export type LeadNoteDto = {
  id: number;
  note: string;
  created_by: string | null;
  created_at: string;
};

export type LeadTimelineDto = {
  id: number;
  action: string;
  description: string;
  user: string | null;
  timestamp: string;
};

export type AccountDto = {
  id: number;
  name: string;
  website: string | null;
  phone: string | null;
  industry: string | null;
  annual_revenue: string | null;
  employee_count: number | null;
  owner: number | null;
  owner_email?: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactDto = {
  id: number;
  account: number | null;
  account_name?: string | null;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  secondary_email: string | null;
  phone: string | null;
  mobile: string | null;
  owner: number | null;
  owner_email?: string | null;
  created_at: string;
  updated_at: string;
};

export type DealDto = {
  id: number;
  account: number;
  account_name?: string | null;
  contact: number | null;
  contact_name?: string | null;
  lead: number | null;
  lead_name?: string | null;
  name: string;
  stage: string;
  value: string | null;
  owner: number | null;
  owner_email?: string | null;
  created_at: string;
  updated_at: string;
};

function toList<T>(payload: T[] | PaginatedResponse<T>) {
  return Array.isArray(payload) ? payload : payload.results;
}

export async function fetchLeads() {
  return toList(await apiRequest<LeadListItemDto[] | PaginatedResponse<LeadListItemDto>>("/leads"));
}

export async function fetchLead(id: string) {
  return apiRequest<LeadDetailDto>(`/leads/${id}`);
}

export async function fetchLeadNotes(id: string) {
  return apiRequest<LeadNoteDto[]>(`/leads/${id}/notes`);
}

export async function fetchLeadTimeline(id: string) {
  return apiRequest<LeadTimelineDto[]>(`/leads/${id}/timeline`);
}

export async function fetchAccounts() {
  return toList(await apiRequest<AccountDto[] | PaginatedResponse<AccountDto>>("/accounts"));
}

export async function fetchAccount(id: string) {
  return apiRequest<AccountDto>(`/accounts/${id}`);
}

export async function fetchContacts() {
  return toList(await apiRequest<ContactDto[] | PaginatedResponse<ContactDto>>("/contacts"));
}

export async function fetchContact(id: string) {
  return apiRequest<ContactDto>(`/contacts/${id}`);
}

export async function fetchDeals() {
  return toList(await apiRequest<DealDto[] | PaginatedResponse<DealDto>>("/deals"));
}
