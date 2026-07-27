import { useEffect, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { usageScopeOptions } from "../config";
import type { OrganizationEmailAddress, OrganizationEmailFormValues } from "../types";

type Props = {
  open: boolean;
  initialValue?: OrganizationEmailAddress | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: OrganizationEmailFormValues) => void;
};

export default function OrganizationEmailForm({ open, initialValue, submitting = false, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<OrganizationEmailFormValues>({
    display_name: "",
    email_address: "",
    usage_scope: "standard",
  });

  useEffect(() => {
    if (initialValue) {
      setValues({
        display_name: initialValue.display_name,
        email_address: initialValue.email_address,
        usage_scope: initialValue.usage_scope,
      });
      return;
    }
    setValues({ display_name: "", email_address: "", usage_scope: "standard" });
  }, [initialValue, open]);

  return (
    <CRMModalBase
      open={open}
      title={initialValue ? "Edit Organization Email" : "Add Organization Email"}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => onSubmit(values)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {submitting ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Display Name</span>
          <input value={values.display_name} onChange={(event) => setValues((current) => ({ ...current, display_name: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Email Address</span>
          <input value={values.email_address} onChange={(event) => setValues((current) => ({ ...current, email_address: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Who Can Use This Address</span>
          <select value={values.usage_scope} onChange={(event) => setValues((current) => ({ ...current, usage_scope: event.target.value as OrganizationEmailFormValues["usage_scope"] }))} className="w-full rounded-md border border-slate-300 px-3 py-2">
            {usageScopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
    </CRMModalBase>
  );
}

