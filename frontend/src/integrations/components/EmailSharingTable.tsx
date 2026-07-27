import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { EmailSharingPermission } from "../types";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  rows: EmailSharingPermission[];
};

export default function EmailSharingTable({ rows }: Props) {
  return (
    <CRMSectionCard title="Email Sharing">
      {!rows.length ? (
        <p className="text-sm text-slate-500">No sharing policies configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {["User", "Configuration Type", "Sharing Mode", "Excluded Domains", "Preferences"].map((header) => (
                  <th key={header} className="px-3 py-2 font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{row.user_email || row.user}</td>
                  <td className="px-3 py-3">{row.configuration_type}</td>
                  <td className="px-3 py-3"><IntegrationStatusBadge label={row.sharing_mode.replace("_", " ")} value={row.sharing_mode} /></td>
                  <td className="px-3 py-3">{row.excluded_domains.length ? row.excluded_domains.join(", ") : "-"}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    Shared With: {row.shared_with_profiles.length ? row.shared_with_profiles.join(", ") : "Private"}
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

