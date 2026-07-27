import type { CRMRecord } from "../lib/shared/crmTypes";

export type ServicesModuleKey = "catalog" | "appointments";

export type ServiceSettings = {
  id: string;
  isServicesEnabled: boolean;
  defaultTimezone: string;
  hidePromo: boolean;
  businessHoursConfigured: boolean;
  fiscalYearConfigured: boolean;
  domainMappingConfigured: boolean;
  companyDetails: CompanyDetails | null;
};

export type BusinessHoursDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type BusinessHours = {
  id: string;
  name: string;
  timezone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  days: Record<
    BusinessHoursDayKey,
    {
      enabled: boolean;
      start: string;
      end: string;
    }
  >;
};

export type BusinessHoursDetails = {
  id: string;
  name: string;
  timezone: string;
  isDefault: boolean;
  days: Record<
    BusinessHoursDayKey,
    {
      enabled: boolean;
      slots: Array<{
        start: string;
        end: string;
      }>;
    }
  >;
};

export type TeamMember = {
  id: string;
  email: string;
  label: string;
  team: string;
  teamLabel: string;
};

export type ServiceMember = {
  id: string;
  serviceId: string;
  memberId: string;
  memberEmail: string;
  isPrimary: boolean;
};

export type ServiceRecord = CRMRecord & {
  id: string;
  serviceCode: string;
  serviceName: string;
  description: string;
  price: number;
  durationMinutes: number;
  durationLabel: string;
  locationType: string;
  location: string;
  status: string;
  deliveryTeam: string;
  availableDaysMode: string;
  availableTimeMode: string;
  businessHours: string;
  businessHoursName: string;
  businessHoursTimezone?: string;
  businessHoursDetails?: BusinessHoursDetails | null;
  membersCount: number;
  locationBehavior?: "online" | "offline" | "hybrid" | string;
  publicBookingUrl?: string;
  members?: ServiceMember[];
  createdAt: string;
  updatedAt: string;
};

export type ServiceFormData = {
  serviceName: string;
  description: string;
  price: number;
  durationMinutes: number;
  locationType: string;
  location: string;
  status: string;
  deliveryTeam: string;
  availableDaysMode: string;
  availableTimeMode: string;
  businessHoursId: string;
  memberIds: string[];
  primaryMemberId: string;
};

export type AppointmentEntityType = "contact" | "account" | "lead" | "deal" | "case" | "product" | "other";

export type LookupOption = {
  id: string;
  label: string;
  subtitle?: string;
  email?: string;
  phone?: string;
  accountId?: string;
  contactId?: string;
  dealId?: string;
  quoteId?: string;
  salesOrderId?: string;
};

export type ServicesLookupType = AppointmentEntityType | "sales-order" | "invoice";

export type AppointmentRecord = CRMRecord & {
  id: string;
  appointmentNumber: string;
  serviceId: string;
  serviceName: string;
  serviceDurationMinutes?: number;
  businessHoursName?: string;
  businessHoursTimezone?: string;
  businessHoursDetails?: BusinessHoursDetails | null;
  locationType?: string;
  appointmentForType: AppointmentEntityType;
  appointmentForId: string;
  appointmentForDisplay: string;
  appointmentDate: string;
  appointmentStartTime: string;
  appointmentEndTime: string;
  assignedMemberId: string;
  assignedMemberEmail: string;
  productId: string;
  productName: string;
  salesOrderId: string;
  salesOrderSubject: string;
  invoiceId: string;
  invoiceSubject: string;
  customerAssetName: string;
  productSerialNumber: string;
  coverageType: string;
  coverageStatus: string;
  location: string;
  status: string;
  notes: string;
  completionNotes: string;
  completionProofUrl: string;
  completionProofFileUrl: string;
  completionProofFileName: string;
  completedAt: string;
  publicBookingUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentFormData = {
  serviceId: string;
  appointmentForType: AppointmentEntityType;
  appointmentForId: string;
  appointmentForLabel: string;
  appointmentDate: string;
  appointmentStartTime: string;
  appointmentEndTime: string;
  assignedMemberId: string;
  productId: string;
  productLabel?: string;
  salesOrderId: string;
  salesOrderLabel?: string;
  invoiceId: string;
  invoiceLabel?: string;
  customerAssetName: string;
  productSerialNumber: string;
  coverageType: string;
  coverageStatus: string;
  location: string;
  status: string;
  notes: string;
  completionNotes: string;
  completionProofUrl: string;
  completionProofFile?: File | null;
  completionProofFileUrl?: string;
  completionProofFileName?: string;
  clearCompletionProofFile?: boolean;
};

export type JobSheetField = {
  id?: string;
  clientKey?: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: "text" | "date" | "textarea";
  fieldValue: string;
};

export type JobSheetRecord = {
  id: string;
  appointmentId: string;
  serviceId: string;
  serviceName: string;
  customerType: string;
  customerId: string;
  title: string;
  status: string;
  fields: JobSheetField[];
  createdAt: string;
  updatedAt: string;
};

export type JobSheetFormData = {
  appointmentId: string;
  serviceId: string;
  customerType: string;
  customerId: string;
  title: string;
  status: string;
  fields: JobSheetField[];
};

export type CompanyDetails = {
  id: string;
  companyName: string;
  companyEmail: string;
  contactPerson: string;
  phone: string;
  address: string;
  publicBookingBaseUrl?: string;
  serviceContactName?: string;
  serviceContactEmail?: string;
  defaultTimezone?: string;
};

export type DomainMapping = {
  id: string;
  accountType: "crm" | "sandbox" | "portals";
  domain: string;
  cnameTarget: string;
  verificationStatus: "pending" | "verified" | "failed";
  publicBookingBaseUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type FiscalYearSettings = {
  id: string;
  fiscalYearType: "standard" | "custom";
  startsInMonth: number;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  fiscalYearLabel?: string;
};

export type Holiday = {
  id: string;
  name: string;
  date: string;
  description: string;
};

export type AppointmentSummary = {
  totalAppointments: number;
  todayAppointments: number;
  activePipeline: number;
  completedAppointments: number;
  coveredAppointments: number;
  byStatus: Array<{ status: string; count: number }>;
  byCoverage: Array<{ coverageType: string; count: number }>;
  topWorkload: Array<{ email: string; count: number }>;
};
