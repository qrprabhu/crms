import { apiRequest } from "../api/client";
import { integrationsApi } from "../integrations/api";
import type {
  Activity,
  Attachment,
  ConnectedRecord,
  EmailRecord,
  Note,
  TimelineItem,
} from "../lib/shared/crmTypes";
import type { IntegrationLeadSourceEvent, SalesInboxFeedItem } from "../integrations/types";
import type {
  ConfiguratorFormValues,
  ConfiguratorRuleForm,
  InventoryDetailResponse,
  InventoryFormValues,
  InventoryAddressFields,
  InventoryLineItem,
  InventoryListRecord,
  InventoryModuleKey,
  InventoryRelatedData,
  InventoryRelatedListItem,
  LookupOption,
  PriceBookFormValues,
  PriceBookImportState,
  ProductFormValues,
  PurchaseOrderFormValues,
  QuoteFormValues,
  SalesOrderFormValues,
  VendorFormValues,
  InvoiceFormValues,
} from "./types";
import { buildFlowTimeline } from "../lib/shared/timelineFlow";

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ModuleMap = Record<Exclude<InventoryModuleKey, "configurator">, string>;

const INVENTORY_ENDPOINTS: ModuleMap = {
  vendors: "/inventory/vendors",
  products: "/inventory/products",
  "price-books": "/inventory/price-books",
  quotes: "/inventory/quotes",
  "sales-orders": "/inventory/sales-orders",
  "purchase-orders": "/inventory/purchase-orders",
  invoices: "/inventory/invoices",
};

const LOOKUP_PATHS = {
  products: "/products/lookup",
  vendors: "/inventory/lookups/vendors",
  accounts: "/inventory/lookups/accounts",
  contacts: "/inventory/lookups/contacts",
  deals: "/inventory/lookups/deals",
  "price-books": "/inventory/lookups/price-books",
  quotes: "/inventory/lookups/quotes",
  "sales-orders": "/inventory/lookups/sales-orders",
  invoices: "/inventory/lookups/invoices",
  "purchase-orders": "/inventory/lookups/purchase-orders",
} as const;

function toList<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
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

function mapTimelineFromRelated(
  parentId: string,
  notes: Note[],
  openActivities: Activity[],
  closedActivities: Activity[],
  emails: EmailRecord[],
  related?: Pick<
    InventoryRelatedData,
    "attachments" | "products" | "quotes" | "salesOrders" | "purchaseOrders" | "invoices" | "services" | "cases" | "solutions"
  >
): TimelineItem[] {
  const mapRelatedFlow = (items: InventoryRelatedListItem[] | undefined, title: string, parentId: string) =>
    (items || [])
      .filter((item) => item.createdAt)
      .map((item) => ({
        id: `related-${title}-${item.id}`,
        parentId,
        type: "Update" as const,
        title,
        detail: [item.label, item.meta].filter(Boolean).join(" • "),
        at: item.createdAt || "",
        by: "",
      }));

  return buildFlowTimeline({
    notes,
    openActivities,
    closedActivities,
    emails,
    attachments: related?.attachments,
    existing: [
      ...mapRelatedFlow(related?.products, "Product linked", parentId),
      ...mapRelatedFlow(related?.quotes, "Quote created", parentId),
      ...mapRelatedFlow(related?.salesOrders, "Sales order created", parentId),
      ...mapRelatedFlow(related?.purchaseOrders, "Purchase order created", parentId),
      ...mapRelatedFlow(related?.invoices, "Invoice created", parentId),
      ...mapRelatedFlow(related?.services, "Service scheduled", parentId),
      ...mapRelatedFlow(related?.cases, "Case created", parentId),
      ...mapRelatedFlow(related?.solutions, "Solution created", parentId),
    ],
  });
}

