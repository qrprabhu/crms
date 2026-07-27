import { apiRequest } from "../../api/client";
import type { ContactRecord, Note } from "../shared/crmTypes";

const PHONE_PATTERN = /^\+?[0-9\-().\s]{7,20}$/;

function endpoint(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

function normalizeApiPath(pathOrUrl: string): string {
  const normalizePath = (value: string) => value.replace(/^\/api(?=\/)/i, "") || "/";

  if (!/^https?:\/\//i.test(pathOrUrl)) {
    const [pathname, search = ""] = pathOrUrl.split("?", 2);
    return `${normalizePath(pathname)}${search ? `?${search}` : ""}`;
  }

  const parsed = new URL(pathOrUrl);
  return `${normalizePath(parsed.pathname)}${parsed.search}`;
}

type BackendContact = {
  id: number;
  salutation?: string | null;
  first_name: string;
  last_name: string;
  title?: string | null;
  department?: string | null;
  assistant?: string | null;
  assistant_phone?: string | null;
  email?: string | null;
  secondary_email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  other_phone?: string | null;
  home_phone?: string | null;
  owner?: number | null;
  contact_owner?: number | null;
  owner_email?: string | null;
  owner_name?: string | null;
  owner_details?: { email?: string | null; name?: string | null } | null;
  account?: number | null;
  account_name?: string | null;
  account_info?: { name?: string | null } | null;
  contact_name?: string | null;
  created_at?: string;
  updated_at?: string;
  lead_conversion_reference?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
};

type BackendAccount = {
  id: number;
  name?: string;
  account_name?: string;
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

function normalizeContact(item: BackendContact): ContactRecord {
  const first = item.first_name ?? "";
  const last = item.last_name ?? "";

  return {
    id: String(item.id),
    contactId: item.lead_conversion_reference ? String(item.lead_conversion_reference.id) : String(item.id),
    contactName: item.contact_name ?? `${first} ${last}`.trim(),
    firstName: first,
    lastName: last,
    accountName: item.account_name ?? item.account_info?.name ?? "",
    contactOwner:
      item.owner_name ??
      item.owner_email ??
      item.owner_details?.email ??
      item.owner_details?.name ??
      (item.contact_owner || item.owner ? `User #${item.contact_owner ?? item.owner}` : "Assigned to you"),
    ownerEmail: item.owner_email ?? item.owner_details?.email ?? undefined,
    email: item.email ?? "",
    otherPhone: item.other_phone ?? "",
    phone: item.phone ?? "",
    mobile: item.mobile ?? "",
    fax: "",
    leadSource: "",
    vendorName: "",
    title: item.title ?? "",
    department: item.department ?? "",
    homePhone: item.home_phone ?? "",
    tags: [],
    avatar: `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase(),
    createdAt: item.created_at ?? "",
    updatedAt: item.updated_at ?? "",
    accountId: item.account ? String(item.account) : undefined,
    createdFromLeadId: item.lead_conversion_reference ? String(item.lead_conversion_reference.id) : undefined,
    createdFromLeadName: item.lead_conversion_reference
      ? `${item.lead_conversion_reference.first_name} ${item.lead_conversion_reference.last_name}`.trim()
      : undefined,
  };
}

async function resolveAccountIdByName(
  accountName?: string
): Promise<number | null> {
  const name = (accountName ?? "").trim();
  if (!name) return null;
  if (/^\d+$/.test(name)) return Number(name);

  const data = await apiRequest<BackendAccount[] | Paginated<BackendAccount>>(
    endpoint("/accounts"),
    {
      query: { search: name, page_size: 50 },
    }
  );

  const accounts = toList(data);
  const exact = accounts.find(
    (a) =>
      (a.account_name ?? a.name ?? "").toLowerCase() === name.toLowerCase()
  );

  if (exact) return exact.id;
  return accounts[0]?.id ?? null;
}

function toBackendPayload(
  payload: Partial<CreateContactPayload>,
  accountId: number | null
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (payload.salutation !== undefined) {
    body.salutation = payload.salutation.trim() || null;
  }
  if (payload.firstName !== undefined) {
    body.first_name = payload.firstName.trim();
  }
  if (payload.lastName !== undefined) {
    body.last_name = payload.lastName.trim();
  }
  if (payload.title !== undefined) {
    body.title = payload.title.trim() || null;
  }
  if (payload.department !== undefined) {
    body.department = payload.department.trim() || null;
  }
  if (payload.email !== undefined) {
    body.email = payload.email.trim().toLowerCase() || null;
  }
  if (payload.phone !== undefined) {
    body.phone = payload.phone.trim() || null;
  }
  if (payload.mobile !== undefined) {
    body.mobile = payload.mobile.trim() || null;
  }
  if (payload.otherPhone !== undefined) {
    body.other_phone = payload.otherPhone.trim() || null;
  }
  if (payload.assistant !== undefined) {
    body.assistant = payload.assistant.trim() || null;
  }
  if (payload.assistantPhone !== undefined) {
    body.assistant_phone = payload.assistantPhone.trim() || null;
  }
  if (payload.fax !== undefined) {
    body.fax = payload.fax.trim() || null;
  }
  if (payload.country !== undefined) {
    body.country = payload.country.trim() || null;
  }
  if (payload.street !== undefined) {
    body.street = payload.street.trim() || null;
  }
  if (payload.city !== undefined) {
    body.city = payload.city.trim() || null;
  }
  if (payload.state !== undefined) {
    body.state = payload.state.trim() || null;
  }
  if (payload.zipCode !== undefined) {
    body.zip_code = payload.zipCode.trim() || null;
  }
  if (payload.description !== undefined) {
    body.description = payload.description.trim() || null;
  }
  if (accountId !== null) {
    body.account = accountId;
  }

  if (payload.contactOwner && /^\d+$/.test(payload.contactOwner.trim())) {
    body.contact_owner = Number(payload.contactOwner.trim());
  }

  return body;
}

function validateCreateContactPayload(payload: Partial<CreateContactPayload>) {
  if (!payload.firstName?.trim()) {
    throw new Error("First name is required.");
  }

  if (!payload.lastName?.trim()) {
    throw new Error("Last name is required.");
  }

  const hasContactMethod = [
    payload.email,
    payload.phone,
    payload.mobile,
    payload.otherPhone,
  ].some((value) => Boolean(value?.trim()));

  if (!hasContactMethod) {
    throw new Error(
      "At least one contact method is required: email, phone, mobile, or other phone."
    );
  }

  const phoneFields = [
    { label: "Phone", value: payload.phone },
    { label: "Mobile", value: payload.mobile },
    { label: "Other phone", value: payload.otherPhone },
    { label: "Assistant phone", value: payload.assistantPhone },
  ];

  for (const field of phoneFields) {
    const rawValue = field.value?.trim();
    if (rawValue && !PHONE_PATTERN.test(rawValue)) {
      throw new Error(`${field.label} is not in a valid format.`);
    }
  }
}

export async function getContacts(options?: { pageSize?: number; maxPages?: number; cacheTtlMs?: number }): Promise<ContactRecord[]> {
  const contacts: BackendContact[] = [];
  const pageSize = options?.pageSize ?? 100;
  const maxPages = options?.maxPages ?? Number.POSITIVE_INFINITY;
  let pagesLoaded = 0;
  let nextUrl: string | null = `${endpoint("/contacts")}?page_size=${pageSize}`;

  while (nextUrl && pagesLoaded < maxPages) {
    const data: BackendContact[] | Paginated<BackendContact> = await apiRequest<BackendContact[] | Paginated<BackendContact>>(
      normalizeApiPath(nextUrl),
      { cacheTtlMs: options?.cacheTtlMs }
    );

    if (Array.isArray(data)) {
      contacts.push(...data);
      nextUrl = null;
    } else {
      contacts.push(...data.results);
      nextUrl = data.next;
    }

    pagesLoaded += 1;
  }

  return contacts.map(normalizeContact);
}

export async function getContactById(id: string): Promise<ContactRecord | null> {
  try {
    const data = await apiRequest<BackendContact>(endpoint(`/contacts/${id}`));
    return normalizeContact(data);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

export type CreateContactPayload = {
  contactOwner?: string;
  salutation?: string;
  firstName: string;
  lastName: string;
  accountName?: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  otherPhone?: string;
  fax?: string;
  assistant?: string;
  assistantPhone?: string;
  country?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  description?: string;
};

export async function updateContact(
  id: string,
  payload: Partial<CreateContactPayload>
): Promise<ContactRecord> {
  const accountId = await resolveAccountIdByName(payload.accountName);
  const body = toBackendPayload(payload, accountId);

  const data = await apiRequest<BackendContact>(endpoint(`/contacts/${id}`), {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return normalizeContact(data);
}

export async function deleteContact(id: string): Promise<void> {
  await apiRequest(endpoint(`/contacts/${id}`), {
    method: "DELETE",
  });
}

export async function createContact(
  payload: CreateContactPayload
): Promise<ContactRecord> {
  validateCreateContactPayload(payload);
  const accountId = await resolveAccountIdByName(payload.accountName);
  const body = toBackendPayload(payload, accountId);

  const data = await apiRequest<BackendContact>(endpoint("/contacts"), {
    method: "POST",
    body: JSON.stringify(body),
  });

  return normalizeContact(data);
}

export async function addContactNote(
  id: string,
  note: string
): Promise<void> {
  await apiRequest(endpoint(`/contacts/${id}/notes`), {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function getContactNotes(id: string): Promise<Note[]> {
  try {
    const data = await apiRequest<BackendNote[]>(
      endpoint(`/contacts/${id}/notes`)
    );

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

export async function createContactTask(
  id: string,
  payload: { subject: string; description?: string }
): Promise<void> {
  await apiRequest(endpoint(`/contacts/${id}/create-task`), {
    method: "POST",
    body: JSON.stringify({
      subject: payload.subject,
      description: payload.description ?? "",
    }),
  });
}

export async function logContactCall(
  id: string,
  payload: { call_summary: string; call_outcome?: string }
): Promise<void> {
  await apiRequest(endpoint(`/contacts/${id}/log-call`), {
    method: "POST",
    body: JSON.stringify({
      call_summary: payload.call_summary,
      call_outcome: payload.call_outcome ?? "",
    }),
  });
}

export async function scheduleContactMeeting(
  id: string,
  payload: { meeting_subject: string; agenda?: string }
): Promise<void> {
  await apiRequest(endpoint(`/contacts/${id}/schedule-meeting`), {
    method: "POST",
    body: JSON.stringify({
      meeting_subject: payload.meeting_subject,
      agenda: payload.agenda ?? "",
    }),
  });
}

export async function sendContactEmail(
  id: string,
  payload: { subject: string; body: string; to?: string }
): Promise<void> {
  await apiRequest(endpoint(`/contacts/${id}/send-email`), {
    method: "POST",
    body: JSON.stringify({
      subject: payload.subject,
      body: payload.body,
      to_email: payload.to ?? "",
    }),
  });
}

export async function getContactDeals(id: string): Promise<import("../shared/crmTypes").Deal[]> {
  try {
    const data = await apiRequest<any[]>(endpoint(`/contacts/${id}/deals`));
    return (Array.isArray(data) ? data : (data as any).results ?? []).map((item: any) => ({
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
