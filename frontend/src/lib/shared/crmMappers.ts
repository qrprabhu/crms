import type {
  AccountRecord,
  ContactRecord,
  Deal,
  LeadRecord,
  Note,
  TimelineItem,
} from "./crmTypes";
import type {
  AccountDto,
  ContactDto,
  DealDto,
  LeadDetailDto,
  LeadListItemDto,
  LeadNoteDto,
  LeadTimelineDto,
} from "../../api/crm";

function formatCurrency(value: string | number | null | undefined) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric === 0) return 0;
  return numeric;
}

function asDisplay(value: string | null | undefined, fallback = "-") {
  return value && value.trim() ? value : fallback;
}

export function mapLeadListItem(dto: LeadListItemDto): LeadRecord {
  return {
    id: String(dto.id),
    leadName: `${dto.first_name} ${dto.last_name}`.trim(),
    firstName: dto.first_name,
    lastName: dto.last_name,
    company: dto.company,
    title: "",
    email: dto.email,
    secondaryEmail: "",
    phone: asDisplay(dto.phone, ""),
    mobile: "",
    leadSource: asDisplay(dto.lead_source),
    leadOwner: dto.owner_email || (dto.owner ? `User #${dto.owner}` : "-"),
    leadStatus: "-",
    industry: "",
    annualRevenue: 0,
    website: "",
    noOfEmployees: 0,
    rating: "",
    fax: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    description: "",
    createdBy: "System",
    createdAt: dto.created_at,
    updatedBy: "System",
    updatedAt: dto.created_at,
  };
}

export function mapLeadDetail(dto: LeadDetailDto): LeadRecord {
  return {
    id: String(dto.id),
    leadName: `${dto.first_name} ${dto.last_name}`.trim(),
    firstName: dto.first_name,
    lastName: dto.last_name,
    company: dto.company,
    title: asDisplay(dto.title, ""),
    email: dto.email,
    secondaryEmail: asDisplay(dto.secondary_email, ""),
    phone: asDisplay(dto.phone, ""),
    mobile: asDisplay(dto.mobile, ""),
    leadSource: asDisplay(dto.lead_source),
    leadOwner: dto.owner_email || (dto.owner ? `User #${dto.owner}` : "-"),
    leadStatus: asDisplay(dto.lead_status),
    industry: asDisplay(dto.industry, ""),
    annualRevenue: formatCurrency(dto.annual_revenue),
    website: asDisplay(dto.website, ""),
    noOfEmployees: dto.employee_count || 0,
    rating: asDisplay(dto.rating, ""),
    fax: "",
    address: asDisplay(dto.street, ""),
    city: asDisplay(dto.city, ""),
    state: asDisplay(dto.state, ""),
    zipCode: asDisplay(dto.zip_code, ""),
    country: asDisplay(dto.country, ""),
    description: asDisplay(dto.description, ""),
    createdBy: "System",
    createdAt: dto.created_at,
    updatedBy: dto.owner_email || "System",
    updatedAt: dto.updated_at,
  };
}

export function mapLeadNote(dto: LeadNoteDto, leadId: string): Note {
  return {
    id: String(dto.id),
    parentId: leadId,
    title: dto.note,
    content: dto.note,
    createdAt: dto.created_at,
    createdBy: dto.created_by || "System",
  };
}

export function mapLeadTimeline(dto: LeadTimelineDto, leadId: string): TimelineItem {
  return {
    id: String(dto.id),
    parentId: leadId,
    type: "Update",
    title: dto.action,
    detail: dto.description || dto.action,
    at: dto.timestamp,
    by: dto.user || "System",
  };
}

export function mapAccount(dto: AccountDto): AccountRecord {
  return {
    id: String(dto.id),
    accountName: dto.name,
    accountOwner: dto.owner_email || (dto.owner ? `User #${dto.owner}` : "-"),
    accountSite: dto.city || "",
    parentAccount: "",
    accountNumber: `AC-${dto.id}`,
    rating: "",
    phone: asDisplay(dto.phone, ""),
    fax: "",
    website: asDisplay(dto.website, ""),
    tickerSymbol: "",
    ownership: "",
    industry: asDisplay(dto.industry, ""),
    employees: dto.employee_count || 0,
    annualRevenue: formatCurrency(dto.annual_revenue),
    sicCode: "",
    description: "",
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapContact(dto: ContactDto): ContactRecord {
  return {
    id: String(dto.id),
    contactName: `${dto.first_name} ${dto.last_name}`.trim(),
    firstName: dto.first_name,
    lastName: dto.last_name,
    accountName: dto.account_name || "-",
    contactOwner: dto.owner_email || (dto.owner ? `User #${dto.owner}` : "-"),
    email: asDisplay(dto.email, ""),
    otherPhone: "",
    phone: asDisplay(dto.phone, ""),
    mobile: asDisplay(dto.mobile, ""),
    fax: "",
    leadSource: "",
    vendorName: "",
    title: asDisplay(dto.title, ""),
    department: "",
    homePhone: "",
    tags: [],
    avatar: `${dto.first_name[0] || ""}${dto.last_name[0] || ""}`.toUpperCase(),
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapDeal(dto: DealDto): Deal {
  return {
    id: String(dto.id),
    parentId: dto.lead ? String(dto.lead) : dto.contact ? String(dto.contact) : String(dto.account),
    dealName: dto.name,
    amount: formatCurrency(dto.value),
    stage: dto.stage,
    probability: 0,
    closingDate: dto.updated_at,
    type: dto.account_name || "",
  };
}
