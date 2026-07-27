import type {
  CRMColumn,
  CRMRecord,
  CRMRowAction,
  FilterSection,
  InventoryInvoiceRecord,
  InventoryProductRecord,
  InventoryVendorRecord,
  PriceBookRecord,
  PurchaseOrderRecord,
  QuoteRecord,
  SalesOrderRecord,
  ConfiguratorRecord,
} from "../lib/shared/crmTypes";
import type { InventoryModuleKey } from "./types";

export type InventoryModuleMeta<T extends CRMRecord> = {
  key: InventoryModuleKey;
  title: string;
  singular: string;
  baseRoute: string;
  importRoute?: string;
  createRoute?: string;
  emptyTitle: string;
  emptyDescription: string;
  createLabel: string;
  importLabel?: string;
  extraHeaderAction?: { label: string; route: string };
  columns: CRMColumn<T>[];
  filterSections: FilterSection[];
  relatedListItems: string[];
  rowActions: CRMRowAction[];
};

const defaultRowActions: CRMRowAction[] = [
  { key: "open", label: "Open" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete", destructive: true },
];

export const inventoryModules = {
  vendors: {
    key: "vendors",
    title: "Vendors",
    singular: "Vendor",
    baseRoute: "/vendors",
    emptyTitle: "Start your vendor network",
    emptyDescription: "Track supplier details, related products, and purchase orders from the same CRM workspace.",
    createLabel: "Create Vendor",
    columns: [
      { key: "vendorName", label: "Vendor Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "website", label: "Website" },
      { key: "vendorOwner", label: "Vendor Owner" },
    ],
    filterSections: [
      { title: "Vendor Filters", items: [{ label: "Vendor Name", key: "vendor_name" }, { label: "Category", key: "category" }] },
    ],
    relatedListItems: [
      "Notes",
      "Connected Records",
      "Cadences",
      "Attachments",
      "Products",
      "Purchase Orders",
      "Cases",
      "Solutions",
      "Contacts",
      "Open Activities",
      "Emails",
      "Closed Activities",
      "Add Related List",
      "Links",
    ],
    rowActions: defaultRowActions,
  } satisfies InventoryModuleMeta<InventoryVendorRecord>,
  products: {
    key: "products",
    title: "Products",
    singular: "Product",
    baseRoute: "/products",
    emptyTitle: "Start your software catalog",
    emptyDescription: "Create software plans, add-ons, and service packages that connect to quotes, subscriptions, invoices, renewals, and CRM records.",
    createLabel: "Create Product",
    importLabel: "Import Products",
    columns: [
      { key: "productName", label: "Product Name" },
      { key: "productCode", label: "SKU" },
      { key: "productType", label: "Type" },
      { key: "billingCycle", label: "Billing Cycle" },
      { key: "vendorName", label: "Vendor" },
      { key: "productCategory", label: "Category" },
      { key: "unitPrice", label: "Unit Price" },
      { key: "deploymentModel", label: "Deployment" },
    ],
    filterSections: [
      {
        title: "Product Filters",
        items: [
          { label: "Product Name", key: "product_name" },
          { label: "Product Code", key: "product_code" },
          { label: "Category", key: "product_category" },
        ],
      },
    ],
    relatedListItems: [
      "Notes",
      "Connected Records",
      "Attachments",
      "Services",
      "Vendors",
      "Price Books",
      "Quotes",
      "Sales Orders",
      "Purchase Orders",
      "Invoices",
      "Open Activities",
      "Closed Activities",
      "Cases",
      "Solutions",
      "Contacts",
      "Leads",
      "Deals",
      "Accounts",
      "Add Related List",
      "Links",
    ],
    rowActions: defaultRowActions,
  } satisfies InventoryModuleMeta<InventoryProductRecord>,
  "price-books": {
    key: "price-books",
    title: "Price Books",
    singular: "Price Book",
    baseRoute: "/price-books",
    importRoute: "/price-books/import",
    emptyTitle: "Build pricing logic once",
    emptyDescription: "Use price books to connect product pricing, ranges, and future import workflows for sales teams.",
    createLabel: "Create Price Book",
    importLabel: "Import Price Books",
    columns: [
      { key: "name", label: "Price Book Name" },
      { key: "owner", label: "Owner" },
      { key: "active", label: "Status" },
      { key: "pricingModel", label: "Pricing Model" },
      { key: "updatedAt", label: "Updated At" },
    ],
    filterSections: [
      { title: "Price Book Filters", items: [{ label: "Name", key: "name" }, { label: "Pricing Model", key: "pricing_model" }] },
    ],
    relatedListItems: ["Notes", "Products", "Quotes", "Cases", "Solutions", "Attachments", "Add Related List", "Links"],
    rowActions: defaultRowActions,
  } satisfies InventoryModuleMeta<PriceBookRecord>,
  quotes: {
    key: "quotes",
    title: "Quotes",
    singular: "Quote",
    baseRoute: "/quotes",
    emptyTitle: "Create your first quote",
    emptyDescription: "Prepare software proposals with plans, seats, billing cycles, renewals, and CRM deal context in the same flow.",
    createLabel: "Create Quote",
    extraHeaderAction: { label: "Try CPQ Now", route: "/configurator" },
    columns: [
      { key: "subject", label: "Subject" },
      { key: "quoteStage", label: "Quote Stage" },
      { key: "accountName", label: "Account" },
      { key: "contactName", label: "Contact" },
      { key: "validUntil", label: "Valid Until" },
      { key: "grandTotal", label: "Grand Total" },
    ],
    filterSections: [
      { title: "Quote Filters", items: [{ label: "Subject", key: "subject" }, { label: "Quote Stage", key: "quote_stage" }] },
    ],
    relatedListItems: [
      "Notes",
      "Connected Records",
      "Services",
      "Sales Orders",
      "Cases",
      "Solutions",
      "Attachments",
      "Open Activities",
      "Closed Activities",
      "Emails",
      "Add Related List",
      "Links",
    ],
    rowActions: [
      ...defaultRowActions,
      { key: "convert-to-sales-order", label: "Convert to Sales Order" },
    ],
  } satisfies InventoryModuleMeta<QuoteRecord>,
  "sales-orders": {
    key: "sales-orders",
    title: "Sales Orders",
    singular: "Sales Order",
    baseRoute: "/sales-orders",
    emptyTitle: "Start your order pipeline",
    emptyDescription: "Capture approved software subscriptions as sales orders and hand off billing and renewal tracking to invoices.",
    createLabel: "Create Sales Order",
    columns: [
      { key: "subject", label: "Subject" },
      { key: "status", label: "Status" },
      { key: "accountName", label: "Account" },
      { key: "contactName", label: "Contact" },
      { key: "dueDate", label: "Due Date" },
      { key: "grandTotal", label: "Grand Total" },
    ],
    filterSections: [
      { title: "Sales Order Filters", items: [{ label: "Subject", key: "subject" }, { label: "Status", key: "status" }] },
    ],
    relatedListItems: [
      "Notes",
      "Connected Records",
      "Attachments",
      "Services",
      "Invoices",
      "Cases",
      "Solutions",
      "Open Activities",
      "Closed Activities",
      "Emails",
      "Add Related List",
      "Links",
    ],
    rowActions: [
      ...defaultRowActions,
      { key: "convert-to-invoice", label: "Convert to Invoice" },
      { key: "create-service-appointment", label: "Schedule Service" },
      { key: "create-project", label: "Create Project" },
    ],
  } satisfies InventoryModuleMeta<SalesOrderRecord>,
  "purchase-orders": {
    key: "purchase-orders",
    title: "Purchase Orders",
    singular: "Purchase Order",
    baseRoute: "/purchase-orders",
    emptyTitle: "Purchase products from vendors",
    emptyDescription: "Run procurement with vendor-linked purchase orders that connect directly back to your inventory products.",
    createLabel: "Create Purchase Order",
    columns: [
      { key: "subject", label: "Subject" },
      { key: "vendorName", label: "Vendor" },
      { key: "poNumber", label: "PO Number" },
      { key: "status", label: "Status" },
      { key: "dueDate", label: "Due Date" },
      { key: "grandTotal", label: "Grand Total" },
    ],
    filterSections: [
      { title: "Purchase Order Filters", items: [{ label: "Subject", key: "subject" }, { label: "PO Number", key: "po_number" }, { label: "Status", key: "status" }] },
    ],
    relatedListItems: [
      "Notes",
      "Connected Records",
      "Attachments",
      "Services",
      "Cases",
      "Solutions",
      "Open Activities",
      "Closed Activities",
      "Emails",
      "Add Related List",
      "Links",
    ],
    rowActions: defaultRowActions,
  } satisfies InventoryModuleMeta<PurchaseOrderRecord>,
  invoices: {
    key: "invoices",
    title: "Invoices",
    singular: "Invoice",
    baseRoute: "/invoices",
    emptyTitle: "Generate software invoices from your CRM",
    emptyDescription: "Keep software invoicing tied to subscriptions, sales orders, deals, contacts, accounts, and future renewals.",
    createLabel: "Create Invoice",
    columns: [
      { key: "subject", label: "Subject" },
      { key: "status", label: "Status" },
      { key: "accountName", label: "Account" },
      { key: "invoiceDate", label: "Invoice Date" },
      { key: "dueDate", label: "Due Date" },
      { key: "grandTotal", label: "Grand Total" },
    ],
    filterSections: [
      { title: "Invoice Filters", items: [{ label: "Subject", key: "subject" }, { label: "Status", key: "status" }] },
    ],
    relatedListItems: [
      "Notes",
      "Connected Records",
      "Attachments",
      "Services",
      "Cases",
      "Solutions",
      "Open Activities",
      "Closed Activities",
      "Emails",
      "Add Related List",
      "Links",
    ],
    rowActions: [
      ...defaultRowActions,
      { key: "create-service-appointment", label: "Schedule Service" },
      { key: "create-project", label: "Create Project" },
    ],
  } satisfies InventoryModuleMeta<InventoryInvoiceRecord>,
  configurator: {
    key: "configurator",
    title: "Product Configurator",
    singular: "Configurator",
    baseRoute: "/configurator",
    emptyTitle: "Build product rules for CPQ",
    emptyDescription: "Define mandatory products, suggestions, and field updates that sales teams can trigger from quoting flows.",
    createLabel: "Create Configurator",
    columns: [
      { key: "name", label: "Name" },
      { key: "targetModule", label: "Target Module" },
      { key: "layout", label: "Layout" },
      { key: "subform", label: "Subform" },
      { key: "lookupField", label: "Lookup" },
      { key: "active", label: "Status" },
    ],
    filterSections: [
      { title: "Configurator Filters", items: [{ label: "Name", key: "name" }, { label: "Target Module", key: "target_module" }] },
    ],
    relatedListItems: ["Links"],
    rowActions: defaultRowActions,
  } satisfies InventoryModuleMeta<ConfiguratorRecord>,
} as const;

export function getInventoryMeta(moduleKey: InventoryModuleKey): InventoryModuleMeta<CRMRecord> {
  return inventoryModules[moduleKey] as InventoryModuleMeta<CRMRecord>;
}
