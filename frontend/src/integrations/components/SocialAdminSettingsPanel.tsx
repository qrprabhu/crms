import { useEffect, useState } from "react";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { SocialPermissionSetting } from "../types";

type Props = {
  setting?: SocialPermissionSetting | null;
  onSave: (payload: Partial<SocialPermissionSetting>) => void;
};

export default function SocialAdminSettingsPanel({ setting, onSave }: Props) {
  const [draft, setDraft] = useState<Partial<SocialPermissionSetting>>({});

  useEffect(() => {
    setDraft(
      setting || {
        social_admin_role_name: "",
        social_tab_profiles: [],
        social_profiles: [],
        private_handles_enabled: false,
      }
    );
  }, [setting]);

  const current = draft || {
    social_admin_role_name: "",
    social_tab_profiles: [],
    social_profiles: [],
    private_handles_enabled: false,
  };

  return (
    <CRMSectionCard title="Social Admin Settings" action={<button type="button" onClick={() => onSave(current)} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">Save Settings</button>}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Social Admin Role</span>
          <input value={current.social_admin_role_name || ""} onChange={(e) => setDraft((previous) => ({ ...previous, social_admin_role_name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Social Tab Profiles</span>
          <input value={(current.social_tab_profiles || []).join(", ")} onChange={(e) => setDraft((previous) => ({ ...previous, social_tab_profiles: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Enter comma-separated profile names" />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-slate-600">Social Profiles Mapping</span>
          <textarea value={(current.social_profiles || []).join(", ")} onChange={(e) => setDraft((previous) => ({ ...previous, social_profiles: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Enter mapped profile groups separated by commas" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={Boolean(current.private_handles_enabled)} onChange={(e) => setDraft((previous) => ({ ...previous, private_handles_enabled: e.target.checked }))} />
          Enable private handles section
        </label>
      </div>
    </CRMSectionCard>
  );
}