async function getRelatedServices(moduleKey: InventoryModuleKey, id: string): Promise<InventoryRelatedListItem[]> {
  if (moduleKey !== "products" && moduleKey !== "sales-orders" && moduleKey !== "invoices") {
    return [];
  }

  const query: Record<string, string> = {};
  if (moduleKey === "products") query.product = id;
  if (moduleKey === "sales-orders") query.sales_order = id;
  if (moduleKey === "invoices") query.invoice = id;

  try {
    let appointments = toList(await apiRequest<any[] | Paginated<any>>("/services/appointments/", { query }));

    if (moduleKey === "invoices") {
      const invoiceDetail = await apiRequest<any>(`${INVENTORY_ENDPOINTS.invoices}/${id}`);
      const sourceSalesOrderId = asString(invoiceDetail.sales_order);
      if (sourceSalesOrderId) {
        const salesOrderAppointments = toList(
          await apiRequest<any[] | Paginated<any>>("/services/appointments/", {
            query: { sales_order: sourceSalesOrderId },
          })
        ).map((item) => ({
          ...item,
          _inferredFromSalesOrder: !asString(item.invoice),
        }));

        appointments = dedupeBy(
          [...appointments, ...salesOrderAppointments],
          (item) => asString(item.id)
        );
      }
    }

    const appointmentIds = appointments.map((item) => asString(item.id)).filter(Boolean);
    const allJobSheets = appointmentIds.length
      ? toList(await apiRequest<any[] | Paginated<any>>("/services/job-sheets/"))
      : [];
    const jobSheets = allJobSheets.filter((item) => appointmentIds.includes(asString(item.appointment)));

    return [
      ...appointments.map((item) => ({
        id: asString(item.id),
        route: `/services/appointments/${asString(item.id)}`,
        kind: "appointment" as const,
        label:
          asString(item.appointment_number) ||
          asString(item.service_name) ||
          "Service Appointment",
        meta: [
        "Appointment",
        asString(item.service_name),
        asString(item.status),
        asString(item.appointment_for_display),
        item._inferredFromSalesOrder ? "From Sales Order" : "",
        asString(item.sales_order_subject || item.invoice_subject),
        asString(item.appointment_date),
        ]
        .filter(Boolean)
        .join(" - "),
      createdAt: asString(item.created_at),
      })),
      ...jobSheets.map((item) => ({
        id: `job-sheet-${asString(item.id)}`,
        route: `/services/job-sheets/${asString(item.id)}`,
        kind: "job-sheet" as const,
        label: asString(item.title) || "Job Sheet",
        meta: [
          "Job Sheet",
          asString(item.service_name),
          asString(item.status).replace(/_/g, " "),
          asString(item.appointment) ? `Appointment ${asString(item.appointment)}` : "",
        ].filter(Boolean).join(" - "),
        createdAt: asString(item.created_at),
      })),
    ];
  } catch {
    return [];
  }
}

function mapNote(parentId: string, item: any): Note {
  return {
    id: asString(item.id),
    parentId,
    title: asString(item.note).slice(0, 80) || "Note",
    content: asString(item.note),
    createdAt: asString(item.created_at),
    createdBy: asString(item.created_by_email),
  };
}

function mapActivity(parentId: string, item: any): Activity {
  return {
    id: asString(item.id),
    parentId,
    type: asString(item.action).toLowerCase().includes("call") ? "Call" : "Task",
    subject: asString(item.action),
    dueAt: asString(item.created_at),
    status: item.is_closed ? "Closed" : "Open",
  };
}

function mapAttachment(parentId: string, item: any): Attachment {
  const file = asString(item.file);
  return {
    id: asString(item.id),
    parentId,
    fileName: file.split("/").pop() || file || "Attachment",
    fileType: file.split(".").pop() || "",
    uploadedAt: asString(item.created_at),
    uploadedBy: asString(item.uploaded_by_email),
  };
}

function mapEmail(parentId: string, item: any): EmailRecord {
  const bodyText = asString(item.body || item.body_text).trim() || stripHtmlPreview(item.body_html);
  return {
    id: asString(item.id),
    parentId,
    subject: asString(item.subject),
    sentAt: asString(item.created_at),
    sentBy: asString(item.sent_by_email),
    status: "Sent",
    previewText: bodyText,
    bodyText,
  };
}

function mapIntegrationEmail(parentId: string, item: SalesInboxFeedItem): EmailRecord {
  const direction = asString(item.direction).toLowerCase();
  const bodyText = asString(item.body_text).trim() || stripHtmlPreview(item.body_html);
  const previewText = asString(item.preview_text).trim() || bodyText;
  return {
    id: `integration-${asString(item.id)}`,
    parentId,
    subject: asString(item.subject) || "(No subject)",
    sentAt: asString(item.sent_at || item.received_at),
    sentBy: asString(item.counterparty_email || item.from_email),
    status: direction === "incoming" ? "Received" : "Sent",
    previewText,
    bodyText,
  };
}

function mapConnectedRecord(parentId: string, item: any): ConnectedRecord {
  const name =
    asString(item.account_name) ||
    asString(item.contact_name) ||
    asString(item.deal_name) ||
    asString(item.lead_name) ||
    "Linked Record";
  const type =
    (item.account ? "Account" : "") ||
    (item.contact ? "Contact" : "") ||
    (item.deal ? "Deal" : "") ||
    (item.lead ? "Lead" : "") ||
    "Record";
  return {
    id: asString(item.id),
    parentId,
    recordType: type,
    name,
    owner: "",
    status: asString(item.relationship_label),
  };
}

function mapIntegrationSourceEvent(parentId: string, item: IntegrationLeadSourceEvent): ConnectedRecord {
  const label =
    asString(item.lead_name) ||
    asString(item.contact_name) ||
    asString(item.deal_name) ||
    asString(item.source_reference) ||
    "Integration Event";
  return {
    id: `integration-event-${asString(item.id)}`,
    parentId,
    recordType: "Integration",
    name: label,
    owner: "",
    status: asString(item.source_type || item.status || "Captured"),
  };
}

function dedupeBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mapLineItem(item: any): InventoryLineItem {
  return {
    id: asString(item.id),
    product: asString(item.product),
    productName: asString(item.product_name),
    productCode: asString(item.product_code),
    quantity: asNumber(item.quantity),
    listPrice: asNumber(item.list_price),
    amount: asNumber(item.amount),
    discount: asNumber(item.discount),
    tax: asNumber(item.tax),
    total: asNumber(item.total),
    rowDescription: asString(item.row_description),
  };
}

