import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { EmailRelayServer } from "../types";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  rows: EmailRelayServer[];
  onAdd: () => void;
  onEdit: (row: EmailRelayServer) => void;
  onDelete: (row: EmailRelayServer) => void;
};

export default function EmailRelayTable({ rows, onAdd, onEdit, onDelete }: Props) {
  return (
    <CRMSectionCard
      title="Email Relay"
      action={<button type="button" onClick={onAdd} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">Add Relay</button>}
    >
      {!rows.length ? (
        <p className="text-sm text-slate-500">No relay servers configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {["Server", "Port", "Secure", "Domain", "Daily Limit", "Auth", "Status", "Actions"].map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{row.server_name}</td>
                  <td className="px-3 py-3">{row.port}</td>
                  <td className="px-3 py-3">{row.secure_connection.toUpperCase()}</td>
                  <td className="px-3 py-3">{row.domain_name}</td>
                  <td className="px-3 py-3">{row.daily_mail_limit}</td>
                  <td className="px-3 py-3">{row.authentication_required ? "Required" : "Not Required"}</td>
                  <td className="px-3 py-3"><IntegrationStatusBadge label={row.is_active ? "Active" : "Inactive"} value={row.is_active} /></td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => onEdit(row)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700">Edit</button>
                      <button type="button" onClick={() => onDelete(row)} className="rounded-md border border-rose-200 px-3 py-1.5 text-xs text-rose-700">Delete</button>
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

