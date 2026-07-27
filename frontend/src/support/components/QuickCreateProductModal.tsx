import { useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { quickCreateProduct } from "../api";
import type { SupportLookupOption } from "../types";
import CaseLookupField from "./CaseLookupField";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (option: SupportLookupOption) => void;
};

export default function QuickCreateProductModal({ open, onClose, onSaved }: Props) {
  const [productName, setProductName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [vendor, setVendor] = useState("");
  const [vendorLabel, setVendorLabel] = useState("");
  const [unitPrice, setUnitPrice] = useState(0);
  const [tax, setTax] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const product = await quickCreateProduct({
        productName,
        productCode,
        vendor,
        unitPrice,
        tax,
      });
      onSaved(product);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title="Quick Create Product"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
          >
            {saving ? "Saving..." : "Save and Associate"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Product Name</label>
          <input value={productName} onChange={(e) => setProductName(e.target.value)} className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Product Code</label>
          <input value={productCode} onChange={(e) => setProductCode(e.target.value)} className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Vendor Name</label>
          <CaseLookupField
            label="Vendor"
            lookup="vendors"
            value={vendor}
            displayValue={vendorLabel}
            onChange={(option) => {
              setVendor(option?.id || "");
              setVendorLabel(option?.label || "");
            }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Unit Price</label>
          <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Tax</label>
          <input type="number" value={tax} onChange={(e) => setTax(Number(e.target.value))} className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm" />
        </div>
      </div>
      {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}
    </CRMModalBase>
  );
}
