import type { CRMModuleConfig, CRMRowAction, FilterSection, LeadRecord } from "../../../lib/shared/crmTypes";

export const leadFilterSections: FilterSection[] = [
  {
    title: "System Defined Filters",
    items: ["Touched Records", "Untouched Records", "Record Action", "Locked", "Latest Email Status", "Activities"],
  },
  {
    title: "Filter By Fields",
    items: [
      { label: "Full Name", key: "leadName" },
      { label: "Lead Owner", key: "leadOwner" },
      { label: "Company", key: "company" },
      { label: "Email", key: "email" },
      { label: "Phone", key: "phone" },
      { label: "Lead Source", key: "leadSource" },
      { label: "Lead Status", key: "leadStatus" },
      { label: "Industry", key: "industry" },
      { label: "Annual Revenue", key: "annualRevenue" },
      { label: "Created Time", key: "createdAt" },
      { label: "Modified Time", key: "updatedAt" },
      "Last Activity Time",
      "Tag",
    ],
  },
  {
    title: "Filter By Related Modules",
    items: ["Contacts", "Accounts", "Deals", "Cases", "Calls", "Meetings", "Tasks", "Emails"],
  },
];
import { leadColumns } from "./leadColumns";
import { leadRelatedList } from "./leadRelatedList";
import { leadSections, leadSummaryFields } from "./leadSections";

export const leadRowActions: CRMRowAction[] = [
  { key: "edit", label: "Edit" },
  { key: "send-email", label: "Send Email" },
  { key: "create-task", label: "Create Task" },
  { key: "convert", label: "Convert" },
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

// export const leadsMockList: LeadRecord[] = [
//   {
//     id: "lead-1",
//     leadName: "Aarav Sharma",
//     firstName: "Aarav",
//     lastName: "Sharma",
//     company: "Zenith Labs",
//     title: "Procurement Manager",
//     email: "aarav.sharma@zenithlabs.com",
//     secondaryEmail: "aarav.personal@gmail.com",
//     phone: "+1 555 120 101",
//     mobile: "+1 555 120 102",
//     leadSource: "Website",
//     leadOwner: "Priya Nair",
//     leadStatus: "Qualified",
//     industry: "Biotech",
//     annualRevenue: 5200000,
//     website: "zenithlabs.com",
//     noOfEmployees: 340,
//     rating: "Hot",
//     fax: "+1 555 120 103",
//     address: "128 Market Street",
//     city: "Austin",
//     state: "TX",
//     zipCode: "73301",
//     country: "USA",
//     description: "Interested in enterprise CRM rollout.",
//     createdBy: "Admin",
//     createdAt: "2026-01-12T09:20:00Z",
//     updatedBy: "Priya Nair",
//     updatedAt: "2026-03-02T11:45:00Z",
//   },
//   {
//     id: "lead-2",
//     leadName: "Maya Patel",
//     firstName: "Maya",
//     lastName: "Patel",
//     company: "Orion Retail",
//     title: "Director",
//     email: "maya.patel@orionretail.com",
//     secondaryEmail: "",
//     phone: "+1 555 210 401",
//     mobile: "+1 555 210 402",
//     leadSource: "Referral",
//     leadOwner: "Rahul Das",
//     leadStatus: "Contacted",
//     industry: "Retail",
//     annualRevenue: 4100000,
//     website: "orionretail.com",
//     noOfEmployees: 210,
//     rating: "Warm",
//     fax: "+1 555 210 403",
//     address: "42 Elm Road",
//     city: "Chicago",
//     state: "IL",
//     zipCode: "60601",
//     country: "USA",
//     description: "Needs pricing revision.",
//     createdBy: "Admin",
//     createdAt: "2026-01-16T10:15:00Z",
//     updatedBy: "Rahul Das",
//     updatedAt: "2026-03-04T08:11:00Z",
//   },
// ];

// export const leadNotes: Note[] = [
//   { id: "ln-1", parentId: "lead-1", title: "Discovery", content: "Requested annual plan.", createdAt: "2026-03-01T09:20:00Z", createdBy: "Priya Nair" },
// ];
// export const leadDeals: Deal[] = [
//   { id: "ld-1", parentId: "lead-1", dealName: "Zenith Annual Subscription", amount: 52000, stage: "Negotiation", probability: 70, closingDate: "2026-04-15", type: "New Business" },
// ];
// export const leadOpenActivities: Activity[] = [
//   { id: "loa-1", parentId: "lead-1", type: "Task", subject: "Share proposal", dueAt: "2026-03-12T11:00:00Z", status: "Open" },
// ];
// export const leadClosedActivities: Activity[] = [
//   { id: "lca-1", parentId: "lead-2", type: "Task", subject: "Send brochure", dueAt: "2026-02-28T10:00:00Z", status: "Completed" },
// ];
// export const leadMeetings: Meeting[] = [
//   { id: "lm-1", parentId: "lead-1", title: "Quarterly Planning", at: "2026-03-18T15:00:00Z", host: "Priya Nair", status: "Scheduled" },
// ];
// export const leadProducts: Product[] = [
//   { id: "lp-1", parentId: "lead-1", productName: "CRM Enterprise", quantity: 120, amount: 48000 },
// ];
// export const leadEmails: EmailRecord[] = [
//   { id: "le-1", parentId: "lead-1", subject: "Follow-up: Enterprise Rollout", sentAt: "2026-03-06T09:40:00Z", sentBy: "Priya Nair", status: "Sent" },
// ];
// export const leadAttachments: Attachment[] = [
//   { id: "lat-1", parentId: "lead-1", fileName: "proposal-v2.pdf", fileType: "PDF", uploadedAt: "2026-03-04T10:00:00Z", uploadedBy: "Priya Nair" },
// ];
// export const leadConnectedRecords: ConnectedRecord[] = [
//   { id: "lcr-1", parentId: "lead-1", recordType: "Account", name: "Zenith Labs", owner: "Priya Nair", status: "Active" },
// ];
// export const leadTimeline: TimelineItem[] = [
//   { id: "lt-1", parentId: "lead-1", type: "Note", title: "Negotiation notes", detail: "Captured key terms", at: "2026-03-05T09:30:00Z", by: "Priya Nair" },
//   { id: "lt-2", parentId: "lead-1", type: "Call", title: "Procurement call", detail: "Confirmed billing cycle", at: "2026-03-06T14:10:00Z", by: "Priya Nair" },
// ];

export const leadModuleConfig: CRMModuleConfig<LeadRecord> = {
  module: "leads",
  title: "Leads",
  subtitle: "All Leads",
  baseRoute: "/leads",
  nameKey: "leadName",
  subtitleKey: "company",
  columns: leadColumns,
  summaryFields: leadSummaryFields,
  detailSections: leadSections,
  relatedListItems: [...leadRelatedList],
  headerActions: ["Convert", "Add Tags", "Send Email", "Edit", "More"],
  rowActions: leadRowActions,
  filterSections: leadFilterSections,
  sortFields: ["Lead ID", "Lead Name"],
  sortFieldKeyMap: {
    "Lead ID": "id",
    "Lead Name": "leadName",
  },
};
