import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { OrganizationEmailAddress } from "../types";
import { getAuthenticationStatusLabel, getConfirmationStatusLabel } from "../utils";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  rows: OrganizationEmailAddress[];
  onCreate: () => void;
  onEdit: (row: OrganizationEmailAddress) => void;
  onConfirm: (row: OrganizationEmailAddress) => void;
};

export default function OrganizationEmailsTable({ rows, onCreate, onEdit, onConfirm }: Props) {
  return (
    <CRMSectionCard
      title="Organization Emails"
      action={<button type="button" onClick={onCreate} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">Add Email</button>}
    >
      {!rows.length ? (
        <p className="text-sm text-slate-500">No organization email addresses added yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {["Display Name", "Email Address", "Usage Scope", "Confirmation", "Authentication", "Actions"].map((header) => (
                  <th key={header} className="px-3 py-2 font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{row.display_name}</td>
                  <td className="px-3 py-3">{row.email_address}</td>
                  <td className="px-3 py-3">{row.usage_scope.replace("_", " ")}</td>
                  <td className="px-3 py-3"><IntegrationStatusBadge label={getConfirmationStatusLabel(row.confirmation_status)} value={row.confirmation_status} /></td>
                  <td className="px-3 py-3"><IntegrationStatusBadge label={getAuthenticationStatusLabel(row.authentication_status)} value={row.authentication_status} /></td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => onEdit(row)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700">Edit</button>
                      {row.confirmation_status === "pending" ? (
                        <button type="button" onClick={() => onConfirm(row)} className="rounded-md border border-blue-200 px-3 py-1.5 text-xs text-green-700">Confirm</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CRMSectionCard>
  );
}

