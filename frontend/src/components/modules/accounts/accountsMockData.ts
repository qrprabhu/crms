import type {
  AccountRecord,
  Activity,
  Attachment,
  Case,
  CRMModuleConfig,
  CRMRowAction,
  Deal,
  EmailRecord,
  Invoice,
  Note,
  Product,
  Quote,
  SalesOrder,
  TimelineItem,
  ConnectedRecord,
} from "../../../lib/shared/crmTypes";
import { accountColumns } from "./accountColumns";
import { accountRelatedList } from "./accountRelatedList";
import { accountSections, accountSummaryFields } from "./accountSections";

export const accountRowActions: CRMRowAction[] = [
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

export const accountsMockList: AccountRecord[] = [
  {
    id: "account-1",
    accountName: "Zenith Labs",
    accountOwner: "Priya Nair",
    accountSite: "HQ",
    parentAccount: "",
    accountNumber: "AC-1001",
    rating: "Hot",
    phone: "+1 555 120 101",
    fax: "+1 555 120 103",
    website: "zenithlabs.com",
    tickerSymbol: "ZLT",
    ownership: "Private",
    industry: "Biotech",
    employees: 340,
    annualRevenue: 5200000,
    sicCode: "2834",
    description: "Strategic enterprise account.",
    createdAt: "2026-01-10T09:20:00Z",
    updatedAt: "2026-03-02T11:45:00Z",
  },
  {
    id: "account-2",
    accountName: "Orion Retail",
    accountOwner: "Rahul Das",
    accountSite: "Main",
    parentAccount: "",
    accountNumber: "AC-1002",
    rating: "Warm",
    phone: "+1 555 210 401",
    fax: "+1 555 210 403",
    website: "orionretail.com",
    tickerSymbol: "ORT",
    ownership: "Public",
    industry: "Retail",
    employees: 210,
    annualRevenue: 4100000,
    sicCode: "5311",
    description: "Retail expansion opportunity.",
    createdAt: "2026-01-15T10:15:00Z",
    updatedAt: "2026-03-04T08:11:00Z",
  },
];

export const accountNotes: Note[] = [
  { id: "an-1", parentId: "account-1", title: "Renewal strategy", content: "Renewal expected in Q2.", createdAt: "2026-03-01T09:20:00Z", createdBy: "Priya Nair" },
];
export const accountDeals: Deal[] = [
  { id: "ad-1", parentId: "account-1", dealName: "Zenith Expansion", amount: 52000, stage: "Negotiation", probability: 70, closingDate: "2026-04-15", type: "Upsell" },
];
export const accountOpenActivities: Activity[] = [
  { id: "aoa-1", parentId: "account-1", type: "Task", subject: "Send renewal proposal", dueAt: "2026-03-12T11:00:00Z", status: "Open" },
];
export const accountClosedActivities: Activity[] = [
  { id: "aca-1", parentId: "account-2", type: "Task", subject: "Share onboarding deck", dueAt: "2026-02-28T10:00:00Z", status: "Completed" },
];
export const accountProducts: Product[] = [
  { id: "ap-1", parentId: "account-1", productName: "CRM Enterprise", quantity: 120, amount: 48000 },
];
export const accountCases: Case[] = [
  { id: "acase-1", parentId: "account-1", caseNumber: "CASE-401", subject: "SSO setup issue", status: "Open", priority: "High" },
];
export const accountQuotes: Quote[] = [
  { id: "aq-1", parentId: "account-1", quoteName: "Annual Renewal Quote", amount: 18000, status: "Sent" },
];
export const accountSalesOrders: SalesOrder[] = [
  { id: "aso-1", parentId: "account-1", orderNumber: "SO-7001", amount: 15500, status: "Confirmed" },
];
export const accountInvoices: Invoice[] = [
  { id: "ainv-1", parentId: "account-1", invoiceNumber: "INV-5511", amount: 7200, status: "Paid" },
];
export const accountEmails: EmailRecord[] = [
  { id: "ae-1", parentId: "account-1", subject: "QBR Follow-up", sentAt: "2026-03-06T09:40:00Z", sentBy: "Priya Nair", status: "Sent" },
];
export const accountAttachments: Attachment[] = [
  { id: "aat-1", parentId: "account-1", fileName: "msa-v4.pdf", fileType: "PDF", uploadedAt: "2026-03-04T10:00:00Z", uploadedBy: "Priya Nair" },
];
export const accountConnectedRecords: ConnectedRecord[] = [
  { id: "acr-1", parentId: "account-1", recordType: "Contact", name: "Aarav Sharma", owner: "Priya Nair", status: "Active" },
];
export const accountTimeline: TimelineItem[] = [
  { id: "at-1", parentId: "account-1", type: "Update", title: "Owner update", detail: "Ownership retained by Priya Nair.", at: "2026-03-05T09:30:00Z", by: "System" },
  { id: "at-2", parentId: "account-1", type: "Email", title: "Contract thread", detail: "Contract terms shared with legal.", at: "2026-03-06T14:10:00Z", by: "Priya Nair" },
];

export const accountModuleConfig: CRMModuleConfig<AccountRecord> = {
  module: "accounts",
  title: "Accounts",
  subtitle: "All Accounts",
  baseRoute: "/accounts",
  nameKey: "accountName",
  subtitleKey: "industry",
  columns: accountColumns,
  summaryFields: accountSummaryFields,
  detailSections: accountSections,
  relatedListItems: [...accountRelatedList],
  headerActions: ["Add Tags", "Send Email", "Edit", "More"],
  rowActions: accountRowActions,
  filterSections: [
    {
      title: "System Defined Filters",
      items: ["Touched Records", "Untouched Records", "Record Action", "Locked"],
    },
    {
      title: "Filter By Fields",
      items: [
        { label: "Account Name", key: "accountName" },
        { label: "Account Owner", key: "accountOwner" },
        "Account Type",
        { label: "Industry", key: "industry" },
        { label: "Annual Revenue", key: "annualRevenue" },
        { label: "Phone", key: "phone" },
        { label: "Website", key: "website" },
        { label: "Parent Account", key: "parentAccount" },
        { label: "Rating", key: "rating" },
        { label: "Created Time", key: "createdAt" },
        { label: "Modified Time", key: "updatedAt" },
        "Last Activity Time",
        "Tag",
      ],
    },
    {
      title: "Filter By Related Modules",
      items: ["Contacts", "Deals", "Cases", "Emails", "Invoices", "Quotes", "Sales Orders"],
    },
  ],
};
