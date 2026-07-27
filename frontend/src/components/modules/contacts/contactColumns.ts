import type { CRMColumn, ContactRecord } from "../../../lib/shared/crmTypes";

export const contactColumns: CRMColumn<ContactRecord>[] = [
  { key: "contactId", label: "Contact ID", minWidth: "min-w-[170px]" },
  { key: "contactName", label: "Contact Name", minWidth: "min-w-[220px]" },
  { key: "accountName", label: "Account Name", minWidth: "min-w-[220px]" },
  { key: "email", label: "Email", minWidth: "min-w-[240px]" },
  { key: "phone", label: "Phone", minWidth: "min-w-[170px]" },
  { key: "contactOwner", label: "Contact Owner", minWidth: "min-w-[170px]" },
];
