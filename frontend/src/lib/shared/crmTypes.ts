export type CRMModule =
  | "leads"
  | "contacts"
  | "accounts"
  | "deals"
  | "cases"
  | "solutions"
  | "products"
  | "price-books"
  | "quotes"
  | "sales-orders"
  | "purchase-orders"
  | "invoices"
  | "vendors"
  | "configurator";

export type LeadRecord = {
  id: string;
  leadName: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  email: string;
  secondaryEmail: string;
  phone: string;
  mobile: string;
  leadSource: string;
  leadOwner: string;
  leadStatus: string;
  industry: string;
  annualRevenue: number;
  website: string;
  noOfEmployees: number;
  rating: string;
  fax: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  skypeId?: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  ownerEmail?: string;
  tags?: string[];
  nextActivity?: {
    date: string;
    type: "call" | "task" | "meeting" | "other";
    action: string;
  };
  convertedAccountId?: string;
  convertedAccountName?: string;
  convertedContactId?: string;
  convertedContactName?: string;
  convertedDealId?: string;
  convertedDealName?: string;
};

export type ContactRecord = {
  id: string;
  contactId?: string;
  contactName: string;
  firstName: string;
  lastName: string;
  accountName: string;
  contactOwner: string;
  ownerEmail?: string;
  email: string;
  otherPhone: string;
  phone: string;
  mobile: string;
  fax: string;
  leadSource: string;
  vendorName: string;
  title: string;
  department: string;
  homePhone: string;
  tags: string[];
  avatar: string;
  createdAt: string;
  updatedAt: string;
  accountId?: string;
  createdFromLeadId?: string;
  createdFromLeadName?: string;
};

