import { apiRequest } from "../../api/client";
import { integrationsApi } from "../../integrations/api";
import { getLeadConnectedRecords } from "./leadsApi";
import type {
  Activity,
  AccountRecord,
  Attachment,
  Case,
  Deal,
  Note,
  Quote,
  SalesOrder,
  PurchaseOrder,
  Invoice,
  Solution,
  TimelineItem,
  ConnectedRecord,
  EmailRecord,
  LeadRecord,
  Meeting,
  Product,
} from "../shared/crmTypes";
import { buildFlowTimeline } from "../shared/timelineFlow";
import type { IntegrationLeadSourceEvent, SalesInboxFeedItem, SocialMessage, VisitorLeadEvent } from "../../integrations/types";

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type LinkedDataResult = {
  notes: Note[];
  deals: Deal[];
  openActivities: Activity[];
  closedActivities: Activity[];
  meetings: Meeting[];
  products: Product[];
  emails: EmailRecord[];
  attachments: Attachment[];
  connectedRecords: ConnectedRecord[];
  cases: Case[];
  solutions: Solution[];
  contacts?: Array<{ id: string; name: string; email?: string; phone?: string }>;
  accounts?: Array<{ id: string; name: string; industry?: string; phone?: string }>;
  quotes: Quote[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  timeline: TimelineItem[];
};

const LINKED_DATA_CACHE_TTL_MS = 120_000;
const linkedDataCache = new Map<string, { expiresAt: number; value: unknown }>();

type TimelineDto = {
  id: number | string;
  action?: string;
  description?: string;
  user?: string | null;
  timestamp?: string;
};

type AttachmentDto = {
  id: number | string;
  file?: string;
  uploaded_by_email?: string | null;
  created_at?: string;
};

type AccountContactDto = {
  id: number | string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
};

type AccountDealDto = {
  id: number | string;
  name?: string;
  stage?: string | null;
  value?: number | string | null;
  amount?: number | string | null;
  created_at?: string;
};

type SupportCaseDto = {
  id: number | string;
  case_number?: string;
  subject?: string;
  status?: string;
  priority?: string;
  product?: number | string | null;
  product_name?: string | null;
  created_at?: string;
};

type SupportSolutionDto = {
  id: number | string;
  solution_number?: string;
  solution_title?: string;
  status?: string;
  product?: number | string | null;
  product_name?: string | null;
  created_at?: string;
};

type InventoryQuoteDto = {
  id: number | string;
  subject?: string;
  quote_stage?: string | null;
  grand_total?: number | string | null;
  created_at?: string;
};

type InventorySalesOrderDto = {
  id: number | string;
  subject?: string;
  customer_no?: string | null;
  status?: string | null;
  grand_total?: number | string | null;
  created_at?: string;
};

type InventoryPurchaseOrderDto = {
  id: number | string;
  po_number?: string | null;
  subject?: string;
  status?: string | null;
  grand_total?: number | string | null;
  created_at?: string;
};

type InventoryInvoiceDto = {
  id: number | string;
  subject?: string;
  status?: string | null;
  grand_total?: number | string | null;
  created_at?: string;
};

type ServiceAppointmentDto = {
  id: number | string;
  appointment_number?: string;
  service_name?: string;
  appointment_date?: string;
  appointment_for_display?: string;
  sales_order_subject?: string;
  invoice_subject?: string;
  status?: string | null;
};

type ServiceJobSheetDto = {
  id: number | string;
  title?: string;
  service_name?: string;
  appointment?: number | string;
  status?: string | null;
};

function toList<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

function getCachedLinkedData<T>(key: string): T | null {
  const cached = linkedDataCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    linkedDataCache.delete(key);
    return null;
  }
  return cached.value as T;
}

function setCachedLinkedData<T>(key: string, value: T) {
  linkedDataCache.set(key, {
    value,
    expiresAt: Date.now() + LINKED_DATA_CACHE_TTL_MS,
  });
}

