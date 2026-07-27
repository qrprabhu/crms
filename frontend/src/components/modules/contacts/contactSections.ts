import type { CRMDetailSection, ContactRecord } from "../../../lib/shared/crmTypes";

export const contactSummaryFields: Array<{ key: keyof ContactRecord & string; label: string }> = [
  { key: "contactOwner", label: "Contact Owner" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "mobile", label: "Mobile" },
  { key: "department", label: "Department" },
];

export const contactSections: CRMDetailSection<ContactRecord>[] = [
  {
    id: "contact-information-section",
    title: "Contact Information",
    type: "info",
    fields: [
      { key: "contactOwner", label: "Contact Owner" },
      { key: "accountName", label: "Account Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "otherPhone", label: "Other Phone" },
      { key: "mobile", label: "Mobile" },
      { key: "fax", label: "Fax" },
      { key: "leadSource", label: "Lead Source" },
      { key: "contactName", label: "Contact Name" },
      { key: "vendorName", label: "Vendor Name" },
      { key: "title", label: "Title" },
      { key: "department", label: "Department" },
      { key: "homePhone", label: "Home Phone" },
    ],
  },
  { id: "attachments-section", title: "Attachments", type: "attachments" },
  { id: "cadences-section", title: "Cadences", type: "cadences" },
  { id: "deals-section", title: "Deals", type: "deals" },
  { id: "services-section", title: "Services", type: "services" },
  { id: "open-activities-section", title: "Open Activities", type: "activities-open" },
  { id: "closed-activities-section", title: "Closed Activities", type: "activities-closed" },
  { id: "invited-meetings-section", title: "Invited Meetings", type: "meetings" },
  { id: "products-section", title: "Products", type: "products" },
  { id: "cases-section", title: "Cases", type: "cases" },
  { id: "solutions-section", title: "Solutions", type: "solutions" },
  { id: "quotes-section", title: "Quotes", type: "quotes" },
  { id: "sales-orders-section", title: "Sales Orders", type: "sales-orders" },
  { id: "purchase-orders-section", title: "Purchase Orders", type: "purchase-orders" },
  { id: "emails-section", title: "Emails", type: "emails" },
  { id: "social-section", title: "Social", type: "social" },
  { id: "notes-section", title: "Notes", type: "notes" },
  { id: "connected-records-section", title: "Connected Records", type: "connected-records" },
];
