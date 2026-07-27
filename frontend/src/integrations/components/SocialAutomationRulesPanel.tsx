import CRMSectionCard from "../../components/crm/CRMSectionCard";
import { automationTriggerOptions, socialPlatformOptions } from "../config";
import type { SocialLeadAutomationRule } from "../types";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  rules: SocialLeadAutomationRule[];
  onCreate: () => void;
  onEdit: (rule: SocialLeadAutomationRule) => void;
  onDelete: (rule: SocialLeadAutomationRule) => void;
};

export default function SocialAutomationRulesPanel({ rules, onCreate, onEdit, onDelete }: Props) {
  return (
    <CRMSectionCard title="Automated Lead Generation" action={<button type="button" onClick={onCreate} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">Add Rule</button>}>
      <p className="mb-4 text-sm text-slate-500">Capture mentions, comments, likes, retweets, and messages as CRM leads with assignment controls.</p>
      {!rules.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No social automation rules configured.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {["Platform", "Trigger", "Action", "Assignment", "Status", "Actions"].map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{socialPlatformOptions.find((option) => option.value === rule.platform)?.label || rule.platform}</td>
                  <td className="px-3 py-3">{automationTriggerOptions.find((option) => option.value === rule.trigger_type)?.label || rule.trigger_type}</td>
                  <td className="px-3 py-3">{rule.action_type.replace("_", " ")}</td>
                  <td className="px-3 py-3">{rule.assign_to_user_email || rule.assign_to_team || "-"}</td>
                  <td className="px-3 py-3"><IntegrationStatusBadge label={rule.is_active ? "Active" : "Inactive"} value={rule.is_active} /></td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => onEdit(rule)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700">Edit</button>
                      <button type="button" onClick={() => onDelete(rule)} className="rounded-md border border-rose-200 px-3 py-1.5 text-xs text-rose-700">Delete</button>
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