export function invalidateLinkedDataCache(keyPrefix: string) {
  for (const key of linkedDataCache.keys()) {
    if (key === keyPrefix || key.startsWith(`${keyPrefix}:`)) {
      linkedDataCache.delete(key);
    }
  }
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stripHtmlPreview(value: unknown): string {
  return asString(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mapTimeline(parentId: string, item: TimelineDto): TimelineItem {
  return {
    id: asString(item.id),
    parentId,
    type: "Update",
    title: asString(item.action) || "Update",
    detail: asString(item.description),
    at: asString(item.timestamp),
    by: asString(item.user),
  };
}

function mapAttachment(parentId: string, item: AttachmentDto): Attachment {
  const fileName = asString(item.file).split("/").pop() || "Attachment";
  return {
    id: asString(item.id),
    parentId,
    fileName,
    fileType: fileName.includes(".") ? fileName.split(".").pop() || "" : "",
    uploadedAt: asString(item.created_at),
    uploadedBy: asString(item.uploaded_by_email),
  };
}

function mapCase(parentId: string, item: SupportCaseDto): Case {
  return {
    id: asString(item.id),
    parentId,
    caseNumber: asString(item.case_number),
    subject: asString(item.subject),
    status: asString(item.status),
    priority: asString(item.priority),
    createdAt: asString(item.created_at),
  };
}

function mapSolution(parentId: string, item: SupportSolutionDto): Solution {
  return {
    id: asString(item.id),
    parentId,
    solutionNumber: asString(item.solution_number),
    solutionTitle: asString(item.solution_title),
    status: asString(item.status),
    createdAt: asString(item.created_at),
  };
}

function deriveSupportProducts(
  parentId: string,
  cases: SupportCaseDto[],
  solutions: SupportSolutionDto[]
): Product[] {
  const seen = new Set<string>();
  const products: Product[] = [];

  const pushProduct = (productId: unknown, productName: unknown) => {
    const id = asString(productId);
    const name = asString(productName);
    if (!id || !name) return;
    if (seen.has(id)) return;
    seen.add(id);
    products.push({
      id,
      parentId,
      productId: id,
      productName: name,
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      amount: 0,
      total: 0,
      createdAt: "",
    });
  };

  cases.forEach((item) => pushProduct(item.product, item.product_name));
  solutions.forEach((item) => pushProduct(item.product, item.product_name));

  return products;
}

function mapQuote(parentId: string, item: InventoryQuoteDto): Quote {
  const quoteName = asString(item.subject) || "Quote";
  const status = asString(item.quote_stage) || "Status not set";
  return {
    id: asString(item.id),
    parentId,
    quoteName,
    amount: asNumber(item.grand_total),
    status,
    createdAt: asString(item.created_at),
  };
}

function mapSalesOrder(parentId: string, item: InventorySalesOrderDto): SalesOrder {
  const orderNumber = asString(item.customer_no) || asString(item.subject) || "Sales Order";
  const status = asString(item.status) || "Status not set";
  return {
    id: asString(item.id),
    parentId,
    orderNumber,
    amount: asNumber(item.grand_total),
    status,
    createdAt: asString(item.created_at),
  };
}

function mapPurchaseOrder(parentId: string, item: InventoryPurchaseOrderDto): PurchaseOrder {
  const poNumber = asString(item.po_number) || asString(item.subject) || "Purchase Order";
  const status = asString(item.status) || "Status not set";
  return {
    id: asString(item.id),
    parentId,
    poNumber,
    amount: asNumber(item.grand_total),
    status,
    createdAt: asString(item.created_at),
  };
}

function mapInvoice(parentId: string, item: InventoryInvoiceDto): Invoice {
  const invoiceNumber = asString(item.subject) || "Invoice";
  const status = asString(item.status) || "Status not set";
  return {
    id: asString(item.id),
    parentId,
    invoiceNumber,
    amount: asNumber(item.grand_total),
    status,
    createdAt: asString(item.created_at),
  };
}

function mapIntegrationEmail(parentId: string, item: SalesInboxFeedItem): EmailRecord {
  const direction = asString(item.direction).toLowerCase();
  const bodyText = asString(item.body_text).trim() || stripHtmlPreview(item.body_html);
  const previewText = asString(item.preview_text).trim() || bodyText;
  return {
    id: asString(item.id),
    parentId,
    subject: asString(item.subject),
    sentAt: asString(item.sent_at || item.received_at),
    sentBy: asString(item.counterparty_email || item.from_email),
    status: item.status === "draft" ? "Draft" : direction === "incoming" ? "Received" : "Sent",
    previewText,
    bodyText,
  };
}

function excludeSupportCaseEmails(items: SalesInboxFeedItem[]) {
  return items.filter((item) => !item.support_case_id);
}

async function loadRecordEmailsWithFallback(
  filters: { lead?: string; contact?: string; account?: string; deal?: string },
  primaryLoader: () => Promise<SalesInboxFeedItem[]>,
  options?: { excludeSupportLinked?: boolean; disableFallback?: boolean }
) {
  const primaryItems = await primaryLoader().catch(() => []);
  const filteredPrimaryItems = options?.excludeSupportLinked ? excludeSupportCaseEmails(primaryItems) : primaryItems;
  if (filteredPrimaryItems.length || options?.disableFallback) {
    return filteredPrimaryItems;
  }
  const fallbackItems = await integrationsApi.listSyncedEmailMessages(filters).catch(() => []);
  return options?.excludeSupportLinked ? excludeSupportCaseEmails(fallbackItems) : fallbackItems;
}

function dedupeSalesInboxItems(items: SalesInboxFeedItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${asString(item.id)}|${asString(item.subject)}|${asString(item.from_email)}|${asString(item.sent_at || item.received_at)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mapIntegrationSourceEvent(parentId: string, item: IntegrationLeadSourceEvent): ConnectedRecord {
  const sourceType = asString(item.source_type).toLowerCase();
  let status = asString(item.status);

  if (sourceType === "email" && status.toLowerCase() === "processed") {
    status = "Received";
  } else if ((sourceType === "social" || sourceType.includes("message")) && status.toLowerCase() === "processed") {
    status = "Linked";
  } else if (sourceType.includes("visitor") && status.toLowerCase() === "processed") {
    status = "Captured";
  }

  return {
    id: asString(item.id),
    parentId,
    recordType: asString(item.source_type).replace(/_/g, " "),
    name: asString(item.source_label || item.source_reference),
    owner: asString(item.lead_name || item.contact_name || item.account_name || item.deal_name || item.support_case_name || "-"),
    status,
  };
}

function filterOutEmailConnectedRecords(items: ConnectedRecord[]) {
  return items.filter((item) => item.recordType.trim().toLowerCase() !== "email");
}

function mapSocialMessage(parentId: string, item: SocialMessage): ConnectedRecord {
  return {
    id: `social-${asString(item.id)}`,
    parentId,
    recordType: `${asString(item.platform || "social")} message`,
    name: asString(item.sender_name || item.profile_handle || item.sender_email || "Social message"),
    owner: asString(item.account_name || item.contact_name || item.lead_name || item.support_case_name || "-"),
    status: "Linked",
  };
}

function mapVisitorEvent(parentId: string, item: VisitorLeadEvent): ConnectedRecord {
  return {
    id: `visitor-${asString(item.id)}`,
    parentId,
    recordType: "website visit",
    name: asString(item.page_url || item.source_url || item.event_type || "Visitor event"),
    owner: asString(item.linked_contact_name || item.linked_lead_name || item.identified_email || item.visitor_email || "-"),
    status: item.converted_to_lead ? "Converted" : "Captured",
  };
}

function mapIntegrationTimeline(parentId: string, item: {
  id: string | number;
  type: "Email" | "Update";
  title: string;
  detail: string;
  at?: string | null;
  by?: string | null;
}): TimelineItem {
  return {
    id: asString(item.id),
    parentId,
    type: item.type,
    title: item.title,
    detail: item.detail,
    at: asString(item.at),
    by: asString(item.by),
  };
}

function mapServiceAppointment(parentId: string, item: ServiceAppointmentDto): ConnectedRecord {
  return {
    id: `service-appointment-${asString(item.id)}`,
    parentId,
    recordType: "Service Appointment",
    name: asString(item.appointment_number) || "Appointment",
    owner: asString(item.service_name),
    status: [
      asString(item.status),
      asString(item.appointment_for_display),
      asString(item.appointment_date),
    ]
      .filter(Boolean)
      .join(" | "),
    meta: [asString(item.sales_order_subject), asString(item.invoice_subject)].filter(Boolean).join(" | "),
    route: `/services/appointments/${asString(item.id)}`,
  };
}

function mapServiceJobSheet(parentId: string, item: ServiceJobSheetDto): ConnectedRecord {
  return {
    id: `service-job-sheet-${asString(item.id)}`,
    parentId,
    recordType: "Service Job Sheet",
    name: asString(item.title) || "Job Sheet",
    owner: asString(item.service_name),
    status: asString(item.status),
    meta: asString(item.appointment) ? `Appointment ${asString(item.appointment)}` : "",
    route: `/services/job-sheets/${asString(item.id)}`,
  };
}

async function fetchList<T>(path: string, query?: Record<string, string | number | boolean | undefined | null>) {
  const data = await apiRequest<T[] | Paginated<T>>(path, { query });
  return toList(data);
}

async function fetchServiceConnectedRecords(parentId: string, entityType: "lead" | "contact" | "account" | "deal", entityId: string) {
  const [appointments, jobSheets] = await Promise.all([
    fetchList<ServiceAppointmentDto>("/services/appointments/", {
      appointment_for_type: entityType,
      appointment_for_id: entityId,
    }).catch(() => []),
    fetchList<ServiceJobSheetDto>("/services/job-sheets/", {
      customer_type: entityType,
      customer_id: entityId,
    }).catch(() => []),
  ]);

  return [
    ...appointments.map((item) => mapServiceAppointment(parentId, item)),
    ...jobSheets.map((item) => mapServiceJobSheet(parentId, item)),
  ];
}

export async function loadAccountLinkedData(account: AccountRecord, options?: { forceRefresh?: boolean }): Promise<LinkedDataResult> {
  const cacheKey = `account:${account.id}`;
  const cached: LinkedDataResult | null = options?.forceRefresh ? null : getCachedLinkedData<LinkedDataResult>(cacheKey);
  if (cached) return cached;

  const [contacts, deals, quotes, salesOrders, invoices, cases, solutions, timeline, attachments, emails, sourceEvents, socialMessages] = await Promise.all([
    apiRequest<AccountContactDto[]>(`/accounts/${account.id}/contacts`).catch(() => []),
    apiRequest<AccountDealDto[]>(`/accounts/${account.id}/deals`).catch(() => []),
    fetchList<InventoryQuoteDto>("/inventory/quotes", { account: account.id }).catch(() => []),
    fetchList<InventorySalesOrderDto>("/inventory/sales-orders", { account: account.id }).catch(() => []),
    fetchList<InventoryInvoiceDto>("/inventory/invoices", { account: account.id }).catch(() => []),
    fetchList<SupportCaseDto>("/support/cases", { account: account.id }).catch(() => []),
    fetchList<SupportSolutionDto>("/support/solutions", { account: account.id }).catch(() => []),
    apiRequest<TimelineDto[]>(`/accounts/${account.id}/timeline`).catch(() => []),
    apiRequest<AttachmentDto[]>(`/accounts/${account.id}/attachments`).catch(() => []),
    loadRecordEmailsWithFallback({ account: account.id }, () => integrationsApi.listAccountRecordEmails(account.id), { excludeSupportLinked: true, disableFallback: true }),
    integrationsApi.listLeadSourceEvents({ account: account.id }).catch(() => []),
    integrationsApi.listSocialMessages({ account: account.id }).catch(() => []),
  ]);
  const mergedEmails = dedupeSalesInboxItems(excludeSupportCaseEmails(emails || []));

  const integrationConnectedRecords = [
    ...sourceEvents.map((item) => mapIntegrationSourceEvent(account.id, item)),
    ...socialMessages.map((item) => mapSocialMessage(account.id, item)),
  ];

  const serviceConnectedRecords = await fetchServiceConnectedRecords(account.id, "account", account.id).catch(() => []);

  const dedupedConnectedRecords = filterOutEmailConnectedRecords(
    [...integrationConnectedRecords, ...serviceConnectedRecords]
  ).filter((item, index, list) => {
    const key = `${item.recordType}|${item.name}|${item.status}`;
    return list.findIndex((entry) => `${entry.recordType}|${entry.name}|${entry.status}` === key) === index;
  });

  const result = {
    notes: [] as Note[],
    deals: deals.map((item) => ({
      id: asString(item.id),
      parentId: account.id,
      dealName: asString(item.name),
      amount: asNumber(item.amount ?? item.value),
      stage: asString(item.stage),
      probability: 0,
      closingDate: "",
      type: "",
    })),
    openActivities: [],
    closedActivities: [],
    meetings: [],
    products: deriveSupportProducts(account.id, cases, solutions),
    emails: mergedEmails.map((item) => mapIntegrationEmail(account.id, item)),
    attachments: attachments.map((item) => mapAttachment(account.id, item)),
    connectedRecords: dedupedConnectedRecords,
    cases: cases.map((item) => mapCase(account.id, item)),
    solutions: solutions.map((item) => mapSolution(account.id, item)),
    contacts: contacts.map((item) => ({
      id: asString(item.id),
      name: `${asString(item.first_name)} ${asString(item.last_name)}`.trim(),
      email: item.email ? asString(item.email) : undefined,
      phone: item.phone ? asString(item.phone) : undefined,
    })),
    accounts: [],
    quotes: quotes.map((item) => mapQuote(account.id, item)),
    salesOrders: salesOrders.map((item) => mapSalesOrder(account.id, item)),
    purchaseOrders: [],
    invoices: invoices.map((item) => mapInvoice(account.id, item)),
      timeline: buildFlowTimeline({
        existing: [
          ...timeline.map((item) => mapTimeline(account.id, item)),
          ...socialMessages.map((item) =>
            mapIntegrationTimeline(account.id, {
              id: `social-${item.id}`,
              type: "Update",
              title: `${item.platform} message`,
              detail: item.message,
              at: item.created_at_source || item.created_at,
              by: item.sender_name || item.sender_email,
            })
          ),
          ...sourceEvents.map((item) =>
            mapIntegrationTimeline(account.id, {
              id: `source-${item.id}`,
              type: "Update",
              title: asString(item.source_type).replace(/_/g, " "),
              detail: asString(item.source_label || item.source_reference),
              at: item.created_at,
              by: item.contact_name || item.lead_name || item.account_name || item.support_case_name,
            })
          ),
        ],
        emails: mergedEmails.map((item) => mapIntegrationEmail(account.id, item)),
        attachments: attachments.map((item) => mapAttachment(account.id, item)),
        cases: cases.map((item) => mapCase(account.id, item)),
        solutions: solutions.map((item) => mapSolution(account.id, item)),
        quotes: quotes.map((item) => mapQuote(account.id, item)),
        salesOrders: salesOrders.map((item) => mapSalesOrder(account.id, item)),
        invoices: invoices.map((item) => mapInvoice(account.id, item)),
        products: deriveSupportProducts(account.id, cases, solutions),
      }),
  };
  setCachedLinkedData(cacheKey, result);
  return result;
}

export async function loadLeadLinkedData(lead: LeadRecord, options?: { forceRefresh?: boolean }): Promise<LinkedDataResult> {
  const cacheKey = `lead:${lead.id}`;
  const cached: LinkedDataResult | null = options?.forceRefresh ? null : getCachedLinkedData<LinkedDataResult>(cacheKey);
  if (cached) return cached;

  const [emails, connectedRecords, socialMessages, visitorEvents, serviceConnectedRecords, cases, solutions] = await Promise.all([
    loadRecordEmailsWithFallback({ lead: lead.id }, () => integrationsApi.listLeadRecordEmails(lead.id), { excludeSupportLinked: true, disableFallback: true }),
    getLeadConnectedRecords(lead.id).catch(() => []),
    integrationsApi.listSocialMessages({ lead: lead.id }).catch(() => []),
    integrationsApi.listVisitorEvents({ lead: lead.id }).catch(() => []),
    fetchServiceConnectedRecords(lead.id, "lead", lead.id).catch(() => []),
    fetchList<SupportCaseDto>("/support/cases", { lead: lead.id }).catch(() => []),
    fetchList<SupportSolutionDto>("/support/solutions", { lead: lead.id }).catch(() => []),
  ]);
  const mergedEmails = dedupeSalesInboxItems(excludeSupportCaseEmails(emails || []));

  const result = {
    notes: [] as Note[],
    deals: [] as Deal[],
    openActivities: [],
    closedActivities: [],
    meetings: [],
    products: [],
    emails: mergedEmails.map((item) => mapIntegrationEmail(lead.id, item)),
    attachments: [] as Attachment[],
    connectedRecords: [
      ...filterOutEmailConnectedRecords(connectedRecords),
      ...socialMessages.map((item) => mapSocialMessage(lead.id, item)),
      ...visitorEvents.map((item) => mapVisitorEvent(lead.id, item)),
      ...serviceConnectedRecords,
    ],
    cases: cases.map((item) => mapCase(lead.id, item)),
    solutions: solutions.map((item) => mapSolution(lead.id, item)),
    contacts: [],
    accounts: [],
    quotes: [] as Quote[],
    salesOrders: [] as SalesOrder[],
    purchaseOrders: [] as PurchaseOrder[],
    invoices: [] as Invoice[],
      timeline: buildFlowTimeline({
        existing: [
          ...socialMessages.map((item) =>
            mapIntegrationTimeline(lead.id, {
              id: `social-${item.id}`,
              type: "Update",
              title: `${item.platform} message`,
              detail: item.message,
              at: item.created_at_source || item.created_at,
              by: item.sender_name || item.sender_email,
            })
          ),
          ...visitorEvents.map((item) =>
            mapIntegrationTimeline(lead.id, {
              id: `visitor-${item.id}`,
              type: "Update",
              title: "Website activity",
              detail: asString(item.page_url || item.source_url || item.event_type),
              at: item.created_at,
              by: item.identified_email || item.visitor_email || item.visitor_name,
            })
          ),
        ],
        emails: mergedEmails.map((item) => mapIntegrationEmail(lead.id, item)),
        cases: cases.map((item) => mapCase(lead.id, item)),
        solutions: solutions.map((item) => mapSolution(lead.id, item)),
      }),
  };
  setCachedLinkedData(cacheKey, result);
  return result;
}

export async function loadContactLinkedData(contactId: string, options?: { forceRefresh?: boolean }): Promise<LinkedDataResult> {
  const cacheKey = `contact:${contactId}`;
  const cached: LinkedDataResult | null = options?.forceRefresh ? null : getCachedLinkedData<LinkedDataResult>(cacheKey);
  if (cached) return cached;

  const [deals, quotes, salesOrders, purchaseOrders, invoices, cases, solutions, timeline, emails, sourceEvents, socialMessages, visitorEvents, serviceConnectedRecords, tasks, meetings] = await Promise.all([
    fetchList<any>("/deals", { contact: contactId }).catch(() => []),
    fetchList<InventoryQuoteDto>("/inventory/quotes", { contact: contactId }).catch(() => []),
    fetchList<InventorySalesOrderDto>("/inventory/sales-orders", { contact: contactId }).catch(() => []),
    fetchList<InventoryPurchaseOrderDto>("/inventory/purchase-orders", { contact: contactId }).catch(() => []),
    fetchList<InventoryInvoiceDto>("/inventory/invoices", { contact: contactId }).catch(() => []),
    fetchList<SupportCaseDto>("/support/cases", { related_contact: contactId }).catch(() => []),
    fetchList<SupportSolutionDto>("/support/solutions", { contact: contactId }).catch(() => []),
    apiRequest<TimelineDto[]>(`/contacts/${contactId}/timeline`).catch(() => []),
    loadRecordEmailsWithFallback({ contact: contactId }, () => integrationsApi.listContactRecordEmails(contactId), { excludeSupportLinked: true, disableFallback: true }),
    integrationsApi.listLeadSourceEvents({ contact: contactId }).catch(() => []),
    integrationsApi.listSocialMessages({ contact: contactId }).catch(() => []),
    integrationsApi.listVisitorEvents({ contact: contactId }).catch(() => []),
    fetchServiceConnectedRecords(contactId, "contact", contactId).catch(() => []),
    fetchList<any>("/tasks", { contact: contactId }).catch(() => []),
    fetchList<any>("/meetings", { contact: contactId }).catch(() => []),
  ]);
  const mergedEmails = dedupeSalesInboxItems(excludeSupportCaseEmails(emails || []));

  const result = {
    notes: [] as Note[],
    deals: deals.map((item) => ({
      id: asString(item.id),
      parentId: contactId,
      dealName: asString(item.deal_name ?? item.name),
      amount: asNumber(item.amount),
      stage: asString(item.stage),
      probability: asNumber(item.probability),
      closingDate: asString(item.closing_date),
      type: asString(item.type),
    })),
    openActivities: (tasks as any[])
      .filter((t) => t.status !== "Completed")
      .map((t) => ({
        id: String(t.id),
        parentId: contactId,
        type: "Task" as const,
        subject: t.subject ?? "",
        dueAt: t.due_date ?? "",
        status: t.status ?? "",
      })),
    closedActivities: (tasks as any[])
      .filter((t) => t.status === "Completed")
      .map((t) => ({
        id: String(t.id),
        parentId: contactId,
        type: "Task" as const,
        subject: t.subject ?? "",
        dueAt: t.due_date ?? "",
        status: t.status ?? "",
      })),
    meetings: (meetings as any[]).map((m) => ({
      id: String(m.id),
      parentId: contactId,
      title: m.title ?? "",
      at: m.start_date ?? "",
      host: m.host ?? "",
      status: m.status ?? "",
    })),
    products: [],
    emails: mergedEmails.map((item) => mapIntegrationEmail(contactId, item)),
    attachments: [] as Attachment[],
    connectedRecords: [
      ...filterOutEmailConnectedRecords(sourceEvents.map((item) => mapIntegrationSourceEvent(contactId, item))),
      ...socialMessages.map((item) => mapSocialMessage(contactId, item)),
      ...visitorEvents.map((item) => mapVisitorEvent(contactId, item)),
      ...serviceConnectedRecords,
    ],
    cases: cases.map((item) => mapCase(contactId, item)),
    solutions: solutions.map((item) => mapSolution(contactId, item)),
    contacts: [],
    accounts: [],
    quotes: quotes.map((item) => mapQuote(contactId, item)),
    salesOrders: salesOrders.map((item) => mapSalesOrder(contactId, item)),
    purchaseOrders: purchaseOrders.map((item) => mapPurchaseOrder(contactId, item)),
    invoices: invoices.map((item) => mapInvoice(contactId, item)),
      timeline: buildFlowTimeline({
        existing: [
          ...timeline.map((item) => mapTimeline(contactId, item)),
          ...socialMessages.map((item) =>
            mapIntegrationTimeline(contactId, {
              id: `social-${item.id}`,
              type: "Update",
              title: `${item.platform} message`,
              detail: item.message,
              at: item.created_at_source || item.created_at,
              by: item.sender_name || item.sender_email,
            })
          ),
          ...visitorEvents.map((item) =>
            mapIntegrationTimeline(contactId, {
              id: `visitor-${item.id}`,
              type: "Update",
              title: "Website activity",
              detail: asString(item.page_url || item.source_url || item.event_type),
              at: item.created_at,
              by: item.identified_email || item.visitor_email || item.visitor_name,
            })
          ),
        ],
        emails: mergedEmails.map((item) => mapIntegrationEmail(contactId, item)),
        cases: cases.map((item) => mapCase(contactId, item)),
        solutions: solutions.map((item) => mapSolution(contactId, item)),
        quotes: quotes.map((item) => mapQuote(contactId, item)),
        salesOrders: salesOrders.map((item) => mapSalesOrder(contactId, item)),
        purchaseOrders: purchaseOrders.map((item) => mapPurchaseOrder(contactId, item)),
        invoices: invoices.map((item) => mapInvoice(contactId, item)),
      }),
  };
  setCachedLinkedData(cacheKey, result);
  return result;
}

export async function loadDealLinkedData(deal: Deal, options?: { forceRefresh?: boolean }): Promise<LinkedDataResult> {
  const cacheKey = `deal:${deal.id}`;
  const cached: LinkedDataResult | null = options?.forceRefresh ? null : getCachedLinkedData<LinkedDataResult>(cacheKey);
  if (cached) return cached;

  const [quotes, salesOrders, invoices, cases, solutions, timeline, notes, emails, sourceEvents, socialMessages, serviceConnectedRecords, lineItems] = await Promise.all([
    fetchList<InventoryQuoteDto>("/inventory/quotes", { deal: deal.id }).catch(() => []),
    fetchList<InventorySalesOrderDto>("/inventory/sales-orders", { deal: deal.id }).catch(() => []),
    fetchList<InventoryInvoiceDto>("/inventory/invoices", { deal: deal.id }).catch(() => []),
    fetchList<SupportCaseDto>("/support/cases", { deal: deal.id }).catch(() => []),
    fetchList<SupportSolutionDto>("/support/solutions", { deal: deal.id }).catch(() => []),
    apiRequest<TimelineDto[]>(`/deals/${deal.id}/timeline`).catch(() => []),
    apiRequest<Array<{ id: number | string; note?: string; created_at?: string; created_by?: string }>>(`/deals/${deal.id}/notes`).catch(() => []),
    loadRecordEmailsWithFallback({ deal: deal.id }, () => integrationsApi.listDealRecordEmails(deal.id), { excludeSupportLinked: true, disableFallback: true }),
    integrationsApi.listLeadSourceEvents({ deal: deal.id }).catch(() => []),
    integrationsApi.listSocialMessages({ deal: deal.id }).catch(() => []),
    fetchServiceConnectedRecords(deal.id, "deal", deal.id).catch(() => []),
    apiRequest<Array<{ id: number | string; product: number | string; product_name?: string; quantity?: number | string; unit_price?: number | string; discount?: number | string; total_price?: number | string }>>(`/deals/${deal.id}/products`).catch(() => []),
  ]);
  const mergedEmails = dedupeSalesInboxItems(excludeSupportCaseEmails(emails || []));

  const result = {
    notes: notes.map((item) => ({
      id: asString(item.id),
      parentId: deal.id,
      title: asString(item.note).slice(0, 60) || "Note",
      content: asString(item.note),
      createdAt: asString(item.created_at),
      createdBy: asString(item.created_by),
    })),
    deals: [],
    openActivities: [],
    closedActivities: [],
    meetings: [],
    products: [
      ...lineItems.map((item) => ({
      id: asString(item.id),
      parentId: deal.id,
      productId: asString(item.product),
      productName: asString(item.product_name),
      quantity: asNumber(item.quantity),
      unitPrice: asNumber(item.unit_price),
      discount: asNumber(item.discount),
      amount: asNumber(item.unit_price),
      total: asNumber(item.total_price),
    })),
      ...deriveSupportProducts(deal.id, cases, solutions).filter(
        (supportProduct) => !lineItems.some((item) => asString(item.product) === supportProduct.productId)
      ),
    ],
    emails: mergedEmails.map((item) => mapIntegrationEmail(deal.id, item)),
    attachments: [] as Attachment[],
    connectedRecords: [
      ...filterOutEmailConnectedRecords(sourceEvents.map((item) => mapIntegrationSourceEvent(deal.id, item))),
      ...socialMessages.map((item) => mapSocialMessage(deal.id, item)),
      ...serviceConnectedRecords,
    ],
    cases: cases.map((item) => mapCase(deal.id, item)),
    solutions: solutions.map((item) => mapSolution(deal.id, item)),
    contacts: deal.contactName ? [{ id: "", name: deal.contactName }] : [],
    accounts: deal.accountName ? [{ id: "", name: deal.accountName }] : [],
    quotes: quotes.map((item) => mapQuote(deal.id, item)),
    salesOrders: salesOrders.map((item) => mapSalesOrder(deal.id, item)),
    purchaseOrders: [],
    invoices: invoices.map((item) => mapInvoice(deal.id, item)),
      timeline: buildFlowTimeline({
        existing: [
          ...timeline.map((item) => mapTimeline(deal.id, item)),
          ...socialMessages.map((item) =>
            mapIntegrationTimeline(deal.id, {
              id: `social-${item.id}`,
              type: "Update",
              title: `${item.platform} message`,
              detail: item.message,
              at: item.created_at_source || item.created_at,
              by: item.sender_name || item.sender_email,
            })
          ),
        ],
        notes: notes.map((item) => ({
          id: asString(item.id),
          parentId: deal.id,
          title: asString(item.note).slice(0, 60) || "Note",
          content: asString(item.note),
          createdAt: asString(item.created_at),
          createdBy: asString(item.created_by),
        })),
        emails: mergedEmails.map((item) => mapIntegrationEmail(deal.id, item)),
        products: [
          ...lineItems.map((item) => ({
            id: asString(item.id),
            parentId: deal.id,
            productId: asString(item.product),
            productName: asString(item.product_name),
            quantity: asNumber(item.quantity),
            unitPrice: asNumber(item.unit_price),
            discount: asNumber(item.discount),
            amount: asNumber(item.unit_price),
            total: asNumber(item.total_price),
            createdAt: "",
          })),
          ...deriveSupportProducts(deal.id, cases, solutions).filter(
            (supportProduct) => !lineItems.some((item) => asString(item.product) === supportProduct.productId)
          ),
        ],
        cases: cases.map((item) => mapCase(deal.id, item)),
        solutions: solutions.map((item) => mapSolution(deal.id, item)),
        quotes: quotes.map((item) => mapQuote(deal.id, item)),
        salesOrders: salesOrders.map((item) => mapSalesOrder(deal.id, item)),
        invoices: invoices.map((item) => mapInvoice(deal.id, item)),
      }),
  };
  setCachedLinkedData(cacheKey, result);
  return result;
}
