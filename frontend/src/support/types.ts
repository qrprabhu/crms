import type {
  Activity,
  Attachment,
  ConnectedRecord,
  EmailRecord,
  Note,
  TimelineItem,
} from "../lib/shared/crmTypes";

export type SupportModuleKey = "cases" | "solutions";

export type SupportLookupName = "products" | "accounts" | "contacts" | "vendors" | "deals" | "leads";

export type SupportLookupOption = {
  id: string;
  name: string;
  label: string;
  email?: string;
  phone?: string;
  accountId?: string;
  accountName?: string;
  dealId?: string;
  dealName?: string;
  productCode?: string;
  unitPrice?: number;
  source?: string;
};

export type CaseListItem = {
  id: string;
  caseNumber: string;
  subject: string;
  status: string;
  priority: string;
  caseOrigin: string;
  caseReason: string;
  type: string;
  relatedTo: string;
  accountName: string;
  productName: string;
  owner: string;
  company: string;
  country: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
};

export type SolutionListItem = {
  id: string;
  solutionNumber: string;
  solutionTitle: string;
  status: string;
  question: string;
  owner: string;
  productName: string;
  noOfComments: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
};

export type CaseFormData = {
  caseNumber?: string;
  subject: string;
  status: string;
  priority: string;
  caseOrigin: string;
  caseReason: string;
  type: string;
  description: string;
  internalComments: string;
  solutionText: string;
  reportedBy: string;
  email: string;
  company: string;
  country: string;
  phone: string;
  lead: string;
  leadLabel: string;
  leadName: string;
  leadSource: string;
  owner: string;
  ownerLabel: string;
  product: string;
  productLabel: string;
  relatedContact: string;
  relatedContactLabel: string;
  account: string;
  accountLabel: string;
  deal: string;
  dealLabel: string;
};

export type SolutionFormData = {
  solutionNumber?: string;
  solutionTitle: string;
  status: string;
  question: string;
  answer: string;
  resolutionSteps: string;
  owner: string;
  ownerLabel: string;
  sourceCase: string;
  sourceCaseNumber: string;
  product: string;
  productLabel: string;
};

export type SupportDetailRelatedData = {
  notes: Note[];
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    createdBy: string;
  }>;
  attachments: Attachment[];
  emails: EmailRecord[];
  connectedRecords: ConnectedRecord[];
  openActivities: Activity[];
  closedActivities: Activity[];
  links: Array<{ id: string; label: string; meta?: string }>;
};

export type CaseDetailData = {
  id: string;
  caseNumber: string;
  subject: string;
  subtitle: string;
  avatar: string;
  summary: Array<{ label: string; value: string }>;
  caseInformation: Array<{ label: string; value: string }>;
  descriptionInformation: Array<{ label: string; value: string }>;
  solutionInformation: Array<{ label: string; value: string }>;
  commentInformation: Array<{ label: string; value: string }>;
  timeline: TimelineItem[];
  related: SupportDetailRelatedData;
};

export type SolutionDetailData = {
  id: string;
  solutionNumber: string;
  solutionTitle: string;
  subtitle: string;
  avatar: string;
  summary: Array<{ label: string; value: string }>;
  solutionInformation: Array<{ label: string; value: string }>;
  descriptionInformation: Array<{ label: string; value: string }>;
  commentInformation: Array<{ label: string; value: string }>;
  timeline: TimelineItem[];
  related: SupportDetailRelatedData;
};

export type SupportImportSource = "file" | "other-crm";
export type SupportImportOperation = "add" | "update" | "both";

export type SupportImportFieldMapping = {
  sourceField: string;
  targetField: string;
  sampleValue?: string;
  defaultValue?: string;
};

export type SupportImportState = {
  module: SupportModuleKey;
  source: SupportImportSource;
  file: File | null;
  jobId?: string;
  operation: SupportImportOperation;
  duplicateCheckField: string;
  fieldMapping: SupportImportFieldMapping[];
  defaultValues: Record<string, string>;
  automationEnabled: boolean;
  warnings: string[];
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  status?: string;
};

export type SupportImportJob = {
  id: string;
  moduleType: SupportModuleKey;
  originalName: string;
  fileType: string;
  operation: string;
  duplicateCheckField: string;
  status: string;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  fieldMapping: Record<string, string>;
  defaultValues: Record<string, string>;
  automationEnabled: boolean;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  validationErrors: Array<Record<string, unknown>>;
  resultSummary: Record<string, unknown>;
};
