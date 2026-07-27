import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { EmailAuthenticationDomain } from "../types";
import { getAuthenticationStatusLabel } from "../utils";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  rows: EmailAuthenticationDomain[];
  onAdd: () => void;
  onCheck: (row: EmailAuthenticationDomain) => void;
};

export default function EmailAuthenticationTable({ rows, onAdd, onCheck }: Props) {
  return (
    <CRMSectionCard
      title="Email Authentication Domains"
      action={<button type="button" onClick={onAdd} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">Add Domain</button>}
    >
      {!rows.length ? (
        <p className="text-sm text-slate-500">No authentication domains configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {["Domain", "Authentication", "SPF", "DKIM", "DMARC", "Actions"].map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{row.domain_name}</td>
                  <td className="px-3 py-3"><IntegrationStatusBadge label={getAuthenticationStatusLabel(row.authentication_status)} value={row.authentication_status} /></td>
                  <td className="px-3 py-3">{row.spf_status || "-"}</td>
                  <td className="px-3 py-3">{row.dkim_status || "-"}</td>
                  <td className="px-3 py-3">{row.dmarc_status || "-"}</td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => onCheck(row)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700">Check Status</button>
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

