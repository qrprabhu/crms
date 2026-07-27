import { apiRequest } from "../api/client";
import { integrationsApi } from "../integrations/api";
import type { CRMRecord, SupportCaseRecord, SupportSolutionRecord } from "../lib/shared/crmTypes";
import type {
  CaseDetailData,
  CaseFormData,
  CaseListItem,
  SolutionDetailData,
  SolutionFormData,
  SolutionListItem,
  SupportImportJob,
  SupportLookupName,
  SupportLookupOption,
  SupportModuleKey,
} from "./types";
import { buildInitials, formatSupportDate, mapTimelineItems } from "./utils";
import { buildFlowTimeline } from "../lib/shared/timelineFlow";

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const modulePathMap: Record<SupportModuleKey, string> = {
  cases: "/support/cases",
  solutions: "/support/solutions",
};

function toList<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

function asString(value: unknown) {
  return value == null ? "" : String(value);
}

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stripHtmlPreview(value: unknown): string {
  return asString(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mapNote(parentId: string, item: any) {
  return {
    id: asString(item.id),
    parentId,
    title: asString(item.note).slice(0, 80) || "Note",
    content: asString(item.note),
    createdAt: asString(item.created_at),
    createdBy: asString(item.created_by_email),
  };
}

function mapComment(item: any) {
  return {
    id: asString(item.id),
    content: asString(item.comment),
    createdAt: asString(item.created_at),
    createdBy: asString(item.created_by_email),
  };
}

function mapAttachment(parentId: string, item: any) {
  return {
    id: asString(item.id),
    parentId,
    fileName: asString(item.original_name || item.file_name),
    fileType: asString(item.file_type),
    uploadedAt: asString(item.created_at),
    uploadedBy: asString(item.uploaded_by_email),
  };
}

function mapActivity(parentId: string, item: any) {
  return {
    id: asString(item.id),
    parentId,
    type: asString(item.action).toLowerCase().includes("call") ? "Call" : "Task",
    subject: asString(item.action),
    dueAt: asString(item.created_at),
    status: item.is_closed ? "Closed" : "Open",
  } as const;
}

function mapEmail(parentId: string, item: any) {
  const bodyText = asString(item.body || item.body_text).trim() || stripHtmlPreview(item.body_html);
  return {
    id: asString(item.id),
    parentId,
    subject: asString(item.subject),
    sentAt: asString(item.created_at),
    sentBy: asString(item.sent_by_email),
    status: "Sent" as const,
    previewText: bodyText,
    bodyText,
  };
}

function mapIntegrationEmail(parentId: string, item: any) {
  const direction = asString(item.direction).toLowerCase();
  const bodyText = asString(item.body_text).trim() || stripHtmlPreview(item.body_html);
  const previewText = asString(item.preview_text).trim() || bodyText;
  return {
    id: `integration-${asString(item.id)}`,
    parentId,
    subject: asString(item.subject) || "(No subject)",
    sentAt: asString(item.sent_at || item.received_at || item.created_at),
    sentBy: asString(item.counterparty_email || item.from_email),
    status: direction === "incoming" ? ("Received" as const) : ("Sent" as const),
    previewText,
    bodyText,
  };
}

function mapIntegrationTimeline(parentId: string, item: {
  id: string;
  type: "Email" | "Update";
  title: string;
  detail: string;
  at: string;
  by: string;
}) {
  return {
    id: item.id,
    parentId,
    type: item.type,
    title: item.title,
    detail: item.detail,
    at: item.at,
    by: item.by,
  } as const;
}

function mergeEmails(baseEmails: ReturnType<typeof mapEmail>[], integrationEmails: ReturnType<typeof mapIntegrationEmail>[]) {
  const seen = new Set<string>();
  return [...baseEmails, ...integrationEmails].filter((item) => {
    const key = `${item.subject}|${item.sentAt}|${item.sentBy}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mapConnectedRecord(parentId: string, item: any) {
  return {
    id: asString(item.id),
    parentId,
    recordType:
      (item.account ? "Account" : "") ||
      (item.contact ? "Contact" : "") ||
      (item.deal ? "Deal" : "") ||
      (item.product ? "Product" : "") ||
      (item.vendor ? "Vendor" : "") ||
      (item.lead ? "Lead" : "") ||
      "Record",
    name:
      asString(item.account_name) ||
      asString(item.contact_name) ||
      asString(item.deal_name) ||
      asString(item.product_name) ||
      asString(item.vendor_name) ||
      asString(item.lead_name),
    owner: "",
    status: asString(item.relationship_label),
  };
}

function mapCaseListItem(item: any): CaseListItem {
  return {
    id: asString(item.id),
    caseNumber: asString(item.case_number),
    subject: asString(item.subject),
    status: asString(item.status),
    priority: asString(item.priority),
    caseOrigin: asString(item.case_origin),
    caseReason: asString(item.case_reason),
    type: asString(item.type),
    relatedTo: asString(item.related_contact_name),
    accountName: asString(item.account_name),
    productName: asString(item.product_name),
    owner: asString(item.owner_email),
    company: asString(item.company),
    country: asString(item.country),
    email: asString(item.email),
    phone: asString(item.phone),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
    lastActivityAt: asString(item.last_activity_at),
  };
}

function mapSolutionListItem(item: any): SolutionListItem {
  return {
    id: asString(item.id),
    solutionNumber: asString(item.solution_number),
    solutionTitle: asString(item.solution_title),
    status: asString(item.status),
    question: asString(item.question),
    owner: asString(item.owner_email),
    productName: asString(item.product_name),
    noOfComments: asNumber(item.no_of_comments),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
    lastActivityAt: asString(item.last_activity_at),
  };
}

export async function getSupportList(moduleKey: SupportModuleKey): Promise<CRMRecord[]> {
  const payload = await apiRequest<any[] | Paginated<any>>(modulePathMap[moduleKey]);
  const items = toList(payload);
  return moduleKey === "cases"
    ? (items.map(mapCaseListItem) as SupportCaseRecord[])
    : (items.map(mapSolutionListItem) as SupportSolutionRecord[]);
}

export async function getCaseDetail(id: string): Promise<CaseDetailData> {
  const detail = await apiRequest<any>(`${modulePathMap.cases}/${id}`);
  const [integrationEmails, socialMessages] = await Promise.all([
    integrationsApi.listCaseRecordEmails(id).catch(() => []),
    integrationsApi.listSocialMessages({ support_case: id }).catch(() => []),
  ]);
  const relatedEmails = mergeEmails(
    (detail.emails || []).map((item: any) => mapEmail(id, item)),
    integrationEmails.map((item: any) => mapIntegrationEmail(id, item))
  );
  const relatedConnectedRecords = [
    ...(detail.linked_records || []).map((item: any) => mapConnectedRecord(id, item)),
  ].filter((item, index, list) => {
    const key = `${item.recordType}|${item.name}|${item.status}`;
    return list.findIndex((entry) => `${entry.recordType}|${entry.name}|${entry.status}` === key) === index;
  });
  const notes = (detail.notes || []).map((item: any) => mapNote(id, item));
  const attachments = (detail.attachments || []).map((item: any) => mapAttachment(id, item));
  const openActivities = (detail.open_activities || []).map((item: any) => mapActivity(id, item));
  const closedActivities = (detail.closed_activities || []).map((item: any) => mapActivity(id, item));

  return {
    id: asString(detail.id),
    caseNumber: asString(detail.case_number),
    subject: asString(detail.subject),
    subtitle: asString(detail.status || detail.case_origin),
    avatar: buildInitials(asString(detail.subject || detail.case_number)),
    summary: [
      { label: "Case Number", value: asString(detail.case_number) },
      { label: "Status", value: asString(detail.status) || "-" },
      { label: "Priority", value: asString(detail.priority) || "-" },
      { label: "Owner", value: asString(detail.owner_email) || "-" },
      { label: "Updated", value: formatSupportDate(detail.updated_at) },
    ],
    caseInformation: [
      { label: "Product Name", value: asString(detail.product_name) || "-" },
      { label: "Type", value: asString(detail.type) || "-" },
      { label: "Case Origin", value: asString(detail.case_origin) || "-" },
      { label: "Related To", value: asString(detail.related_contact_name) || "-" },
      { label: "Account Name", value: asString(detail.account_name) || "-" },
      { label: "Deal Name", value: asString(detail.deal_name) || "-" },
      { label: "Phone", value: asString(detail.phone) || "-" },
      { label: "Lead Name", value: asString(detail.lead_name) || "-" },
      { label: "Lead Source", value: asString(detail.lead_source) || "-" },
      { label: "Case Owner", value: asString(detail.owner_email) || "-" },
      { label: "Case Reason", value: asString(detail.case_reason) || "-" },
      { label: "Reported By", value: asString(detail.reported_by) || "-" },
      { label: "Email", value: asString(detail.email) || "-" },
      { label: "Company", value: asString(detail.company) || "-" },
      { label: "Country", value: asString(detail.country) || "-" },
    ],
    descriptionInformation: [
      { label: "Description", value: asString(detail.description) || "-" },
      { label: "Internal Comments", value: asString(detail.internal_comments) || "-" },
    ],
    solutionInformation: [{ label: "Solution", value: asString(detail.solution_text) || "-" }],
    commentInformation: [{ label: "Comments", value: String(asNumber(detail.no_of_comments)) }],
    timeline: buildFlowTimeline({
      existing: [
        ...mapTimelineItems(detail.timeline || []),
        ...socialMessages.map((item: any) =>
          mapIntegrationTimeline(id, {
            id: `social-${asString(item.id)}`,
            type: "Update",
            title: `${asString(item.platform)} message`,
            detail: asString(item.message),
            at: asString(item.created_at_source || item.created_at),
            by: asString(item.sender_name || item.sender_email),
          })
        ),
      ],
      notes,
      attachments,
      openActivities,
      closedActivities,
      emails: relatedEmails,
    }),
    related: {
      notes,
      comments: (detail.comments || []).map(mapComment),
      attachments,
      emails: relatedEmails,
      connectedRecords: relatedConnectedRecords,
      openActivities,
      closedActivities,
      links: [],
    },
  };
}

export async function getCaseSnapshot(id: string) {
  return apiRequest<any>(`${modulePathMap.cases}/${id}`);
}

export async function getSolutionDetail(id: string): Promise<SolutionDetailData> {
  const detail = await apiRequest<any>(`${modulePathMap.solutions}/${id}`);
  const notes = (detail.notes || []).map((item: any) => mapNote(id, item));
  const attachments = (detail.attachments || []).map((item: any) => mapAttachment(id, item));
  return {
    id: asString(detail.id),
    solutionNumber: asString(detail.solution_number),
    solutionTitle: asString(detail.solution_title),
    subtitle: asString(detail.status),
    avatar: buildInitials(asString(detail.solution_title || detail.solution_number)),
    summary: [
      { label: "Solution Number", value: asString(detail.solution_number) },
      { label: "Status", value: asString(detail.status) || "-" },
      { label: "Owner", value: asString(detail.owner_email) || "-" },
      { label: "Product", value: asString(detail.product_name) || "-" },
      { label: "No. of Comments", value: String(asNumber(detail.no_of_comments)) },
    ],
    solutionInformation: [
      { label: "Solution Number", value: asString(detail.solution_number) },
      { label: "Solution Title", value: asString(detail.solution_title) },
      { label: "Solution Owner", value: asString(detail.owner_email) || "-" },
      { label: "Source Case", value: asString(detail.source_case_number) || "-" },
      { label: "Product Name", value: asString(detail.product_name) || "-" },
      { label: "Status", value: asString(detail.status) || "-" },
      { label: "Created By", value: asString(detail.created_by) || "-" },
      { label: "Modified By", value: asString(detail.updated_by) || "-" },
    ],
    descriptionInformation: [
      { label: "Question", value: asString(detail.question) || "-" },
      { label: "Solution Answer", value: asString(detail.answer) || "-" },
      { label: "Steps to Resolve", value: asString(detail.resolution_steps) || "-" },
    ],
    commentInformation: [{ label: "Comments", value: String(asNumber(detail.no_of_comments)) }],
    timeline: buildFlowTimeline({
      existing: mapTimelineItems(detail.timeline || []),
      notes,
      attachments,
    }),
    related: {
      notes,
      comments: (detail.comments || []).map(mapComment),
      attachments,
      emails: [],
      connectedRecords: (detail.linked_records || []).map((item: any) => mapConnectedRecord(id, item)),
      openActivities: [],
      closedActivities: [],
      links: [],
    },
  };
}

export async function findExistingSolutionByCase(caseId: string) {
  const payload = await apiRequest<any[] | { results?: any[] }>(modulePathMap.solutions, {
    query: { source_case: caseId, page_size: "1" },
  });
  const first = Array.isArray(payload) ? payload[0] : payload.results?.[0];
  return first ? { id: asString(first.id) } : null;
}

function casePayload(values: CaseFormData) {
  return {
    subject: values.subject,
    status: values.status,
    priority: values.priority,
    case_origin: values.caseOrigin,
    case_reason: values.caseReason,
    type: values.type,
    description: values.description,
    internal_comments: values.internalComments,
    solution_text: values.solutionText,
    reported_by: values.reportedBy,
    email: values.email,
    company: values.company,
    country: values.country,
    phone: values.phone,
    lead: values.lead ? Number(values.lead) : undefined,
    lead_name: values.leadName,
    lead_source: values.leadSource,
    owner: values.owner ? Number(values.owner) : undefined,
    product: values.product ? Number(values.product) : undefined,
    related_contact: values.relatedContact ? Number(values.relatedContact) : undefined,
    account: values.account ? Number(values.account) : undefined,
    deal: values.deal ? Number(values.deal) : undefined,
  };
}

function solutionPayload(values: SolutionFormData) {
  return {
    solution_title: values.solutionTitle,
    status: values.status,
    question: values.question,
    answer: values.answer,
    resolution_steps: values.resolutionSteps,
    owner: values.owner ? Number(values.owner) : undefined,
    source_case: values.sourceCase ? Number(values.sourceCase) : undefined,
    product: values.product ? Number(values.product) : undefined,
  };
}

export async function createCase(values: CaseFormData) {
  const data = await apiRequest<any>(modulePathMap.cases, {
    method: "POST",
    body: JSON.stringify(casePayload(values)),
  });
  return { id: asString(data.id) };
}

export async function updateCase(id: string, values: CaseFormData) {
  const data = await apiRequest<any>(`${modulePathMap.cases}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(casePayload(values)),
  });
  return { id: asString(data.id) };
}

export async function createSolution(values: SolutionFormData) {
  const data = await apiRequest<any>(modulePathMap.solutions, {
    method: "POST",
    body: JSON.stringify(solutionPayload(values)),
  });
  return { id: asString(data.id) };
}

export async function updateSolution(id: string, values: SolutionFormData) {
  const data = await apiRequest<any>(`${modulePathMap.solutions}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(solutionPayload(values)),
  });
  return { id: asString(data.id) };
}

export async function fetchSupportLookup(lookup: SupportLookupName, query: string): Promise<SupportLookupOption[]> {
  const data = await apiRequest<any[]>(`/support/lookups/${lookup}`, {
    query: { q: query },
  });
  return data.map((item) => ({
    id: asString(item.id),
    name: asString(item.name),
    label: asString(item.label || item.name),
    email: item.email ? asString(item.email) : undefined,
    phone: item.phone ? asString(item.phone) : undefined,
    accountId: item.account_id ? asString(item.account_id) : undefined,
    accountName: item.account_name ? asString(item.account_name) : undefined,
    dealId: item.deal_id ? asString(item.deal_id) : undefined,
    dealName: item.deal_name ? asString(item.deal_name) : undefined,
    productCode: item.product_code ? asString(item.product_code) : undefined,
    unitPrice: item.unit_price == null ? undefined : asNumber(item.unit_price),
    source: item.lead_source ? asString(item.lead_source) : undefined,
  }));
}

export async function quickCreateProduct(payload: {
  productName: string;
  productCode: string;
  vendor?: string;
  unitPrice?: number;
  tax?: number;
}) {
  const data = await apiRequest<any>("/support/products/quick-create", {
    method: "POST",
    body: JSON.stringify({
      product_name: payload.productName,
      product_code: payload.productCode,
      vendor: payload.vendor ? Number(payload.vendor) : undefined,
      unit_price: payload.unitPrice ?? 0,
      tax: payload.tax ?? 0,
    }),
  });
  return {
    id: asString(data.id),
    name: asString(data.name),
    label: asString(data.label || data.name),
    productCode: asString(data.product_code),
    unitPrice: asNumber(data.unit_price),
  };
}

export async function addSupportNote(moduleKey: SupportModuleKey, id: string, note: string) {
  return apiRequest(`${modulePathMap[moduleKey]}/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function addSupportComment(moduleKey: SupportModuleKey, id: string, comment: string) {
  return apiRequest(`${modulePathMap[moduleKey]}/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export async function addSupportAttachment(moduleKey: SupportModuleKey, id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest(`${modulePathMap[moduleKey]}/${id}/attachments`, {
    method: "POST",
    body: formData,
  });
}

export async function uploadSupportImport(
  moduleKey: SupportModuleKey,
  file: File,
  operation: string,
  duplicateCheckField: string
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("operation", operation);
  formData.append("duplicate_check_field", duplicateCheckField);
  const data = await apiRequest<any>(`${modulePathMap[moduleKey]}/import/upload`, {
    method: "POST",
    body: formData,
  });
  return mapImportJob(data);
}

export async function inspectSupportImport(moduleKey: SupportModuleKey, jobId: string) {
  return apiRequest<any>(`${modulePathMap[moduleKey]}/import/inspect`, {
    method: "POST",
    body: JSON.stringify({ job_id: Number(jobId) }),
  });
}

export async function executeSupportImport(
  moduleKey: SupportModuleKey,
  payload: {
    jobId: string;
    operation: string;
    duplicateCheckField: string;
    fieldMapping: Record<string, string>;
    defaultValues: Record<string, string>;
    automationEnabled: boolean;
  }
) {
  const data = await apiRequest<any>(`${modulePathMap[moduleKey]}/import/execute`, {
    method: "POST",
    body: JSON.stringify({
      job_id: Number(payload.jobId),
      operation: payload.operation,
      duplicate_check_field: payload.duplicateCheckField,
      field_mapping: payload.fieldMapping,
      default_values: payload.defaultValues,
      automation_enabled: payload.automationEnabled,
    }),
  });
  return mapImportJob(data);
}

export async function getSupportImportStatus(moduleKey: SupportModuleKey, jobId: string) {
  const data = await apiRequest<any>(`${modulePathMap[moduleKey]}/import/status/${jobId}`);
  return mapImportJob(data);
}

function mapImportJob(item: any): SupportImportJob {
  return {
    id: asString(item.id),
    moduleType: asString(item.module_type) as SupportModuleKey,
    originalName: asString(item.original_name),
    fileType: asString(item.file_type),
    operation: asString(item.operation),
    duplicateCheckField: asString(item.duplicate_check_field),
    status: asString(item.status),
    headers: item.headers || [],
    sampleRows: item.sample_rows || [],
    fieldMapping: item.field_mapping || {},
    defaultValues: item.default_values || {},
    automationEnabled: Boolean(item.automation_enabled),
    importedCount: asNumber(item.imported_count),
    updatedCount: asNumber(item.updated_count),
    skippedCount: asNumber(item.skipped_count),
    errorCount: asNumber(item.error_count),
    validationErrors: item.validation_errors || [],
    resultSummary: item.result_summary || {},
  };
}
