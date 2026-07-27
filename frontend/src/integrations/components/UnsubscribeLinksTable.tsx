import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { UnsubscribeLink } from "../types";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  rows: UnsubscribeLink[];
  onCreate: () => void;
  onEdit: (row: UnsubscribeLink) => void;
  onDelete: (row: UnsubscribeLink) => void;
};

export default function UnsubscribeLinksTable({ rows, onCreate, onEdit, onDelete }: Props) {
  return (
    <CRMSectionCard title="Unsubscribe Links" action={<button type="button" onClick={onCreate} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">Create Link</button>}>
      {!rows.length ? (
        <p className="text-sm text-slate-500">No unsubscribe links configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {["Name", "Page Type", "Action", "Default", "Status", "Actions"].map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{row.name}</td>
                  <td className="px-3 py-3">{row.location_type.replace("_", " ")}</td>
                  <td className="px-3 py-3">{row.action_type.replace("_", " ")}</td>
                  <td className="px-3 py-3">{row.is_default ? <IntegrationStatusBadge label="Default" value="active" /> : "-"}</td>
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
