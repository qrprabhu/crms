import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { EmailInsightSetting } from "../types";

type Props = {
  setting?: EmailInsightSetting | null;
  onSave: (payload: Partial<EmailInsightSetting>) => void;
};

export default function EmailInsightsPanel({ setting, onSave }: Props) {
  const current = setting || {
    is_enabled: false,
    tracking_open: true,
    tracking_click: true,
    tracking_bounce: true,
    workflow_trigger_enabled: false,
  };

  return (
    <CRMSectionCard title="Email Insights">
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3 text-sm text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={current.is_enabled} onChange={(e) => onSave({ ...current, is_enabled: e.target.checked })} /> Enable insights tracking</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={current.tracking_open} onChange={(e) => onSave({ ...current, tracking_open: e.target.checked })} /> Track opens</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={current.tracking_click} onChange={(e) => onSave({ ...current, tracking_click: e.target.checked })} /> Track clicks</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={current.tracking_bounce} onChange={(e) => onSave({ ...current, tracking_bounce: e.target.checked })} /> Track bounces</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={current.workflow_trigger_enabled} onChange={(e) => onSave({ ...current, workflow_trigger_enabled: e.target.checked })} /> Allow workflow triggers</label>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="font-medium text-slate-900">Supported Insight Areas</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Open and click tracking</li>
            <li>Bounce visibility</li>
            <li>Workflow compatibility</li>
            <li>Template analytics readiness</li>
          </ul>
        </div>
      </div>
    </CRMSectionCard>
  );
}

