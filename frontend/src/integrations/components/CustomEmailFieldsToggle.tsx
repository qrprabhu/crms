import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { CustomEmailFieldPreference } from "../types";

type Props = {
  value?: CustomEmailFieldPreference | null;
  saving?: boolean;
  onToggle: (next: boolean) => void;
};

export default function CustomEmailFieldsToggle({ value, saving = false, onToggle }: Props) {
  return (
    <CRMSectionCard title="Custom Email Fields">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm text-slate-700">Enable email syncing using custom CRM email fields when standard contact matching is not enough.</p>
          <p className="mt-1 text-xs text-slate-500">{value?.notes || "Use this when conversations should map to non-standard email attributes."}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={Boolean(value?.is_enabled)} disabled={saving} onChange={(event) => onToggle(event.target.checked)} />
          {value?.is_enabled ? "Enabled" : "Disabled"}
        </label>
      </div>
    </CRMSectionCard>
  );
}

