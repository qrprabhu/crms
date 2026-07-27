import type {
  Activity,
  Attachment,
  Case,
  EmailRecord,
  Invoice,
  Meeting,
  Note,
  Product,
  PurchaseOrder,
  Quote,
  SalesOrder,
  Solution,
  TimelineItem,
} from "./crmTypes";

type FlowTimelineInput = {
  existing?: TimelineItem[];
  notes?: Note[];
  openActivities?: Activity[];
  closedActivities?: Activity[];
  meetings?: Meeting[];
  emails?: EmailRecord[];
  attachments?: Attachment[];
  products?: Product[];
  quotes?: Quote[];
  salesOrders?: SalesOrder[];
  purchaseOrders?: PurchaseOrder[];
  invoices?: Invoice[];
  cases?: Case[];
  solutions?: Solution[];
};

function hasTimestamp(value?: string) {
  return Boolean(value && value.trim());
}

function sortTimeline(items: TimelineItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.at || 0).getTime();
    const rightTime = new Date(right.at || 0).getTime();
    return rightTime - leftTime;
  });
}

export function buildFlowTimeline({
  existing = [],
  notes = [],
  openActivities = [],
  closedActivities = [],
  meetings = [],
  emails = [],
  attachments = [],
  products = [],
  quotes = [],
  salesOrders = [],
  purchaseOrders = [],
  invoices = [],
  cases = [],
  solutions = [],
}: FlowTimelineInput): TimelineItem[] {
  const syntheticItems: TimelineItem[] = [
    ...notes
      .filter((item) => hasTimestamp(item.createdAt))
      .map((item) => ({
        id: `timeline-note-${item.id}`,
        parentId: item.parentId,
        type: "Note" as const,
        title: item.title || "Note added",
        detail: item.content || "Record note added",
        at: item.createdAt,
        by: item.createdBy,
      })),
    ...[...openActivities, ...closedActivities]
      .filter((item) => hasTimestamp(item.dueAt))
      .map((item) => ({
        id: `timeline-activity-${item.id}`,
        parentId: item.parentId,
        type: item.type === "Call" ? ("Call" as const) : ("Task" as const),
        title: item.subject || `${item.type} updated`,
        detail: item.status || "",
        at: item.dueAt,
        by: "",
      })),
    ...meetings
      .filter((item) => hasTimestamp(item.at))
      .map((item) => ({
        id: `timeline-meeting-${item.id}`,
        parentId: item.parentId,
        type: "Meeting" as const,
        title: item.title || "Meeting scheduled",
        detail: item.status || "Meeting activity",
        at: item.at,
        by: item.host,
      })),
    ...emails
      .filter((item) => hasTimestamp(item.sentAt))
      .map((item) => ({
        id: `timeline-email-${item.id}`,
        parentId: item.parentId,
        type: "Email" as const,
        title: item.subject || "Email activity",
        detail: item.previewText || item.status,
        at: item.sentAt,
        by: item.sentBy,
      })),
    ...attachments
      .filter((item) => hasTimestamp(item.uploadedAt))
      .map((item) => ({
        id: `timeline-attachment-${item.id}`,
        parentId: item.parentId,
        type: "Update" as const,
        title: "Attachment added",
        detail: item.fileName,
        at: item.uploadedAt,
        by: item.uploadedBy,
      })),
    ...products
      .filter((item) => hasTimestamp(item.createdAt))
      .map((item) => ({
        id: `timeline-product-${item.id}`,
        parentId: item.parentId,
        type: "Update" as const,
        title: "Product linked",
        detail: item.productName,
        at: item.createdAt || "",
        by: "",
      })),
    ...quotes
      .filter((item) => hasTimestamp(item.createdAt))
      .map((item) => ({
        id: `timeline-quote-${item.id}`,
        parentId: item.parentId,
        type: "Update" as const,
        title: "Quote created",
        detail: [item.quoteName, item.status].filter(Boolean).join(" • "),
        at: item.createdAt || "",
        by: "",
      })),
    ...salesOrders
      .filter((item) => hasTimestamp(item.createdAt))
      .map((item) => ({
        id: `timeline-sales-order-${item.id}`,
        parentId: item.parentId,
        type: "Update" as const,
        title: "Sales order created",
        detail: [item.orderNumber, item.status].filter(Boolean).join(" • "),
        at: item.createdAt || "",
        by: "",
      })),
    ...purchaseOrders
      .filter((item) => hasTimestamp(item.createdAt))
      .map((item) => ({
        id: `timeline-purchase-order-${item.id}`,
        parentId: item.parentId,
        type: "Update" as const,
        title: "Purchase order created",
        detail: [item.poNumber, item.status].filter(Boolean).join(" • "),
        at: item.createdAt || "",
        by: "",
      })),
    ...invoices
      .filter((item) => hasTimestamp(item.createdAt))
      .map((item) => ({
        id: `timeline-invoice-${item.id}`,
        parentId: item.parentId,
        type: "Update" as const,
        title: "Invoice created",
        detail: [item.invoiceNumber, item.status].filter(Boolean).join(" • "),
        at: item.createdAt || "",
        by: "",
      })),
    ...cases
      .filter((item) => hasTimestamp(item.createdAt))
      .map((item) => ({
        id: `timeline-case-${item.id}`,
        parentId: item.parentId,
        type: "Update" as const,
        title: "Case created",
        detail: [item.caseNumber, item.subject, item.status].filter(Boolean).join(" • "),
        at: item.createdAt || "",
        by: "",
      })),
    ...solutions
      .filter((item) => hasTimestamp(item.createdAt))
      .map((item) => ({
        id: `timeline-solution-${item.id}`,
        parentId: item.parentId,
        type: "Update" as const,
        title: "Solution created",
        detail: [item.solutionNumber, item.solutionTitle, item.status].filter(Boolean).join(" • "),
        at: item.createdAt || "",
        by: "",
      })),
  ];

  const dedupedItems = [...existing, ...syntheticItems].filter((item, index, list) => {
    const key = `${item.id}|${item.type}|${item.title}|${item.at}`;
    return list.findIndex((entry) => `${entry.id}|${entry.type}|${entry.title}|${entry.at}` === key) === index;
  });

  return sortTimeline(dedupedItems);
}
