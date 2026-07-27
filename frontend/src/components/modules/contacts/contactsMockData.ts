import type {
  Activity,
  Attachment,
  Case,
  ConnectedRecord,
  ContactRecord,
  CRMModuleConfig,
  CRMRowAction,
  Deal,
  EmailRecord,
  Meeting,
  Note,
  Product,
  PurchaseOrder,
  Quote,
  SalesOrder,
  TimelineItem,
} from "../../../lib/shared/crmTypes";
import { contactColumns } from "./contactColumns";
import { contactRelatedList } from "./contactRelatedList";
import { contactSections, contactSummaryFields } from "./contactSections";

export const contactRowActions: CRMRowAction[] = [
  { key: "edit", label: "Edit" },
  { key: "send-email", label: "Send Email" },
  { key: "create-task", label: "Create Task" },
  { key: "add-tags", label: "Add Tags" },
  { key: "delete", label: "Delete", destructive: true },
  { key: "copy-url", label: "Copy URL" },
  {
    key: "more",
    label: "More",
    children: [
      { key: "create-meeting", label: "Create Meeting" },
      {
        key: "create-call",
        label: "Create Call",
        children: [
          { key: "schedule-call", label: "Schedule a call" },
          { key: "log-call", label: "Log a call" },
        ],
      },
    ],
  },
];

export const contactsMockList: ContactRecord[] = [
  {
    id: "contact-1",
    contactName: "Aarav Sharma",
    firstName: "Aarav",
    lastName: "Sharma",
    accountName: "Zenith Labs",
    contactOwner: "Priya Nair",
    email: "aarav.sharma@zenithlabs.com",
    otherPhone: "+1 555 190 227",
    phone: "+1 555 120 101",
    mobile: "+1 555 120 102",
    fax: "+1 555 120 103",
    leadSource: "Website",
    vendorName: "Northline Vendors",
    title: "Procurement Manager",
    department: "Operations",
    homePhone: "+1 555 120 104",
    tags: ["Key Contact", "Enterprise"],
    avatar: "AS",
    createdAt: "2026-01-12T09:20:00Z",
    updatedAt: "2026-03-02T11:45:00Z",
  },
  {
    id: "contact-2",
    contactName: "Maya Patel",
    firstName: "Maya",
    lastName: "Patel",
    accountName: "Orion Retail",
    contactOwner: "Rahul Das",
    email: "maya.patel@orionretail.com",
    otherPhone: "+1 555 210 405",
    phone: "+1 555 210 401",
    mobile: "+1 555 210 402",
    fax: "+1 555 210 403",
    leadSource: "Referral",
    vendorName: "N/A",
    title: "Director",
    department: "Merchandising",
    homePhone: "+1 555 210 404",
    tags: ["Warm"],
    avatar: "MP",
    createdAt: "2026-01-16T10:15:00Z",
    updatedAt: "2026-03-04T08:11:00Z",
  },
];