function mapAddress(detail: any): InventoryAddressFields {
  return {
    billingStreet: asString(detail.billing_street),
    billingCity: asString(detail.billing_city),
    billingState: asString(detail.billing_state),
    billingCountry: asString(detail.billing_country),
    billingZipCode: asString(detail.billing_zip_code),
    shippingStreet: asString(detail.shipping_street),
    shippingCity: asString(detail.shipping_city),
    shippingState: asString(detail.shipping_state),
    shippingCountry: asString(detail.shipping_country),
    shippingZipCode: asString(detail.shipping_zip_code),
  };
}

function normalizeProducts(items: any[]): InventoryListRecord[] {
  return items.map((item) => ({
    id: asString(item.id),
    productName: asString(item.product_name),
    productCode: asString(item.product_code),
    owner: asString(item.owner_email),
    vendorName: asString(item.vendor_name),
    manufacturer: asString(item.manufacturer),
    productCategory: asString(item.product_category),
    productType: asString(item.product_type),
    billingCycle: asString(item.billing_cycle),
    licenseType: asString(item.license_type),
    deploymentModel: asString(item.deployment_model),
    unitPrice: asNumber(item.unit_price),
    tax: asNumber(item.tax),
    quantityInStock: asNumber(item.quantity_in_stock),
    reorderLevel: asNumber(item.reorder_level),
    usageUnit: asString(item.usage_unit),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  }));
}

function normalizeVendors(items: any[]): InventoryListRecord[] {
  return items.map((item) => ({
    id: asString(item.id),
    vendorName: asString(item.vendor_name),
    email: asString(item.email),
    phone: asString(item.phone),
    website: asString(item.website),
    vendorOwner: asString(item.owner_email),
    category: asString(item.category),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  }));
}

function normalizePriceBooks(items: any[]): InventoryListRecord[] {
  return items.map((item) => ({
    id: asString(item.id),
    name: asString(item.name),
    owner: asString(item.owner_email),
    active: item.active ? "Active" : "Inactive",
    pricingModel: asString(item.pricing_model),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  }));
}

function normalizeQuotes(items: any[]): InventoryListRecord[] {
  return items.map((item) => ({
    id: asString(item.id),
    subject: asString(item.subject),
    owner: asString(item.owner_email),
    quoteStage: asString(item.quote_stage),
    billingCycle: asString(item.billing_cycle),
    renewalStatus: asString(item.renewal_status),
    priceBookName: asString(item.price_book_name),
    accountName: asString(item.account_name),
    contactName: asString(item.contact_name),
    dealName: asString(item.deal_name),
    validUntil: asString(item.valid_until),
    grandTotal: asNumber(item.grand_total),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  }));
}

function normalizeSalesOrders(items: any[]): InventoryListRecord[] {
  return items.map((item) => ({
    id: asString(item.id),
    subject: asString(item.subject),
    owner: asString(item.owner_email),
    status: asString(item.status),
    billingCycle: asString(item.billing_cycle),
    renewalStatus: asString(item.renewal_status),
    accountName: asString(item.account_name),
    contactName: asString(item.contact_name),
    dealName: asString(item.deal_name),
    dueDate: asString(item.due_date),
    grandTotal: asNumber(item.grand_total),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  }));
}

function normalizePurchaseOrders(items: any[]): InventoryListRecord[] {
  return items.map((item) => ({
    id: asString(item.id),
    subject: asString(item.subject),
    owner: asString(item.owner_email),
    status: asString(item.status),
    vendorName: asString(item.vendor_name),
    contactName: asString(item.contact_name),
    poNumber: asString(item.po_number),
    dueDate: asString(item.due_date),
    grandTotal: asNumber(item.grand_total),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  }));
}

function normalizeInvoices(items: any[]): InventoryListRecord[] {
  return items.map((item) => ({
    id: asString(item.id),
    subject: asString(item.subject),
    owner: asString(item.owner_email),
    status: asString(item.status),
    billingCycle: asString(item.billing_cycle),
    renewalStatus: asString(item.renewal_status),
    accountName: asString(item.account_name),
    contactName: asString(item.contact_name),
    dealName: asString(item.deal_name),
    invoiceDate: asString(item.invoice_date),
    dueDate: asString(item.due_date),
    grandTotal: asNumber(item.grand_total),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  }));
}

function normalizeConfigurators(items: any[]): InventoryListRecord[] {
  return items.map((item) => ({
    id: asString(item.id),
    name: asString(item.name),
    targetModule: asString(item.target_module),
    layout: asString(item.layout),
    subform: asString(item.subform),
    lookupField: asString(item.lookup_field),
    active: item.active ? "Active" : "Inactive",
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  }));
}

