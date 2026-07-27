import type { FilterSection } from "../lib/shared/crmTypes";
import type { SupportImportOperation, SupportModuleKey } from "./types";

export const caseOriginOptions = ["Email", "Phone", "Web", "Chat", "Portal"];
export const caseStatusOptions = ["New", "Open", "On Hold", "Escalated", "Closed"];
export const casePriorityOptions = ["Low", "Medium", "High", "Urgent"];
export const caseTypeOptions = ["Problem", "Question", "Feature Request", "Complaint"];
export const caseReasonOptions = ["Installation", "Product Issue", "Payment", "Training", "Other"];
export const solutionStatusOptions = ["Draft", "Published", "Archived"];

export const supportImportSteps = [
  "Upload",
  "Operation",
  "Mapping",
  "Default Values",
  "Finish",
] as const;

export const supportModuleMeta: Record<
  SupportModuleKey,
  {
    title: string;
    singular: string;
    baseRoute: string;
    importRoute: string;
    createRoute: string;
    emptyTitle: string;
    emptyDescription: string;
    createLabel: string;
    importLabel: string;
    rowColumns: Array<{ key: string; label: string }>;
    filterSections: FilterSection[];
    relatedListItems: string[];
    importDuplicateOptions: string[];
    importFieldOptions: string[];
    importRequiredFields: string[];
  }
> = {
  cases: {
    title: "Cases",
    singular: "Case",
    baseRoute: "/support/cases",
    importRoute: "/support/cases/import",
    createRoute: "/support/cases/create",
    emptyTitle: "Start tracking customer issues",
    emptyDescription:
      "Manage support requests, connect them to contacts, products, accounts, and deals, and close the loop with reusable solutions.",
    createLabel: "Create Case",
    importLabel: "Import Cases",
    rowColumns: [
      { key: "caseNumber", label: "Case Number" },
      { key: "subject", label: "Subject" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "caseOrigin", label: "Case Origin" },
      { key: "relatedTo", label: "Related To" },
      { key: "accountName", label: "Account Name" },
    ],
    filterSections: [
      {
        title: "Case Filters",
        items: [
          { label: "Case Number", key: "case_number" },
          { label: "Case Origin", key: "case_origin" },
          { label: "Case Owner", key: "case_owner" },
          { label: "Case Reason", key: "case_reason" },
          { label: "Company", key: "company" },
          { label: "Country", key: "country" },
          { label: "Email", key: "email" },
          { label: "Account Name", key: "account_name" },
          { label: "Deal Name", key: "deal_name" },
          { label: "Status", key: "status" },
          { label: "Priority", key: "priority" },
        ],
      },
    ],
    relatedListItems: [
      "Notes",
      "Connected Records",
      "Attachments",
      "Open Activities",
      "Closed Activities",
      "Emails",
      "Comments",
      "Links",
    ],
    importDuplicateOptions: ["case_number", "subject", "email"],
    importFieldOptions: [
      "subject",
      "status",
      "priority",
      "case_origin",
      "case_reason",
      "type",
      "product",
      "related_contact",
      "account",
      "deal",
      "phone",
      "lead_name",
      "lead_source",
      "reported_by",
      "email",
      "company",
      "country",
      "description",
      "internal_comments",
      "solution_text",
      "owner",
    ],
    importRequiredFields: ["subject"],
  },
  solutions: {
    title: "Solutions",
    singular: "Solution",
    baseRoute: "/support/solutions",
    importRoute: "/support/solutions/import",
    createRoute: "/support/solutions/create",
    emptyTitle: "Build your knowledge base",
    emptyDescription:
      "Store reusable fixes and answers so support teams can resolve cases faster and keep knowledge connected to products.",
    createLabel: "Create Solution",
    importLabel: "Import Solutions",
    rowColumns: [
      { key: "solutionNumber", label: "Solution Number" },
      { key: "solutionTitle", label: "Solution Title" },
      { key: "status", label: "Status" },
      { key: "owner", label: "Solution Owner" },
    ],
    filterSections: [
      {
        title: "Solution Filters",
        items: [
          { label: "Solution Number", key: "solution_number" },
          { label: "Solution Title", key: "solution_title" },
          { label: "Solution Owner", key: "solution_owner" },
          { label: "Product Name", key: "product_name" },
          { label: "Status", key: "status" },
          { label: "Created By", key: "created_by" },
          { label: "Modified By", key: "modified_by" },
          { label: "No. of Comments", key: "no_of_comments" },
        ],
      },
    ],
    relatedListItems: [
      "Notes",
      "Connected Records",
      "Attachments",
      "Comments",
      "Links",
    ],
    importDuplicateOptions: ["solution_number", "solution_title"],
    importFieldOptions: [
      "solution_title",
      "status",
      "question",
      "answer",
      "owner",
      "product",
      "connected_to",
    ],
    importRequiredFields: ["solution_title", "question", "answer"],
  },
};

export const supportImportOperationLabels: Record<SupportImportOperation, string> = {
  add: "Add as new records",
  update: "Update existing records only",
  both: "Both",
};

