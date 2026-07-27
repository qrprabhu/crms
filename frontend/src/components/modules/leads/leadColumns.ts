import type { CRMColumn, LeadRecord } from "../../../lib/shared/crmTypes";

export const leadColumns: CRMColumn<LeadRecord>[] = [
  { key: "id", label: "ID", minWidth: "min-w-[90px]" },
  { key: "leadName", label: "Lead Name", minWidth: "min-w-[220px]" },
  { key: "company", label: "Company", minWidth: "min-w-[220px]" },
  { key: "email", label: "Email", minWidth: "min-w-[240px]" },
  { key: "phone", label: "Phone", minWidth: "min-w-[170px]" },
  { key: "leadSource", label: "Lead Source", minWidth: "min-w-[160px]" },
  { key: "leadOwner", label: "Lead Owner", minWidth: "min-w-[170px]" },
];
