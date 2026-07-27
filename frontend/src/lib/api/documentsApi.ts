import { apiRequest } from "../../api/client";

// ── Types ──────────────────────────────────────────────────────────────────

export type DocumentType =
  | "portfolio"
  | "requirement"
  | "presentation"
  | "meeting_notes"
  | "contract"
  | "other";

export type RelatedModule = "lead" | "contact" | "deal" | "project" | "";

export type DocumentVersion = {
  id: number;
  version_number: number;
  file_url: string | null;
  file_name: string | null;
  uploaded_at: string;
};

export type DocumentRecord = {
  id: string;
  title: string;
  description: string | null;
  document_type: DocumentType;
  related_module: RelatedModule;
  related_id: number | null;
  uploaded_by: number | null;
  uploaded_by_email: string | null;
  uploaded_by_name?: string | null;
  file_url: string | null;
  file_name: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  versions?: DocumentVersion[];
};

export type DocumentFilters = {
  document_type?: DocumentType | "";
  related_module?: RelatedModule;
  related_id?: number | string;
  search?: string;
};

export type DocumentUploadPayload = {
  title: string;
  description?: string;
  file: File;
  document_type: DocumentType;
  related_module?: RelatedModule;
  related_id?: number | string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  portfolio: "Portfolio",
  requirement: "Requirement",
  presentation: "Presentation",
  meeting_notes: "Meeting Notes",
  contract: "Contract",
  other: "Other",
};

export const MODULE_LABELS: Record<string, string> = {
  lead: "Lead",
  contact: "Contact",
  deal: "Deal",
  project: "Project",
  "": "—",
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

function toList<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

// ── API Functions ──────────────────────────────────────────────────────────

export async function getDocuments(filters?: DocumentFilters): Promise<DocumentRecord[]> {
  const query: Record<string, string> = {};
  if (filters?.document_type) query.document_type = filters.document_type;
  if (filters?.related_module) query.related_module = filters.related_module;
  if (filters?.related_id) query.related_id = String(filters.related_id);
  if (filters?.search) query.search = filters.search;

  const data = await apiRequest<DocumentRecord[] | Paginated<DocumentRecord>>("/documents/", {
    query,
  });
  return toList(data);
}

export async function getDocumentById(id: string): Promise<DocumentRecord> {
  return apiRequest<DocumentRecord>(`/documents/${id}/`);
}

export async function uploadDocument(payload: DocumentUploadPayload): Promise<DocumentRecord> {
  const form = new FormData();
  form.append("title", payload.title);
  form.append("file", payload.file);
  form.append("document_type", payload.document_type);
  if (payload.description) form.append("description", payload.description);
  if (payload.related_module) form.append("related_module", payload.related_module);
  if (payload.related_id != null) form.append("related_id", String(payload.related_id));

  return apiRequest<DocumentRecord>("/documents/", { method: "POST", body: form });
}

export async function updateDocument(
  id: string,
  payload: Partial<Omit<DocumentUploadPayload, "file">> & { file?: File }
): Promise<DocumentRecord> {
  const form = new FormData();
  if (payload.title != null) form.append("title", payload.title);
  if (payload.description != null) form.append("description", payload.description);
  if (payload.document_type) form.append("document_type", payload.document_type);
  if (payload.related_module != null) form.append("related_module", payload.related_module);
  if (payload.related_id != null) form.append("related_id", String(payload.related_id));
  if (payload.file) form.append("file", payload.file);

  return apiRequest<DocumentRecord>(`/documents/${id}/`, { method: "PATCH", body: form });
}

export async function deleteDocument(id: string): Promise<void> {
  await apiRequest<void>(`/documents/${id}/`, { method: "DELETE" });
}

export async function getDocumentVersions(id: string): Promise<DocumentVersion[]> {
  return apiRequest<DocumentVersion[]>(`/documents/${id}/versions/`);
}
