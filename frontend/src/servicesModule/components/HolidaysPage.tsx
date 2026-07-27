import { useEffect, useState } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import { createHoliday, deleteHoliday, listAppointments, listHolidays, updateHoliday } from "../api";
import type { Holiday } from "../types";

const inputClass = "h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500";
const textareaClass = "min-h-[80px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500";

export default function HolidaysPage() {
  const [rows, setRows] = useState<Holiday[]>([]);
  const [form, setForm] = useState<Holiday>({ id: "", name: "", date: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointmentsByDate, setAppointmentsByDate] = useState<Record<string, number>>({});

  const load = async () => {
    try {
      setLoading(true);
      const [holidayRows, appointments] = await Promise.all([listHolidays(), listAppointments()]);
      const nextAppointmentsByDate = appointments.reduce<Record<string, number>>((acc, appointment) => {
        const key = appointment.appointmentDate;
        if (!key) return acc;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      setRows(holidayRows);
      setAppointmentsByDate(nextAppointmentsByDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load holidays.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.date) {
      setError("Holiday name and date are required.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      if (form.id) await updateHoliday(form.id, { name: form.name, date: form.date, description: form.description });
      else await createHoliday({ name: form.name, date: form.date, description: form.description });
      setForm({ id: "", name: "", date: "", description: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save holiday.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Holidays</h1>
          <p className="mt-1 text-sm text-slate-500">Maintain holiday dates that affect service scheduling windows.</p>
        </div>
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div> : null}
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <CRMSectionCard title={form.id ? "Edit Holiday" : "New Holiday"}>
            <div className="space-y-4">
              <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Holiday Name</label><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Date</label><input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label><textarea className={textareaClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex gap-2">
                <button type="button" disabled={saving} onClick={() => void handleSave()} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">{saving ? "Saving..." : "Save"}</button>
                {form.id ? <button type="button" onClick={() => setForm({ id: "", name: "", date: "", description: "" })} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel Edit</button> : null}
              </div>
            </div>
          </CRMSectionCard>
          <CRMSectionCard title="Holiday List">
            <div className="space-y-2">
              {loading ? <div className="text-sm text-slate-500">Loading holidays...</div> : null}
              {!loading && !rows.length ? <div className="text-sm text-slate-500">No holidays created yet.</div> : null}
              {rows.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{row.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.date}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Affected appointments: {appointmentsByDate[row.date] || 0}
                    </div>
                    {row.description ? <div className="mt-1 text-sm text-slate-600">{row.description}</div> : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm(row)} className="text-xs font-medium text-slate-600">Edit</button>
                    <button type="button" onClick={() => void deleteHoliday(row.id).then(load)} className="text-xs font-medium text-rose-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </CRMSectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
