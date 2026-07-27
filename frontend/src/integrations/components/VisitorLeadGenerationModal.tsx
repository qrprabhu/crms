import { useEffect, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { pushVisitorOptions } from "../config";
import type { UserSummary, VisitorTrackingSetting } from "../types";

type Props = {
  open: boolean;
  initialValue?: VisitorTrackingSetting | null;
  users?: UserSummary[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<VisitorTrackingSetting>) => void;
};

export default function VisitorLeadGenerationModal({ open, initialValue, users = [], submitting = false, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<Partial<VisitorTrackingSetting>>({});

  useEffect(() => {
    setValues(initialValue || {});
  }, [initialValue, open]);

  return (
    <CRMModalBase
      open={open}
      title="Visitor Lead Generation"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => onSubmit(values)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Save</button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Push New Visitors As</span>
          <select value={values.push_new_visitors_as || "lead"} onChange={(e) => setValues((current) => ({ ...current, push_new_visitors_as: e.target.value as VisitorTrackingSetting["push_new_visitors_as"] }))} className="w-full rounded-md border border-slate-300 px-3 py-2">
            {pushVisitorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Assign To User</span>
          <select value={values.assign_lead_to_user || ""} onChange={(e) => setValues((current) => ({ ...current, assign_lead_to_user: Number(e.target.value) || null }))} className="w-full rounded-md border border-slate-300 px-3 py-2">
            <option value="">Unassigned</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm"><span className="text-slate-600">Department</span><input value={values.department_name || ""} onChange={(e) => setValues((current) => ({ ...current, department_name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-600">App Name</span><input value={values.app_name || ""} onChange={(e) => setValues((current) => ({ ...current, app_name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={Boolean(values.notify_when_visitor_online)} onChange={(e) => setValues((current) => ({ ...current, notify_when_visitor_online: e.target.checked }))} /> Notify when visitor is online</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={Boolean(values.status_enabled ?? true)} onChange={(e) => setValues((current) => ({ ...current, status_enabled: e.target.checked }))} /> Enable status</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={Boolean(values.chat_widget_enabled ?? true)} onChange={(e) => setValues((current) => ({ ...current, chat_widget_enabled: e.target.checked }))} /> Enable chat widget</label>
        </div>
      </div>
    </CRMModalBase>
  );
}

