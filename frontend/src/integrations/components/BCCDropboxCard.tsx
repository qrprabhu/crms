import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { BCCDropboxSetting } from "../types";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  setting?: BCCDropboxSetting | null;
  onCreate: () => void;
  onUpdate: (payload: Partial<BCCDropboxSetting>) => void;
  onRegenerate: () => void;
  onAddEmail: () => void;
  onVerifyEmail: () => void;
};

export default function BCCDropboxCard({ setting, onCreate, onUpdate, onRegenerate, onAddEmail, onVerifyEmail }: Props) {
  return (
    <CRMSectionCard
      title="BCC Dropbox"
      action={
        !setting ? (
          <button type="button" onClick={onCreate} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">Create BCC Dropbox</button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={onAddEmail} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">Add Email</button>
            <button type="button" onClick={onVerifyEmail} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">Verify Email</button>
            <button type="button" onClick={onRegenerate} className="rounded-md border border-blue-200 px-3 py-2 text-xs text-green-700">Regenerate</button>
          </div>
        )
      }
    >
      {!setting ? (
        <p className="text-sm text-slate-500">Create a unique BCC address to match conversations against contacts, then leads, and auto-create new leads when no match exists.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Dropbox Email Address</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{setting.dropbox_email_address}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-slate-900">Search Pattern</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                {setting.search_pattern_order.map((item) => <li key={item}>{item.replaceAll("_", " ")}</li>)}
              </ol>
            </div>
            <div>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Excluded Domains</span>
                <textarea value={setting.exclude_domains.join(", ")} onChange={(event) => onUpdate({ exclude_domains: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-slate-900">Verified Email Addresses</div>
            <div className="space-y-2">
              {setting.verified_addresses.length ? setting.verified_addresses.map((address) => (
                <div key={address.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>{address.email_address}</span>
                  <IntegrationStatusBadge label={address.verification_status} value={address.verification_status} />
                </div>
              )) : <p className="text-sm text-slate-500">No verified sender emails added yet.</p>}
            </div>
          </div>
        </div>
      )}
    </CRMSectionCard>
  );
}

