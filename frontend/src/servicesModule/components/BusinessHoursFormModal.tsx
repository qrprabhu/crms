import { useEffect, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { businessHoursDayOrder } from "../config";
import { createBusinessHours, updateBusinessHours } from "../api";
import type { BusinessHours } from "../types";
import { validateDayWindow } from "../utils";

const inputClass = "h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500";

const emptyValue: BusinessHours = {
  id: "",
  name: "",
  timezone: "Asia/Calcutta",
  isDefault: false,
  createdAt: "",
  updatedAt: "",
  days: {
    monday: { enabled: true, start: "09:00", end: "18:00" },
    tuesday: { enabled: true, start: "09:00", end: "18:00" },
    wednesday: { enabled: true, start: "09:00", end: "18:00" },
    thursday: { enabled: true, start: "09:00", end: "18:00" },
    friday: { enabled: true, start: "09:00", end: "18:00" },
    saturday: { enabled: false, start: "", end: "" },
    sunday: { enabled: false, start: "", end: "" },
  },
};

type Props = {
  open: boolean;
  initialValue?: BusinessHours | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function BusinessHoursFormModal({ open, initialValue, onClose, onSaved }: Props) {
  const [form, setForm] = useState<BusinessHours>(initialValue || emptyValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialValue || emptyValue);
    setError(null);
  }, [initialValue, open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Business hours name is required.");
      return;
    }
    for (const day of businessHoursDayOrder) {
      const message = validateDayWindow(form.days[day].enabled, form.days[day].start, form.days[day].end);
      if (message) {
        setError(`${day[0].toUpperCase()}${day.slice(1)}: ${message}`);
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      if (form.id) await updateBusinessHours(form.id, form);
      else await createBusinessHours(form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save business hours.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title={form.id ? "Edit Business Hours" : "New Business hours"}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={() => void handleSubmit()} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
      maxWidthClassName="max-w-4xl"
      bodyClassName="space-y-4"
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Timezone</label>
            <input className={inputClass} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
          Set as default business hours
        </label>

        <div className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-slate-900">Weekly Schedule</h4>
            <p className="mt-1 text-xs text-slate-500">Keep each day compact and aligned to avoid long-form overflow.</p>
          </div>
          <div className="space-y-2 p-3 sm:p-4">
            {businessHoursDayOrder.map((day) => (
            <div
              key={day}
              className="grid items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3"
            >
              <label className="flex min-w-0 items-center gap-2 text-sm font-medium capitalize text-slate-700">
                <input
                  type="checkbox"
                  checked={form.days[day].enabled}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      days: {
                        ...form.days,
                        [day]: {
                          ...form.days[day],
                          enabled: e.target.checked,
                          start: e.target.checked ? form.days[day].start || "09:00" : "",
                          end: e.target.checked ? form.days[day].end || "18:00" : "",
                        },
                      },
                    })
                  }
                />
                <span className="truncate">{day}</span>
              </label>
              <input
                type="time"
                disabled={!form.days[day].enabled}
                className={`${inputClass} ${!form.days[day].enabled ? "bg-slate-50 text-slate-400" : ""}`}
                value={form.days[day].start}
                onChange={(e) =>
                  setForm({
                    ...form,
                    days: { ...form.days, [day]: { ...form.days[day], start: e.target.value } },
                  })
                }
              />
              <input
                type="time"
                disabled={!form.days[day].enabled}
                className={`${inputClass} ${!form.days[day].enabled ? "bg-slate-50 text-slate-400" : ""}`}
                value={form.days[day].end}
                onChange={(e) =>
                  setForm({
                    ...form,
                    days: { ...form.days, [day]: { ...form.days[day], end: e.target.value } },
                  })
                }
              />
            </div>
          ))}
          </div>
        </div>

        {error ? <div className="text-sm text-rose-600">{error}</div> : null}
      </div>
    </CRMModalBase>
  );
}
