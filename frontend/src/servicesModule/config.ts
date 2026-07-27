import type { FilterSection } from "../lib/shared/crmTypes";
import type { AppointmentEntityType, BusinessHoursDayKey, ServicesModuleKey } from "./types";

export const servicesModuleMeta: Record<
  ServicesModuleKey,
  {
    title: string;
    createLabel: string;
    baseRoute: string;
    columns: Array<{ key: string; label: string }>;
    filters: FilterSection[];
  }
> = {
  catalog: {
    title: "Services Catalog",
    createLabel: "Create Service",
    baseRoute: "/services/catalog",
    columns: [
      { key: "serviceName", label: "Service Name" },
      { key: "price", label: "Price" },
      { key: "durationLabel", label: "Duration" },
      { key: "location", label: "Location" },
      { key: "status", label: "Status" },
    ],
    filters: [
      {
        title: "Service Filters",
        items: [
          { key: "serviceName", label: "Service Name" },
          { key: "status", label: "Status" },
          { key: "location", label: "Location" },
          { key: "locationType", label: "Location Type" },
          { key: "businessHoursName", label: "Business Hours" },
        ],
      },
    ],
  },
  appointments: {
    title: "Appointments",
    createLabel: "Create Appointment",
    baseRoute: "/services/appointments",
    columns: [
      { key: "serviceName", label: "Service" },
      { key: "appointmentDate", label: "Date" },
      { key: "appointmentStartTime", label: "Start" },
      { key: "appointmentEndTime", label: "End" },
      { key: "assignedMemberEmail", label: "Member" },
      { key: "appointmentForDisplay", label: "Customer" },
      { key: "customerAssetName", label: "Asset" },
      { key: "coverageType", label: "Coverage" },
      { key: "location", label: "Location" },
      { key: "status", label: "Status" },
    ],
    filters: [
      {
        title: "Appointment Filters",
        items: [
          { key: "serviceName", label: "Service" },
          { key: "status", label: "Status" },
          { key: "assignedMemberEmail", label: "Member" },
          { key: "appointmentForDisplay", label: "Customer" },
          { key: "customerAssetName", label: "Asset" },
          { key: "coverageType", label: "Coverage" },
          { key: "productSerialNumber", label: "Serial Number" },
        ],
      },
    ],
  },
};

export const businessHoursDayOrder: BusinessHoursDayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const serviceStatusOptions = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Draft", value: "draft" },
];

export const serviceDeliveryTeamOptions = [
  { label: "General", value: "general" },
  { label: "Support", value: "support" },
  { label: "Service", value: "service" },
  { label: "Technical", value: "technical" },
  { label: "Customer Success", value: "customer_success" },
  { label: "Sales", value: "sales" },
  { label: "Operations", value: "operations" },
];

export const locationTypeOptions = [
  { label: "Onsite", value: "onsite" },
  { label: "Remote", value: "remote" },
  { label: "Hybrid", value: "hybrid" },
  { label: "In Store", value: "in_store" },
  { label: "Custom", value: "custom" },
];

export const availabilityModeOptions = [
  { label: "Business Hours", value: "business_hours" },
  { label: "Custom", value: "custom" },
  { label: "All Days", value: "all_days" },
];

export const appointmentStatusOptions = [
  { label: "Requested", value: "requested" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Confirmed", value: "confirmed" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Closed", value: "closed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Rescheduled", value: "rescheduled" },
  { label: "No Show", value: "no_show" },
];

export const appointmentCoverageTypeOptions = [
  { label: "None", value: "none" },
  { label: "Warranty", value: "warranty" },
  { label: "AMC", value: "amc" },
  { label: "Paid", value: "paid" },
];

export const appointmentCoverageStatusOptions = [
  { label: "Not Applicable", value: "not_applicable" },
  { label: "Active", value: "active" },
  { label: "Expired", value: "expired" },
  { label: "Pending Verification", value: "pending" },
];

export const appointmentEntityTypeOptions: Array<{ label: string; value: AppointmentEntityType }> = [
  { label: "Contact", value: "contact" },
  { label: "Account", value: "account" },
  { label: "Lead", value: "lead" },
  { label: "Deal", value: "deal" },
  { label: "Case", value: "case" },
  { label: "Product", value: "product" },
  { label: "Other", value: "other" },
];

export const fiscalYearMonthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2024, index, 1).toLocaleString(undefined, { month: "long" }),
}));

export const domainMappingSteps = ["Choose Account", "Add Domain", "Link and Verify"] as const;

export const jobSheetStatusOptions = [
  { label: "Draft", value: "draft" },
  { label: "In Progress", value: "in_progress" },
  { label: "Submitted", value: "submitted" },
  { label: "Completed", value: "completed" },
];
