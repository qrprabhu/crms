import { useEffect, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import type { SocialBrand } from "../types";

type Props = {
  open: boolean;
  initialValue?: SocialBrand | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: { brand_name: string; brand_description: string; is_active: boolean }) => void;
};

export default function BrandForm({ open, initialValue, submitting = false, onClose, onSubmit }: Props) {
  const [values, setValues] = useState({ brand_name: "", brand_description: "", is_active: true });

  useEffect(() => {
    if (initialValue) {
      setValues({
        brand_name: initialValue.brand_name,
        brand_description: initialValue.brand_description || "",
        is_active: initialValue.is_active,
      });
      return;
    }
    setValues({ brand_name: "", brand_description: "", is_active: true });
  }, [initialValue, open]);

  return (
    <CRMModalBase
      open={open}
      title={initialValue ? "Edit Brand" : "Create Brand"}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => onSubmit(values)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Save</button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="space-y-1 text-sm"><span className="text-slate-600">Brand Name</span><input value={values.brand_name} onChange={(e) => setValues((current) => ({ ...current, brand_name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-600">Brand Description</span><textarea rows={4} value={values.brand_description} onChange={(e) => setValues((current) => ({ ...current, brand_description: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.is_active} onChange={(e) => setValues((current) => ({ ...current, is_active: e.target.checked }))} /> Brand active</label>
      </div>
    </CRMModalBase>
  );
}

