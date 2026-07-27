import { useEffect, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import type { VisitorTrackingPortal } from "../types";

type Props = {
  open: boolean;
  initialValue?: VisitorTrackingPortal | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { portal_name: string; portal_url: string; is_active: boolean; is_available: boolean }) => void;
};

export default function VisitorPortalForm({ open, initialValue, submitting = false, onClose, onSubmit }: Props) {
  const [values, setValues] = useState({ portal_name: "", portal_url: "", is_active: true, is_available: true });

  useEffect(() => {
    if (initialValue) {
      setValues({
        portal_name: initialValue.portal_name,
        portal_url: initialValue.portal_url,
        is_active: initialValue.is_active,
        is_available: initialValue.is_available,
      });
      return;
    }
    setValues({ portal_name: "", portal_url: "", is_active: true, is_available: true });
  }, [initialValue, open]);

  return (
    <CRMModalBase
      open={open}
      title={initialValue ? "Edit Visitor Portal" : "Create Visitor Portal"}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => onSubmit(values)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Save</button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="space-y-1 text-sm"><span className="text-slate-600">Portal Name</span><input value={values.portal_name} onChange={(e) => setValues((current) => ({ ...current, portal_name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-600">Portal URL</span><input value={values.portal_url} onChange={(e) => setValues((current) => ({ ...current, portal_url: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="https://example.com" /></label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.is_active} onChange={(e) => setValues((current) => ({ ...current, is_active: e.target.checked }))} /> Active</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.is_available} onChange={(e) => setValues((current) => ({ ...current, is_available: e.target.checked }))} /> Available</label>
        </div>
      </div>
    </CRMModalBase>
  );
}

