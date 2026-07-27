import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import { deleteBusinessHours, listAppointments, listBusinessHours, listServices, setDefaultBusinessHours } from "../api";
import type { BusinessHours } from "../types";
import { businessHoursDayOrder } from "../config";
import { formatTimeValue } from "../utils";
import BusinessHoursFormModal from "./BusinessHoursFormModal";

export default function BusinessHoursPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rows, setRows] = useState<BusinessHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BusinessHours | null>(null);
  const [usageByHours, setUsageByHours] = useState<Record<string, { services: number; appointments: number }>>({});
  const isModalOpen = location.pathname.endsWith("/new") || Boolean(selected);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [businessHoursRows, services, appointments] = await Promise.all([
        listBusinessHours(),
        listServices(),
        listAppointments(),
      ]);
      const usage = businessHoursRows.reduce<Record<string, { services: number; appointments: number }>>((acc, row) => {
        acc[row.id] = {
          services: services.filter((service) => service.businessHours === row.id).length,
          appointments: appointments.filter((appointment) => appointment.businessHoursName === row.name).length,
        };
        return acc;
      }, {});
      setRows(businessHoursRows);
      setUsageByHours(usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load business hours.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex min-h-0 flex-col gap-4">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Business Hours</h1>
            <p className="text-sm text-slate-500">Manage working schedules before enabling and booking services.</p>
          </div>
          <button type="button" onClick={() => navigate("/services/business-hours/new")} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">
            + New Business hours
          </button>
        </div>

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading business hours...</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div> : null}

        {!loading && !error && !rows.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">No business hours configured yet</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
              Create at least one business-hours schedule to unlock service enablement and appointment validation.
            </p>
          </div>
        ) : null}

        <div className="min-h-0 grid gap-4 xl:grid-cols-2">
          {rows.map((row) => (
            <CRMSectionCard
              key={row.id}
              title={row.name}
              action={
                <div className="flex gap-2">
                  {!row.isDefault ? (
                    <button type="button" onClick={() => void setDefaultBusinessHours(row.id).then(load)} className="text-xs font-medium text-green-600">
                      Set Default
                    </button>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Default</span>
                  )}
                  <button type="button" onClick={() => setSelected(row)} className="text-xs font-medium text-slate-600">Edit</button>
                  <button type="button" onClick={() => void deleteBusinessHours(row.id).then(load)} className="text-xs font-medium text-rose-600">Delete</button>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="text-sm text-slate-600">{row.timezone}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Linked Services</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{usageByHours[row.id]?.services || 0}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Appointments Using This Schedule</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{usageByHours[row.id]?.appointments || 0}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {businessHoursDayOrder.map((day) => (
                    <div key={day} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <span className="capitalize text-slate-700">{day}</span>
                      <span className="text-slate-500">
                        {row.days[day].enabled
                          ? `${formatTimeValue(row.days[day].start)} - ${formatTimeValue(row.days[day].end)}`
                          : "Closed"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CRMSectionCard>
          ))}
        </div>
      </div>

      <BusinessHoursFormModal
        open={isModalOpen}
        initialValue={selected}
        onClose={() => {
          setSelected(null);
          if (location.pathname.endsWith("/new")) navigate("/services/business-hours");
        }}
        onSaved={() => void load()}
      />
    </DashboardLayout>
  );
}
