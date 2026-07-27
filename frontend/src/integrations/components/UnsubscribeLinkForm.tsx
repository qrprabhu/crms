import { useEffect, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { unsubscribeActionOptions, unsubscribeLocationOptions } from "../config";
import type { UnsubscribeLink, UnsubscribeLinkFormValues } from "../types";

type Props = {
  open: boolean;
  initialValue?: UnsubscribeLink | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: UnsubscribeLinkFormValues) => void;
};

const emptyValues: UnsubscribeLinkFormValues = {
  name: "",
  location_type: "standard_page",
  custom_url: "",
  action_type: "display_message",
  redirect_url: "",
  display_message: "",
  is_default: false,
  is_active: true,
};

export default function UnsubscribeLinkForm({ open, initialValue, submitting = false, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<UnsubscribeLinkFormValues>(emptyValues);

  useEffect(() => {
    if (initialValue) {
      setValues({
        name: initialValue.name,
        location_type: initialValue.location_type,
        custom_url: initialValue.custom_url || "",
        action_type: initialValue.action_type,
        redirect_url: initialValue.redirect_url || "",
        display_message: initialValue.display_message || "",
        is_default: initialValue.is_default,
        is_active: initialValue.is_active,
      });
      return;
    }
    setValues(emptyValues);
  }, [initialValue, open]);

  const setField = <K extends keyof UnsubscribeLinkFormValues>(key: K, value: UnsubscribeLinkFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  return (
    <CRMModalBase
      open={open}
      title={initialValue ? "Edit Unsubscribe Link" : "Create Unsubscribe Link"}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => onSubmit(values)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Save</button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="space-y-1 text-sm"><span className="text-slate-600">Link Name</span><input value={values.name} onChange={(e) => setField("name", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Page Type</span>
            <select value={values.location_type} onChange={(e) => setField("location_type", e.target.value as UnsubscribeLinkFormValues["location_type"])} className="w-full rounded-md border border-slate-300 px-3 py-2">
              {unsubscribeLocationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Action</span>
            <select value={values.action_type} onChange={(e) => setField("action_type", e.target.value as UnsubscribeLinkFormValues["action_type"])} className="w-full rounded-md border border-slate-300 px-3 py-2">
              {unsubscribeActionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {values.location_type === "custom_page" ? (
          <label className="space-y-1 text-sm"><span className="text-slate-600">Custom Page URL</span><input value={values.custom_url} onChange={(e) => setField("custom_url", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        ) : null}
        {values.action_type === "redirect_url" ? (
          <label className="space-y-1 text-sm"><span className="text-slate-600">Redirect URL</span><input value={values.redirect_url} onChange={(e) => setField("redirect_url", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        ) : (
          <label className="space-y-1 text-sm"><span className="text-slate-600">Display Message</span><textarea value={values.display_message} onChange={(e) => setField("display_message", e.target.value)} rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        )}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.is_default} onChange={(e) => setField("is_default", e.target.checked)} /> Set as default link</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.is_active} onChange={(e) => setField("is_active", e.target.checked)} /> Link active</label>
        </div>
      </div>
    </CRMModalBase>
  );
}

