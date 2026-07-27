import { useState } from "react";
import { quickCreateVendor } from "../api";

type InventoryQuickVendorModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (vendor: { id: string; label: string; name: string }) => void;
};

export default function InventoryQuickVendorModal({
  open,
  onClose,
  onSaved,
}: InventoryQuickVendorModalProps) {
  const [form, setForm] = useState({ vendorName: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">New Vendor</h2>
        <p className="mt-1 text-sm text-slate-500">Save and associate the vendor with this purchase order.</p>

        <div className="mt-5 grid gap-4">
          <input
            value={form.vendorName}
            onChange={(event) => setForm((prev) => ({ ...prev, vendorName: event.target.value }))}
            placeholder="Vendor Name"
            className="h-[38px] rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder="Phone"
            className="h-[38px] rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500"
          />
          <input
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="Email"
            className="h-[38px] rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500"
          />
        </div>

        {error && <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                setSaving(true);
                setError(null);
                const vendor = await quickCreateVendor(form);
                onSaved(vendor);
                onClose();
                setForm({ vendorName: "", phone: "", email: "" });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to create vendor.");
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
          >
            {saving ? "Saving..." : "Save and Associate"}
          </button>
        </div>
      </div>
    </div>
  );
}
