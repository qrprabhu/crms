import type {
  CRMColumn,
  CRMDetailSection,
  CRMModuleConfig,
  CRMRowAction,
  CRMSummaryField,
  FilterSection,
  Deal,
} from "../../../lib/shared/crmTypes";

const dealColumns: CRMColumn<Deal>[] = [
  { key: "dealId", label: "Deal ID", minWidth: "min-w-[180px]" },
  { key: "dealName", label: "Deal Name", minWidth: "min-w-[220px]" },
  { key: "accountName", label: "Account Name" },
  { key: "dealOwner", label: "Deal Owner" },
  { key: "stage", label: "Stage" },
  { key: "amount", label: "Amount" },
  { key: "type", label: "Deal Type" },
  { key: "closingDate", label: "Last Updated" },
];

export const dealFilterSections: FilterSection[] = [
  {
    title: "System Defined Filters",
    items: [
      { label: "Qualification", key: "stage", value: "Qualification" },
      { label: "Needs Analysis", key: "stage", value: "Needs Analysis" },
      { label: "Value Proposition", key: "stage", value: "Value Proposition" },
      { label: "Identify Decision Makers", key: "stage", value: "Identify Decision Makers" },
      { label: "Proposal / Price Quote", key: "stage", value: "Proposal / Price Quote" },
      { label: "Negotiation / Review", key: "stage", value: "Negotiation / Review" },
      { label: "Closed Won", key: "stage", value: "Closed Won" },
      { label: "Closed Lost", key: "stage", value: "Closed Lost" },
    ],
  },
  {
    title: "Filter By Fields",
    items: ["Deal Name", "Account Name", "Deal Owner", "Stage", "Type"],
  },
  {
    title: "Filter By Related Modules",
    items: ["Contacts", "Accounts", "Cases", "Solutions", "Quotes", "Sales Orders", "Invoices", "Notes"],
  },
];

const dealRowActions: CRMRowAction[] = [
  { key: "edit", label: "Edit" },
  { key: "send-email", label: "Send Email" },
  { key: "create-task", label: "Create Task" },
  { key: "add-tags", label: "Add Tags" },
  { key: "delete", label: "Delete", destructive: true },
  { key: "copy-url", label: "Copy URL" },
];

const dealSummaryFields: CRMSummaryField<Deal>[] = [
  { key: "stage", label: "Stage" },
  { key: "amount", label: "Amount" },
  { key: "dealOwner", label: "Deal Owner" },
  { key: "closingDate", label: "Last Updated" },
];

const dealDetailSections: CRMDetailSection<Deal>[] = [
  {
    id: "deal-summary",
    title: "Deal Summary",
    type: "summary",
    fields: [
      { key: "dealName", label: "Deal Name" },
      { key: "accountName", label: "Account" },
      { key: "type", label: "Deal Type" },
    ],
  },
  {
    id: "deal-info",
    title: "Deal Information",
    type: "info",
    fields: [
      { key: "accountName", label: "Account" },
      { key: "contactName", label: "Contact" },
      { key: "stage", label: "Stage" },
      { key: "amount", label: "Amount" },
      { key: "dealOwner", label: "Deal Owner" },
      { key: "closingDate", label: "Closing Date" },
      { key: "leadName", label: "Lead" },
    ],
  },
  { id: "products-section", title: "Products / Line Items", type: "products" },
  { id: "accounts-section", title: "Accounts", type: "accounts" },
  { id: "contacts-section", title: "Contacts", type: "contacts" },
  { id: "services-section", title: "Services", type: "services" },
  { id: "connected-records-section", title: "Connected Records", type: "connected-records" },
  { id: "cases-section", title: "Cases", type: "cases" },
  { id: "solutions-section", title: "Solutions", type: "solutions" },
  { id: "quotes-section", title: "Quotes", type: "quotes" },
  { id: "sales-orders-section", title: "Sales Orders", type: "sales-orders" },
  { id: "invoices-section", title: "Invoices", type: "invoices" },
  { id: "emails-section", title: "Emails", type: "emails" },
  { id: "notes-section", title: "Notes", type: "notes" },
];

export const dealModuleConfig: CRMModuleConfig<Deal> = {
  module: "deals",
  title: "Deals",
  subtitle: "All Deals",
  baseRoute: "/deals",
  nameKey: "dealName",
  subtitleKey: "accountName",
  columns: dealColumns,
  summaryFields: dealSummaryFields,
  detailSections: dealDetailSections,
  relatedListItems: ["Products", "Accounts", "Contacts", "Services", "Connected Records", "Cases", "Solutions", "Quotes", "Sales Orders", "Invoices", "Emails", "Notes"],
  headerActions: ["Add Tags", "Send Email", "Create Task", "More"],
  rowActions: dealRowActions,
  filterSections: dealFilterSections,
  sortFields: ["Deal ID", "Deal Name"],
  sortFieldKeyMap: {
    "Deal ID": "dealId",
    "Deal Name": "dealName",
  },
};
