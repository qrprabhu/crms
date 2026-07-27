import type {
  Activity,
  Attachment,
  ConnectedRecord,
  CRMRecord,
  EmailRecord,
  Note,
  TimelineItem,
} from "../lib/shared/crmTypes";

export type InventoryModuleKey =
  | "vendors"
  | "products"
  | "price-books"
  | "quotes"
  | "sales-orders"
  | "purchase-orders"
  | "invoices"
  | "configurator";

export type LookupOption = {
  id: string;
  name: string;
  label: string;
  email?: string;
  phone?: string;
  productCode?: string;
  unitPrice?: number;
  accountId?: string;
  contactId?: string;
  dealId?: string;
  vendorId?: string;
  quoteId?: string;
  priceBookId?: string;
  pricingModel?: string;
};

export type InventoryLineItem = {
  id?: string;
  product: string;
  productName?: string;
  productCode?: string;
  quantity: number;
  listPrice: number;
  amount: number;
  discount: number;
  tax: number;
  total: number;
  rowDescription?: string;
};

export type InventoryAddressFields = {
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingCountry?: string;
  billingZipCode?: string;
  shippingStreet?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCountry?: string;
  shippingZipCode?: string;
};

export type InventoryBaseDetail = {
  id: string;
  name: string;
  subtitle: string;
  avatar: string;
  summary: Array<{ label: string; value: string }>;
  fields: Array<{ label: string; value: string }>;
  timeline: TimelineItem[];
  relatedSummary?: Record<string, number>;
};

export type InventoryRelatedListItem = {
  id: string;
  label: string;
  meta?: string;
  createdAt?: string;
  route?: string;
  kind?: "appointment" | "job-sheet";
};

export type InventoryRelatedData = {
  notes: Note[];
  openActivities: Activity[];
  closedActivities: Activity[];
  attachments: Attachment[];
  emails: EmailRecord[];
  connectedRecords: ConnectedRecord[];
  services?: InventoryRelatedListItem[];
  products?: InventoryRelatedListItem[];
  vendors?: InventoryRelatedListItem[];
  priceBooks?: InventoryRelatedListItem[];
  quotes?: InventoryRelatedListItem[];
  salesOrders?: InventoryRelatedListItem[];
  purchaseOrders?: InventoryRelatedListItem[];
  invoices?: InventoryRelatedListItem[];
  contacts?: InventoryRelatedListItem[];
  accounts?: InventoryRelatedListItem[];
  deals?: InventoryRelatedListItem[];
  leads?: InventoryRelatedListItem[];
  cases?: InventoryRelatedListItem[];
  solutions?: InventoryRelatedListItem[];
  links?: InventoryRelatedListItem[];
  cadences?: InventoryRelatedListItem[];
};

export type InventoryDetailResponse = InventoryBaseDetail &
  InventoryAddressFields & {
    description?: string;
    termsAndConditions?: string;
    items?: InventoryLineItem[];
  };

export type ProductFormValues = InventoryAddressFields & {
  owner?: string;
  productName: string;
  productCode: string;
  vendor?: string;
  vendorLabel?: string;
  manufacturer?: string;
  productCategory?: string;
  productType?: string;
  deploymentModel?: string;
  billingCycle?: string;
  licenseType?: string;
  unitPrice: number;
  commissionRate: number;
  tax: number;
  quantityInStock: number;
  quantityInDemand: number;
  reorderLevel: number;
  usageUnit?: string;
  defaultUserSeats?: number;
  subscriptionTermMonths?: number;
  renewalRequired?: boolean;
  implementationRequired?: boolean;
  supportStartDate?: string;
  supportExpiryDate?: string;
  description?: string;
};

export type VendorFormValues = InventoryAddressFields & {
  vendorOwner?: string;
  vendorName: string;
  email?: string;
  phone?: string;
  website?: string;
  category?: string;
  description?: string;
};

export type PriceBookRangeForm = {
  id?: string;
  fromRange: number;
  toRange: number;
  discountPercentage: number;
};

export type PriceBookProductLinkForm = {
  id?: string;
  product: string;
  productLabel?: string;
  listPrice: number;
  active: boolean;
};

export type PriceBookFormValues = {
  owner?: string;
  name: string;
  active: boolean;
  pricingModel: string;
  description?: string;
  ranges: PriceBookRangeForm[];
  productLinks: PriceBookProductLinkForm[];
};