export async function getInventoryList(
  moduleKey: InventoryModuleKey,
  options?: { pageSize?: number; cacheTtlMs?: number }
): Promise<InventoryListRecord[]> {
  if (moduleKey === "configurator") {
    const data = await apiRequest<any[] | Paginated<any>>("/inventory/configurator", {
      query: options?.pageSize ? { page_size: options.pageSize } : undefined,
      cacheTtlMs: options?.cacheTtlMs,
    });
    return normalizeConfigurators(toList(data));
  }

  const data = await apiRequest<any[] | Paginated<any>>(INVENTORY_ENDPOINTS[moduleKey], {
    query: options?.pageSize ? { page_size: options.pageSize } : undefined,
    cacheTtlMs: options?.cacheTtlMs,
  });
  const items = toList(data);
  if (moduleKey === "products") return normalizeProducts(items);
  if (moduleKey === "vendors") return normalizeVendors(items);
  if (moduleKey === "price-books") return normalizePriceBooks(items);
  if (moduleKey === "quotes") return normalizeQuotes(items);
  if (moduleKey === "sales-orders") return normalizeSalesOrders(items);
  if (moduleKey === "purchase-orders") return normalizePurchaseOrders(items);
  return normalizeInvoices(items);
}

async function getRelatedList(path: string, mapper: (item: any) => any) {
  try {
    const data = await apiRequest<any[]>(path);
    return data.map(mapper);
  } catch {
    return [];
  }
}