export type AccountRecord = {
  id: string;
  accountName: string;
  accountOwner: string;
  ownerEmail?: string;
  accountSite: string;
  parentAccount: string;
  accountNumber: string;
  rating: string;
  phone: string;
  fax: string;
  website: string;
  tickerSymbol: string;
  ownership: string;
  industry: string;
  employees: number;
  annualRevenue: number;
  sicCode: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type Deal = {
  id: string;
  dealId?: string;
  parentId: string;
  dealName: string;
  amount: number;
  stage: string;
  probability: number;
  closingDate: string;
  type: string;
  accountName?: string;
  accountId?: string;
  contactName?: string;
  contactId?: string;
  leadName?: string;
  leadId?: string;
  dealOwner?: string;
  ownerEmail?: string;
  value?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type InventoryProductRecord = {
  id: string;
  productName: string;
  productCode: string;
  owner: string;
  vendorName: string;
  manufacturer: string;
  productCategory: string;
  productType?: string;
  deploymentModel?: string;
  billingCycle?: string;
  licenseType?: string;
  unitPrice: number;
  tax: number;
  quantityInStock: number;
  reorderLevel: number;
  usageUnit: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportCaseRecord = {
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

export type SupportSolutionRecord = {
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

export type InventoryVendorRecord = {
  id: string;
  vendorName: string;
  email: string;
  phone: string;
  website: string;
  vendorOwner: string;
  category: string;
  createdAt: string;
  updatedAt: string;
};

export type PriceBookRecord = {
  id: string;
  name: string;
  owner: string;
  active: string;
  pricingModel: string;
  createdAt: string;
  updatedAt: string;
};

export type QuoteRecord = {
  id: string;
  subject: string;
  owner: string;
  quoteStage: string;
  billingCycle?: string;
  renewalStatus?: string;
  accountName: string;
  contactName: string;
  dealName: string;
  validUntil: string;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type SalesOrderRecord = {
  id: string;
  subject: string;
  owner: string;
  status: string;
  billingCycle?: string;
  renewalStatus?: string;
  accountName: string;
  contactName: string;
  dealName: string;
  dueDate: string;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderRecord = {
  id: string;
  subject: string;
  owner: string;
  status: string;
  vendorName: string;
  contactName: string;
  poNumber: string;
  dueDate: string;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type InventoryInvoiceRecord = {
  id: string;
  subject: string;
  owner: string;
  status: string;
  billingCycle?: string;
  renewalStatus?: string;
  accountName: string;
  contactName: string;
  dealName: string;
  invoiceDate: string;
  dueDate: string;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type ConfiguratorRecord = {
  id: string;
  name: string;
  targetModule: string;
  layout: string;
  subform: string;
  lookupField: string;
  active: string;
  createdAt: string;
  updatedAt: string;
};

export type CRMRecord =
  | LeadRecord
  | ContactRecord
  | AccountRecord
  | Deal
  | SupportCaseRecord
  | SupportSolutionRecord
  | InventoryProductRecord
  | InventoryVendorRecord
  | PriceBookRecord
  | QuoteRecord
  | SalesOrderRecord
  | PurchaseOrderRecord
  | InventoryInvoiceRecord
  | ConfiguratorRecord;

export type FilterSectionItem =
  | string
  | {
      label: string;
      key: string;
      value?: string;
    };

export type FilterSection = {
  title: string;
  items: FilterSectionItem[];
};

export type Note = {
  id: string;
  parentId: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy: string;
};

export type Activity = {
  id: string;
  parentId: string;
  type: "Task" | "Call";
  subject: string;
  dueAt: string;
  status: string;
};

export type Meeting = {
  id: string;
  parentId: string;
  title: string;
  at: string;
  host: string;
  status: string;
};

export type Product = {
  id: string;
  parentId: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
  amount: number;
  total?: number;
  createdAt?: string;
};

export type Case = {
  id: string;
  parentId: string;
  caseNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt?: string;
};

export type Solution = {
  id: string;
  parentId: string;
  solutionNumber: string;
  solutionTitle: string;
  status: string;
  createdAt?: string;
};

export type Quote = {
  id: string;
  parentId: string;
  quoteName: string;
  amount: number;
  status: string;
  createdAt?: string;
};

export type SalesOrder = {
  id: string;
  parentId: string;
  orderNumber: string;
  amount: number;
  status: string;
  createdAt?: string;
};

export type PurchaseOrder = {
  id: string;
  parentId: string;
  poNumber: string;
  amount: number;
  status: string;
  createdAt?: string;
};

export type Invoice = {
  id: string;
  parentId: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  createdAt?: string;
};

export type EmailRecord = {
  id: string;
  parentId: string;
  subject: string;
  sentAt: string;
  sentBy: string;
  status: "Draft" | "Sent" | "Received";
  previewText?: string;
  bodyText?: string;
};

export type Attachment = {
  id: string;
  parentId: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
};

export type ConnectedRecord = {
  id: string;
  parentId: string;
  recordType: string;
  name: string;
  owner: string;
  status: string;
  route?: string;
  meta?: string;
};

export type TimelineItem = {
  id: string;
  parentId: string;
  type: "Note" | "Call" | "Meeting" | "Task" | "Email" | "Update";
  title: string;
  detail: string;
  at: string;
  by: string;
};

export type CRMColumn<T extends CRMRecord> = {
  key: keyof T & string;
  label: string;
  minWidth?: string;
};

export type CRMRowAction = {
  key: string;
  label: string;
  destructive?: boolean;
  children?: CRMRowAction[];
};

export type CRMDetailField<T extends CRMRecord> = {
  key: keyof T & string;
  label: string;
};

export type CRMDetailSection<T extends CRMRecord> = {
  id: string;
  title: string;
  fields?: CRMDetailField<T>[];
  type:
    | "summary"
    | "info"
    | "attachments"
    | "cadences"
    | "deals"
    | "activities-open"
    | "activities-closed"
    | "meetings"
    | "products"
    | "price-books"
    | "cases"
    | "solutions"
    | "contacts"
    | "leads"
    | "accounts"
    | "quotes"
    | "sales-orders"
    | "purchase-orders"
    | "invoices"
    | "emails"
    | "notes"
    | "connected-records"
    | "services"
    | "social"
    | "links"
    | "generic";
};

export type CRMTabKey = "overview" | "timeline";

export type CRMSummaryField<T extends CRMRecord> = {
  key: keyof T & string;
  label: string;
};

export type CRMModuleConfig<T extends CRMRecord> = {
  module: CRMModule;
  title: string;
  subtitle: string;
  baseRoute: string;
  nameKey: keyof T & string;
  subtitleKey: keyof T & string;
  columns: CRMColumn<T>[];
  summaryFields: CRMSummaryField<T>[];
  detailSections: CRMDetailSection<T>[];
  relatedListItems: string[];
  headerActions: string[];
  rowActions: CRMRowAction[];
  filterSections?: FilterSection[];
  sortFields?: string[];
  sortFieldKeyMap?: Partial<Record<string, keyof T & string>>;
};
