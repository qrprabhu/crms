import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { SalesInboxSetting } from "../types";

type Props = {
  setting?: SalesInboxSetting | null;
  onSave: (payload: Partial<SalesInboxSetting>) => void;
};

export default function SalesInboxCard({ setting, onSave }: Props) {
  const current = setting || {
    is_enabled: false,
    crm_context_enabled: true,
    conversations_enabled: true,
    timeline_enabled: true,
    prioritized_columns_enabled: true,
  };

  return (
    <CRMSectionCard
      title="SalesInbox"
      subtitle="Control whether synced conversations are shown in a CRM-aware inbox for the team."
    >
      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
        <div>
          <p className="text-sm text-slate-700">Give sales teams a contextual inbox view with read status, CRM context, thread grouping, and timeline visibility.</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <label className="flex items-center gap-2"><input type="checkbox" checked={current.is_enabled} onChange={(e) => onSave({ is_enabled: e.target.checked })} /> Enable SalesInbox</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={current.crm_context_enabled} onChange={(e) => onSave({ ...current, crm_context_enabled: e.target.checked })} /> Show CRM context</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={current.conversations_enabled} onChange={(e) => onSave({ ...current, conversations_enabled: e.target.checked })} /> Enable conversations</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={current.timeline_enabled} onChange={(e) => onSave({ ...current, timeline_enabled: e.target.checked })} /> Enable timeline view</label>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="font-medium text-slate-900">Priority Ordering</div>
          <p className="mt-2">Unread and starred messages should appear first so sales reps can act on the most important threads quickly.</p>
        </div>
      </div>
    </CRMSectionCard>
  );
}