export async function getInventoryDetail(
  moduleKey: InventoryModuleKey,
  id: string
): Promise<{ detail: InventoryDetailResponse; related: InventoryRelatedData }> {
  const basePath = moduleKey === "configurator" ? "/inventory/configurator" : INVENTORY_ENDPOINTS[moduleKey];
  const detail = await apiRequest<any>(`${basePath}/${id}`);

  if (moduleKey === "configurator") {
    return {
      detail: {
        id,
        name: asString(detail.name),
        subtitle: asString(detail.target_module),
        avatar: asString(detail.name).slice(0, 2).toUpperCase(),
        summary: [
          { label: "Target Module", value: asString(detail.target_module) || "-" },
          { label: "Layout", value: asString(detail.layout) || "-" },
          { label: "Subform", value: asString(detail.subform) || "-" },
          { label: "Lookup Field", value: asString(detail.lookup_field) || "-" },
        ],
        fields: [
          { label: "Description", value: asString(detail.description) || "-" },
          { label: "Status", value: detail.active ? "Active" : "Inactive" },
        ],
        items: [],
        description: asString(detail.description),
        timeline: [],
      },
      related: {
        notes: [],
        openActivities: [],
        closedActivities: [],
        attachments: [],
        emails: [],
        connectedRecords: [],
        links: (detail.rules || []).map((rule: any) => ({
          id: asString(rule.id),
          label: `${asString(rule.action_type)} ${asString(rule.target_product_name)}`.trim(),
          meta: asString(rule.field_name || rule.field_value),
        })),
      },
    };
  }

  const [
    notes,
    openActivities,
    closedActivities,
    attachments,
    emails,
    connectedRecords,
    products,
    vendors,
    priceBooks,
    quotes,
    salesOrders,
    purchaseOrders,
    invoices,
    cases,
    solutions,
    services,
    integrationEmails,
    integrationSourceEvents,
  ] = await Promise.all([
    getRelatedList(`${basePath}/${id}/notes`, (item) => mapNote(id, item)),
    getRelatedList(`${basePath}/${id}/open-activities`, (item) => mapActivity(id, item)),
    getRelatedList(`${basePath}/${id}/closed-activities`, (item) => mapActivity(id, item)),
    getRelatedList(`${basePath}/${id}/attachments`, (item) => mapAttachment(id, item)),
    getRelatedList(`${basePath}/${id}/emails`, (item) => mapEmail(id, item)),
    getRelatedList(`${basePath}/${id}/related-records`, (item) => mapConnectedRecord(id, item)),
      getRelatedList(`${basePath}/${id}/products`, (item) => ({
        id: asString(item.id),
        label: asString(item.product_name || item.productName || item.vendor_name || item.vendorName),
        meta: asString(item.product_code || item.phone),
        createdAt: asString(item.created_at),
      })),
      getRelatedList(`${basePath}/${id}/vendors`, (item) => ({
        id: asString(item.id),
        label: asString(item.vendor_name || item.name),
        meta: asString(item.email || item.phone),
        createdAt: asString(item.created_at),
      })),
      getRelatedList(`${basePath}/${id}/price-books`, (item) => ({
        id: asString(item.id),
        label: asString(item.name),
        meta: asString(item.pricing_model),
        createdAt: asString(item.created_at),
      })),
      getRelatedList(`${basePath}/${id}/quotes`, (item) => ({
        id: asString(item.id),
        label: asString(item.subject),
        meta: asString(item.quote_stage || item.price_book_name),
        createdAt: asString(item.created_at),
      })),
      getRelatedList(`${basePath}/${id}/sales-orders`, (item) => ({
        id: asString(item.id),
        label: asString(item.subject),
        meta: asString(item.status),
        createdAt: asString(item.created_at),
      })),
      getRelatedList(`${basePath}/${id}/purchase-orders`, (item) => ({
        id: asString(item.id),
        label: asString(item.subject),
        meta: asString(item.status),
        createdAt: asString(item.created_at),
      })),
      getRelatedList(`${basePath}/${id}/invoices`, (item) => ({
        id: asString(item.id),
        label: asString(item.subject),
        meta: asString(item.status),
        createdAt: asString(item.created_at),
      })),
      getRelatedList(`${basePath}/${id}/cases`, (item) => ({
        id: asString(item.id),
        label: asString(item.subject || item.case_number),
        meta: [asString(item.case_number), asString(item.status)].filter(Boolean).join(" - "),
        createdAt: asString(item.created_at),
      })),
      getRelatedList(`${basePath}/${id}/solutions`, (item) => ({
        id: asString(item.id),
        label: asString(item.solution_title || item.solution_number),
        meta: [asString(item.solution_number), asString(item.status)].filter(Boolean).join(" - "),
        createdAt: asString(item.created_at),
      })),
    getRelatedServices(moduleKey, id),
    detail.account || detail.contact || detail.deal
      ? integrationsApi
          .listSyncedEmailMessages({
            account: detail.account ? asString(detail.account) : undefined,
            contact: detail.contact ? asString(detail.contact) : undefined,
            deal: detail.deal ? asString(detail.deal) : undefined,
          })
          .then((items) => items.map((item) => mapIntegrationEmail(id, item)))
          .catch(() => [])
      : Promise.resolve([]),
    detail.contact || detail.deal
      ? integrationsApi
          .listLeadSourceEvents({
            contact: detail.contact ? asString(detail.contact) : undefined,
            deal: detail.deal ? asString(detail.deal) : undefined,
          })
          .then((items) => items.map((item) => mapIntegrationSourceEvent(id, item)))
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const mergedEmails = dedupeBy([...emails, ...integrationEmails], (item) => `${item.subject}|${item.sentAt}|${item.sentBy}`);
  const mergedConnectedRecords = dedupeBy(
    [...connectedRecords, ...integrationSourceEvents],
    (item) => `${item.recordType}|${item.name}|${item.status}`
  );
  const linkedDeals = dedupeBy(
    connectedRecords
      .filter((item: any) => Boolean(item.deal))
      .map((item: any) => ({
        id: asString(item.deal),
        label: asString(item.deal_name) || "Deal",
        meta: asString(item.relationship_label),
      })),
    (item) => item.id
  );
  const linkedAccounts = dedupeBy(
    connectedRecords
      .filter((item: any) => Boolean(item.account))
      .map((item: any) => ({
        id: asString(item.account),
        label: asString(item.account_name) || "Account",
        meta: asString(item.relationship_label),
      })),
    (item) => item.id
  );
  const linkedContacts = dedupeBy(
    connectedRecords
      .filter((item: any) => Boolean(item.contact))
      .map((item: any) => ({
        id: asString(item.contact),
        label: asString(item.contact_name) || "Contact",
        meta: asString(item.relationship_label),
      })),
    (item) => item.id
  );

  const detailResponse: InventoryDetailResponse = {
    id: asString(detail.id),
    name:
      asString(detail.product_name) ||
      asString(detail.vendor_name) ||
      asString(detail.name) ||
      asString(detail.subject),
    subtitle:
      asString(detail.product_code) ||
      asString(detail.quote_stage) ||
      asString(detail.status) ||
      asString(detail.pricing_model),
    avatar:
      (
        asString(detail.product_name) ||
        asString(detail.vendor_name) ||
        asString(detail.name) ||
        asString(detail.subject)
      )
        .slice(0, 2)
        .toUpperCase(),
    summary: [
      { label: "Owner", value: asString(detail.owner_email) || "-" },
      { label: "Created", value: asString(detail.created_at) || "-" },
      { label: "Updated", value: asString(detail.updated_at) || "-" },
      { label: "Status", value: asString(detail.status || detail.quote_stage || detail.pricing_model) || "-" },
      { label: "Renewal Status", value: asString(detail.renewal_status) || "-" },
      { label: "Billing Cycle", value: asString(detail.billing_cycle) || "-" },
      { label: "Licensed Users", value: asString(detail.licensed_users) || "-" },
      { label: "Grand Total", value: asNumber(detail.grand_total) ? String(asNumber(detail.grand_total)) : "-" },
    ],
    fields: Object.entries({
      "Product Code": detail.product_code,
      Manufacturer: detail.manufacturer,
      Category: detail.product_category,
      "Product Type": detail.product_type,
      "Deployment Model": detail.deployment_model,
      "License Type": detail.license_type,
      "Default User Seats": detail.default_user_seats,
      "Subscription Term (Months)": detail.subscription_term_months,
      "Renewal Required": detail.renewal_required === undefined ? "" : detail.renewal_required ? "Yes" : "No",
      "Implementation Required": detail.implementation_required === undefined ? "" : detail.implementation_required ? "Yes" : "No",
      Vendor: detail.vendor_name,
      "Price Book": detail.name,
      Active: detail.active ? "Active" : detail.active === false ? "Inactive" : "",
      "Quote Stage": detail.quote_stage,
      "Selected Price Book": detail.price_book_name,
      "Account Name": detail.account_name,
      "Contact Name": detail.contact_name,
      "Deal Name": detail.deal_name,
      "Valid Until": detail.valid_until,
      "Subscription Start": detail.subscription_start_date,
      "Subscription End": detail.subscription_end_date,
      "Renewal Due": detail.renewal_due_date,
      "Invoice Date": detail.invoice_date,
      "Due Date": detail.due_date,
      "PO Number": detail.po_number,
      "Vendor Name": detail.vendor_name,
      "Tracking Number": detail.tracking_number,
      Website: detail.website,
      Email: detail.email,
      Phone: detail.phone,
    })
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([label, value]) => ({ label, value: asString(value) })),
      timeline: mapTimelineFromRelated(id, notes, openActivities, closedActivities, mergedEmails, {
        attachments,
        products,
        quotes,
        salesOrders,
        purchaseOrders,
        invoices,
        services: services as any,
        cases,
        solutions,
      }),
    description: asString(detail.description),
    termsAndConditions: asString(detail.terms_and_conditions),
    items: Array.isArray(detail.items) ? detail.items.map(mapLineItem) : [],
    ...mapAddress(detail),
  };

  return {
    detail: detailResponse,
    related: {
      notes,
      openActivities,
      closedActivities,
      attachments,
      emails: mergedEmails,
      connectedRecords: mergedConnectedRecords,
      products,
      vendors,
      priceBooks,
      quotes,
      salesOrders,
      purchaseOrders,
      invoices,
      services,
      contacts: linkedContacts,
      accounts: linkedAccounts,
      deals: linkedDeals,
      cases,
      solutions,
    },
  };
}

function toPayloadItems(items: InventoryLineItem[]) {
  return items
    .filter((item) => item.product && String(item.product).trim().length > 0)
    .map((item) => ({
      product: Number(item.product),
      quantity: Number(item.quantity || 0),
      list_price: Number(item.listPrice || 0),
      discount: Number(item.discount || 0),
      tax: Number(item.tax || 0),
      row_description: item.rowDescription || "",
    }));
}

function toAddressPayload(values: InventoryAddressFields) {
  return {
    billing_street: values.billingStreet || "",
    billing_city: values.billingCity || "",
    billing_state: values.billingState || "",
    billing_country: values.billingCountry || "",
    billing_zip_code: values.billingZipCode || "",
    shipping_street: values.shippingStreet || "",
    shipping_city: values.shippingCity || "",
    shipping_state: values.shippingState || "",
    shipping_country: values.shippingCountry || "",
    shipping_zip_code: values.shippingZipCode || "",
  };
}

function serializeProduct(values: ProductFormValues) {
  return {
    owner: values.owner ? Number(values.owner) : undefined,
    product_name: values.productName,
    vendor: values.vendor ? Number(values.vendor) : undefined,
    manufacturer: values.manufacturer || "",
    product_category: values.productCategory || "",
    product_type: values.productType || "software",
    deployment_model: values.deploymentModel || "cloud",
    billing_cycle: values.billingCycle || "custom",
    license_type: values.licenseType || "named",
    unit_price: values.unitPrice,
    commission_rate: values.commissionRate,
    tax: values.tax,
    quantity_in_stock: values.quantityInStock,
    quantity_in_demand: values.quantityInDemand,
    reorder_level: values.reorderLevel,
    usage_unit: values.usageUnit || "",
    default_user_seats: values.defaultUserSeats ?? 1,
    subscription_term_months: values.subscriptionTermMonths ?? 12,
    renewal_required: values.renewalRequired ?? true,
    implementation_required: values.implementationRequired ?? false,
    support_start_date: values.supportStartDate || undefined,
    support_expiry_date: values.supportExpiryDate || undefined,
    description: values.description || "",
  };
}

function serializeVendor(values: VendorFormValues) {
  return {
    vendor_owner: values.vendorOwner ? Number(values.vendorOwner) : undefined,
    vendor_name: values.vendorName,
    email: values.email || "",
    phone: values.phone || "",
    website: values.website || "",
    category: values.category || "",
    description: values.description || "",
    ...toAddressPayload(values),
  };
}

function serializePriceBook(values: PriceBookFormValues) {
  const shouldSendRanges = values.pricingModel === "range";
  return {
    owner: values.owner ? Number(values.owner) : undefined,
    name: values.name,
    active: values.active,
    pricing_model: values.pricingModel,
    description: values.description || "",
    ranges: shouldSendRanges
      ? values.ranges
          .filter((item) => Number(item.toRange) >= Number(item.fromRange))
          .map((item) => ({
            from_range: item.fromRange,
            to_range: item.toRange,
            discount_percentage: item.discountPercentage,
          }))
      : [],
    product_links: values.productLinks.map((item) => ({
      product: Number(item.product),
      list_price: item.listPrice,
      active: item.active,
    })),
  };
}

function serializeQuote(values: QuoteFormValues) {
  return {
    owner: values.owner ? Number(values.owner) : undefined,
    subject: values.subject,
    quote_stage: values.quoteStage || "",
    team: values.team || "",
    carrier: values.carrier || "",
    price_book: values.priceBook ? Number(values.priceBook) : undefined,
    deal: values.deal ? Number(values.deal) : undefined,
    valid_until: values.validUntil || undefined,
    contact: values.contact ? Number(values.contact) : undefined,
    account: values.account ? Number(values.account) : undefined,
    billing_cycle: values.billingCycle || "custom",
    license_type: values.licenseType || "named",
    licensed_users: values.licensedUsers ?? 1,
    implementation_required: values.implementationRequired ?? false,
    subscription_start_date: values.subscriptionStartDate || undefined,
    subscription_end_date: values.subscriptionEndDate || undefined,
    renewal_due_date: values.renewalDueDate || undefined,
    subtotal: values.subtotal,
    discount: values.discount,
    tax: values.tax,
    adjustment: values.adjustment,
    grand_total: values.grandTotal,
    terms_and_conditions: values.termsAndConditions || "",
    description: values.description || "",
    items: toPayloadItems(values.items),
    ...toAddressPayload(values),
  };
}

function serializeSalesOrder(values: SalesOrderFormValues) {
  return {
    owner: values.owner ? Number(values.owner) : undefined,
    subject: values.subject,
    customer_no: values.customerNo || "",
    quote: values.quote ? Number(values.quote) : undefined,
    pending: values.pending,
    carrier: values.carrier || "",
    sales_commission: values.salesCommission,
    account: values.account ? Number(values.account) : undefined,
    deal: values.deal ? Number(values.deal) : undefined,
    due_date: values.dueDate || undefined,
    contact: values.contact ? Number(values.contact) : undefined,
    billing_cycle: values.billingCycle || "custom",
    license_type: values.licenseType || "named",
    licensed_users: values.licensedUsers ?? 1,
    implementation_required: values.implementationRequired ?? false,
    subscription_start_date: values.subscriptionStartDate || undefined,
    subscription_end_date: values.subscriptionEndDate || undefined,
    renewal_due_date: values.renewalDueDate || undefined,
    excise_duty: values.exciseDuty,
    status: values.status || "",
    subtotal: values.subtotal,
    discount: values.discount,
    tax: values.tax,
    adjustment: values.adjustment,
    grand_total: values.grandTotal,
    terms_and_conditions: values.termsAndConditions || "",
    description: values.description || "",
    items: toPayloadItems(values.items),
    ...toAddressPayload(values),
  };
}

function serializePurchaseOrder(values: PurchaseOrderFormValues) {
  return {
    owner: values.owner ? Number(values.owner) : undefined,
    subject: values.subject,
    requisition_number: values.requisitionNumber || "",
    contact: values.contact ? Number(values.contact) : undefined,
    due_date: values.dueDate || undefined,
    excise_duty: values.exciseDuty,
    status: values.status || "",
    po_number: values.poNumber || "",
    vendor: values.vendor ? Number(values.vendor) : undefined,
    tracking_number: values.trackingNumber || "",
    po_date: values.poDate || undefined,
    carrier: values.carrier || "",
    sales_commission: values.salesCommission,
    subtotal: values.subtotal,
    discount: values.discount,
    tax: values.tax,
    adjustment: values.adjustment,
    grand_total: values.grandTotal,
    terms_and_conditions: values.termsAndConditions || "",
    description: values.description || "",
    items: toPayloadItems(values.items),
    ...toAddressPayload(values),
  };
}

function serializeInvoice(values: InvoiceFormValues) {
  return {
    owner: values.owner ? Number(values.owner) : undefined,
    subject: values.subject,
    invoice_date: values.invoiceDate || undefined,
    due_date: values.dueDate || undefined,
    sales_commission: values.salesCommission,
    account: values.account ? Number(values.account) : undefined,
    contact: values.contact ? Number(values.contact) : undefined,
    deal: values.deal ? Number(values.deal) : undefined,
    sales_order: values.salesOrder ? Number(values.salesOrder) : undefined,
    purchase_order: values.purchaseOrder ? Number(values.purchaseOrder) : undefined,
    billing_cycle: values.billingCycle || "custom",
    license_type: values.licenseType || "named",
    licensed_users: values.licensedUsers ?? 1,
    implementation_required: values.implementationRequired ?? false,
    subscription_start_date: values.subscriptionStartDate || undefined,
    subscription_end_date: values.subscriptionEndDate || undefined,
    renewal_due_date: values.renewalDueDate || undefined,
    excise_duty: values.exciseDuty,
    status: values.status || "",
    subtotal: values.subtotal,
    discount: values.discount,
    tax: values.tax,
    adjustment: values.adjustment,
    grand_total: values.grandTotal,
    terms_and_conditions: values.termsAndConditions || "",
    description: values.description || "",
    items: toPayloadItems(values.items),
    ...toAddressPayload(values),
  };
}

function serializeConfigurator(values: ConfiguratorFormValues) {
  return {
    name: values.name,
    target_module: values.targetModule,
    layout: values.layout || "",
    subform: values.subform || "",
    lookup_field: values.lookupField || "",
    description: values.description || "",
    active: values.active,
    rules: values.rules.map((rule: ConfiguratorRuleForm) => ({
      criteria: safeParseJson(rule.criteria),
      action_type: rule.actionType,
      target_product: rule.targetProduct ? Number(rule.targetProduct) : undefined,
      field_name: rule.fieldName || "",
      field_value: rule.fieldValue || "",
      metadata: safeParseJson(rule.metadata || "{}"),
    })),
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

export async function saveInventoryRecord(
  moduleKey: InventoryModuleKey,
  values: InventoryFormValues,
  id?: string
): Promise<{ id: string }> {
  let path = "/inventory/configurator";
  let body: Record<string, unknown> = {};

  if (moduleKey !== "configurator") {
    path = INVENTORY_ENDPOINTS[moduleKey];
  }

  if (moduleKey === "products") body = serializeProduct(values as ProductFormValues);
  if (moduleKey === "vendors") body = serializeVendor(values as VendorFormValues);
  if (moduleKey === "price-books") body = serializePriceBook(values as PriceBookFormValues);
  if (moduleKey === "quotes") body = serializeQuote(values as QuoteFormValues);
  if (moduleKey === "sales-orders") body = serializeSalesOrder(values as SalesOrderFormValues);
  if (moduleKey === "purchase-orders") body = serializePurchaseOrder(values as PurchaseOrderFormValues);
  if (moduleKey === "invoices") body = serializeInvoice(values as InvoiceFormValues);
  if (moduleKey === "configurator") body = serializeConfigurator(values as ConfiguratorFormValues);

  const data = await apiRequest<any>(id ? `${path}/${id}` : path, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(body),
  });
  return { id: asString(data.id) };
}

export async function deleteInventoryRecord(moduleKey: InventoryModuleKey, id: string) {
  const path = moduleKey === "configurator" ? "/inventory/configurator" : INVENTORY_ENDPOINTS[moduleKey];
  await apiRequest(`${path}/${id}`, { method: "DELETE" });
}

export async function fetchLookupOptions(
  lookup: keyof typeof LOOKUP_PATHS,
  query: string,
  extraQuery?: Record<string, string | undefined>
): Promise<LookupOption[]> {
  const data = await apiRequest<any[]>(LOOKUP_PATHS[lookup], { query: { q: query, ...(extraQuery || {}) } });
  return data.map((item) => ({
    id: asString(item.id),
    name: asString(item.name || item.product_name || item.vendor_name),
    label: asString(item.label || item.name || item.product_name || item.vendor_name),
    email: asString(item.email),
    phone: asString(item.phone),
    productCode: asString(item.product_code),
    unitPrice: asNumber(item.unit_price),
    accountId: asString(item.account_id),
    contactId: asString(item.contact_id),
    dealId: asString(item.deal_id),
    vendorId: asString(item.vendor_id),
    quoteId: asString(item.quote_id),
    priceBookId: asString(item.price_book_id),
    pricingModel: asString(item.pricing_model),
  }));
}

export async function getInventoryRecordSnapshot(
  moduleKey: Exclude<InventoryModuleKey, "configurator">,
  id: string
) {
  return apiRequest<any>(`${INVENTORY_ENDPOINTS[moduleKey]}/${id}`);
}

export async function quickCreateVendor(values: Pick<VendorFormValues, "vendorName" | "phone" | "email">) {
  const data = await apiRequest<any>("/inventory/vendors/quick-create", {
    method: "POST",
    body: JSON.stringify({
      vendor_name: values.vendorName,
      phone: values.phone || "",
      email: values.email || "",
    }),
  });
  return {
    id: asString(data.id),
    label: asString(data.label || data.vendor_name || data.name),
    name: asString(data.name || data.vendor_name),
  };
}

export async function reviewInvoiceChanges(items: InventoryLineItem[], adjustment: number) {
  const data = await apiRequest<any>("/inventory/invoices/review-changes", {
    method: "POST",
    body: JSON.stringify({
      adjustment,
      items: items.map((item) => ({
        product: Number(item.product),
        quantity: item.quantity,
        list_price: item.listPrice,
        discount: item.discount,
        tax: item.tax,
      })),
    }),
  });
  return {
    items: (data.items || []).map((item: any) => ({
      product: asString(item.product),
      quantity: asNumber(item.quantity),
      listPrice: asNumber(item.list_price),
      amount: asNumber(item.amount),
      discount: asNumber(item.discount),
      tax: asNumber(item.tax),
      total: asNumber(item.total),
    })),
    subtotal: asNumber(data.subtotal),
    discount: asNumber(data.discount),
    tax: asNumber(data.tax),
    adjustment: asNumber(data.adjustment),
    grandTotal: asNumber(data.grand_total),
  };
}

export async function convertQuoteToSalesOrder(id: string) {
  const data = await apiRequest<any>(`/inventory/quotes/${id}/convert-to-sales-order`, { method: "POST" });
  return { id: asString(data.id) };
}

export async function convertSalesOrderToInvoice(id: string) {
  const data = await apiRequest<any>(`/inventory/sales-orders/${id}/convert-to-invoice`, { method: "POST" });
  return { id: asString(data.id) };
}

export async function startPriceBookImport(state: PriceBookImportState) {
  return apiRequest("/inventory/price-books/import-init", {
    method: "POST",
    body: JSON.stringify({
      operation: state.operation,
      file_name: state.file?.name || "",
      field_mapping: state.fieldMapping,
    }),
  });
}

export async function schedulePriceBookImport(state: PriceBookImportState) {
  return apiRequest("/inventory/price-books/import-schedule", {
    method: "POST",
    body: JSON.stringify({
      operation: state.operation,
      file_name: state.file?.name || "",
      field_mapping: state.fieldMapping,
      scheduled_for: new Date().toISOString(),
    }),
  });
}