export const contactNotes: Note[] = [
  { id: "cn-1", parentId: "contact-1", title: "Procurement Discussion", content: "Interested in annual contract.", createdAt: "2026-03-01T09:20:00Z", createdBy: "Priya Nair" },
];
export const contactDeals: Deal[] = [
  { id: "cd-1", parentId: "contact-1", dealName: "Zenith Annual Subscription", amount: 52000, stage: "Negotiation", probability: 70, closingDate: "2026-04-15", type: "New Business" },
];
export const contactOpenActivities: Activity[] = [
  { id: "coa-1", parentId: "contact-1", type: "Task", subject: "Share revised commercial proposal", dueAt: "2026-03-12T11:00:00Z", status: "Open" },
];
export const contactClosedActivities: Activity[] = [
  { id: "cca-1", parentId: "contact-2", type: "Task", subject: "Send product brochure", dueAt: "2026-02-28T10:00:00Z", status: "Completed" },
];
export const contactMeetings: Meeting[] = [
  { id: "cm-1", parentId: "contact-1", title: "Quarterly Planning", at: "2026-03-18T15:00:00Z", host: "Priya Nair", status: "Scheduled" },
];
export const contactProducts: Product[] = [
  { id: "cp-1", parentId: "contact-1", productName: "CRM Enterprise", quantity: 120, amount: 48000 },
];
export const contactCases: Case[] = [
  { id: "ccase-1", parentId: "contact-1", caseNumber: "CASE-3021", subject: "API authentication issue", status: "Open", priority: "High" },
];
export const contactQuotes: Quote[] = [
  { id: "cq-1", parentId: "contact-1", quoteName: "Q1 Expansion Quote", amount: 18500, status: "Sent" },
];
export const contactSalesOrders: SalesOrder[] = [
  { id: "cso-1", parentId: "contact-1", orderNumber: "SO-9142", amount: 15200, status: "Confirmed" },
];
export const contactPurchaseOrders: PurchaseOrder[] = [
  { id: "cpo-1", parentId: "contact-1", poNumber: "PO-7714", amount: 9800, status: "Approved" },
];
export const contactEmails: EmailRecord[] = [
  { id: "ce-1", parentId: "contact-1", subject: "Follow-up: Enterprise Rollout", sentAt: "2026-03-06T09:40:00Z", sentBy: "Priya Nair", status: "Sent" },
];
export const contactAttachments: Attachment[] = [
  { id: "cat-1", parentId: "contact-1", fileName: "contract-draft-v2.pdf", fileType: "PDF", uploadedAt: "2026-03-04T10:00:00Z", uploadedBy: "Priya Nair" },
];
export const contactConnectedRecords: ConnectedRecord[] = [
  { id: "ccr-1", parentId: "contact-1", recordType: "Account", name: "Zenith Labs", owner: "Priya Nair", status: "Active" },
];
export const contactTimeline: TimelineItem[] = [
  { id: "ct-1", parentId: "contact-1", type: "Note", title: "Negotiation notes", detail: "Captured terms", at: "2026-03-05T09:30:00Z", by: "Priya Nair" },
  { id: "ct-2", parentId: "contact-1", type: "Email", title: "Follow-up sent", detail: "Shared proposal details", at: "2026-03-06T14:10:00Z", by: "Priya Nair" },
];

export const contactModuleConfig: CRMModuleConfig<ContactRecord> = {
  module: "contacts",
  title: "Contacts",
  subtitle: "All Contacts",
  baseRoute: "/contacts",
  nameKey: "contactName",
  subtitleKey: "accountName",
  columns: contactColumns,
  summaryFields: contactSummaryFields,
  detailSections: contactSections,
  relatedListItems: [...contactRelatedList],
  headerActions: ["Convert", "Add Tags", "Send Email", "Edit", "More"],
  rowActions: contactRowActions,
  sortFields: ["Contact ID", "Contact Name"],
  sortFieldKeyMap: {
    "Contact ID": "contactId",
    "Contact Name": "contactName",
  },
  filterSections: [
    {
      title: "System Defined Filters",
      items: ["Touched Records", "Untouched Records", "Record Action", "Locked", "Latest Email Status", "Activities"],
    },
    {
      title: "Filter By Fields",
      items: [
        { label: "Full Name", key: "contactName" },
        { label: "Contact Owner", key: "contactOwner" },
        { label: "Account Name", key: "accountName" },
        { label: "Email", key: "email" },
        { label: "Phone", key: "phone" },
        { label: "Mobile", key: "mobile" },
        { label: "Contact Source", key: "leadSource" },
        { label: "Department", key: "department" },
        { label: "Title", key: "title" },
        { label: "Created Time", key: "createdAt" },
        { label: "Modified Time", key: "updatedAt" },
        "Last Activity Time",
        "Tag",
      ],
    },
    {
      title: "Filter By Related Modules",
      items: ["Accounts", "Deals", "Cases", "Calls", "Meetings", "Tasks", "Emails"],
    },
  ],
};
