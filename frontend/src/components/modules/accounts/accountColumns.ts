import type { AccountRecord, CRMColumn } from "../../../lib/shared/crmTypes";

export const accountColumns: CRMColumn<AccountRecord>[] = [
  { key: "accountName", label: "Account Name", minWidth: "min-w-[240px]" },
  { key: "phone", label: "Phone", minWidth: "min-w-[180px]" },
  { key: "website", label: "Website", minWidth: "min-w-[220px]" },
  { key: "accountOwner", label: "Account Owner", minWidth: "min-w-[180px]" },
];