export type QuoteFormValues = InventoryAddressFields & {
  owner?: string;
  subject: string;
  quoteStage?: string;
  team?: string;
  carrier?: string;
  priceBook?: string;
  priceBookLabel?: string;
  deal?: string;
  dealLabel?: string;
  validUntil?: string;
  contact?: string;
  contactLabel?: string;
  account?: string;
  accountLabel?: string;
  billingCycle?: string;
  licenseType?: string;
  licensedUsers?: number;
  implementationRequired?: boolean;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  renewalDueDate?: string;
  subtotal: number;
  discount: number;
  tax: number;
  adjustment: number;
  grandTotal: number;
  termsAndConditions?: string;
  description?: string;
  items: InventoryLineItem[];
};

export type SalesOrderFormValues = InventoryAddressFields & {
  owner?: string;
  subject: string;
  customerNo?: string;
  quote?: string;
  quoteLabel?: string;
  pending: boolean;
  carrier?: string;
  salesCommission: number;
  account?: string;
  accountLabel?: string;
  deal?: string;
  dealLabel?: string;
  dueDate?: string;
  contact?: string;
  contactLabel?: string;
  billingCycle?: string;
  licenseType?: string;
  licensedUsers?: number;
  implementationRequired?: boolean;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  renewalDueDate?: string;
  exciseDuty: number;
  status?: string;
  subtotal: number;
  discount: number;
  tax: number;
  adjustment: number;
  grandTotal: number;
  termsAndConditions?: string;
  description?: string;
  items: InventoryLineItem[];
};

export type PurchaseOrderFormValues = InventoryAddressFields & {
  owner?: string;
  subject: string;
  requisitionNumber?: string;
  contact?: string;
  contactLabel?: string;
  dueDate?: string;
  exciseDuty: number;
  status?: string;
  poNumber?: string;
  vendor?: string;
  vendorLabel?: string;
  trackingNumber?: string;
  poDate?: string;
  carrier?: string;
  salesCommission: number;
  subtotal: number;
  discount: number;
  tax: number;
  adjustment: number;
  grandTotal: number;
  termsAndConditions?: string;
  description?: string;
  items: InventoryLineItem[];
};

export type InvoiceFormValues = InventoryAddressFields & {
  owner?: string;
  subject: string;
  invoiceDate?: string;
  dueDate?: string;
  salesCommission: number;
  account?: string;
  accountLabel?: string;
  contact?: string;
  contactLabel?: string;
  deal?: string;
  dealLabel?: string;
  salesOrder?: string;
  salesOrderLabel?: string;
  purchaseOrder?: string;
  purchaseOrderLabel?: string;
  billingCycle?: string;
  licenseType?: string;
  licensedUsers?: number;
  implementationRequired?: boolean;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  renewalDueDate?: string;
  exciseDuty: number;
  status?: string;
  subtotal: number;
  discount: number;
  tax: number;
  adjustment: number;
  grandTotal: number;
  termsAndConditions?: string;
  description?: string;
  items: InventoryLineItem[];
};

export type ConfiguratorRuleForm = {
  id?: string;
  configurator?: string;
  criteria: string;
  actionType: "mandatory_product" | "suggest_product" | "field_update";
  targetProduct?: string;
  targetProductLabel?: string;
  fieldName?: string;
  fieldValue?: string;
  metadata?: string;
};

export type ConfiguratorFormValues = {
  name: string;
  targetModule: string;
  layout?: string;
  subform?: string;
  lookupField?: string;
  description?: string;
  active: boolean;
  rules: ConfiguratorRuleForm[];
};

export type InventoryFormValues =
  | ProductFormValues
  | VendorFormValues
  | PriceBookFormValues
  | QuoteFormValues
  | SalesOrderFormValues
  | PurchaseOrderFormValues
  | InvoiceFormValues
  | ConfiguratorFormValues;

export type InventoryListRecord = CRMRecord;

export type PriceBookImportState = {
  source: "file" | "other-crm";
  file?: File | null;
  operation: "add_new" | "update_existing" | "both";
  duplicateHandling: "skip" | "overwrite";
  fieldMapping: Array<{
    sourceField: string;
    targetField: string;
    defaultValue?: string;
  }>;
  scheduleAutomation: boolean;
};
