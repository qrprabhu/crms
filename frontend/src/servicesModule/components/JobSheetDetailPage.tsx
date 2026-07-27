import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CRMDetailHeader from "../../components/crm/CRMDetailHeader";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { getAppointment, getJobSheet, getService } from "../api";
import type { AppointmentRecord, JobSheetRecord, ServiceRecord } from "../types";

function getStatusBadgeClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "bg-emerald-100 text-emerald-700";
  if (normalized === "submitted") return "bg-sky-100 text-sky-700";
  if (normalized === "in_progress") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default function JobSheetDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [jobSheet, setJobSheet] = useState<JobSheetRecord | null>(null);
  const [service, setService] = useState<ServiceRecord | null>(null);
  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const detail = await getJobSheet(id);
        setJobSheet(detail);
        const [serviceDetail, appointmentDetail] = await Promise.all([
          getService(detail.serviceId),
          detail.appointmentId ? getAppointment(detail.appointmentId) : Promise.resolve(null),
        ]);
        setService(serviceDetail);
        setAppointment(appointmentDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load job sheet.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (loading) return <DashboardLayout><div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading job sheet...</div></DashboardLayout>;
  if (error || !jobSheet) return <DashboardLayout><div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error || "Job sheet not found."}</div></DashboardLayout>;

  const openCustomerRecord = () => {
    if (!appointment?.appointmentForId) return;
    const type = appointment.appointmentForType;
    if (type === "contact") navigate(`/contacts/${appointment.appointmentForId}`);
    if (type === "account") navigate(`/accounts/${appointment.appointmentForId}`);
    if (type === "lead") navigate(`/leads/${appointment.appointmentForId}`);
    if (type === "deal") navigate(`/deals/${appointment.appointmentForId}`);
    if (type === "case") navigate(`/support/cases/${appointment.appointmentForId}`);
    if (type === "product") navigate(`/products/${appointment.appointmentForId}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <CRMDetailHeader
          title={jobSheet.title}
          subtitle={jobSheet.status}
          actions={["Edit"]}
          onBack={() => navigate("/services/job-sheets")}
          onActionClick={(action) => {
            if (action === "Edit") navigate(`/services/job-sheets/${jobSheet.id}/edit`);
          }}
        />
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <CRMSectionCard title="Job Sheet Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Service</p><p className="mt-1 text-sm text-slate-800">{service?.serviceName || jobSheet.serviceName}</p></div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                <p className="mt-1">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(jobSheet.status)}`}>
                    {jobSheet.status.replace(/_/g, " ")}
                  </span>
                </p>
              </div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Appointment</p><p className="mt-1 text-sm text-slate-800">{appointment?.appointmentNumber || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Customer</p><p className="mt-1 text-sm text-slate-800">{appointment?.appointmentForDisplay || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Sales Order</p><p className="mt-1 text-sm text-slate-800">{appointment?.salesOrderSubject || appointment?.salesOrderId || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Invoice</p><p className="mt-1 text-sm text-slate-800">{appointment?.invoiceSubject || appointment?.invoiceId || "-"}</p></div>
            </div>
          </CRMSectionCard>
          <div className="space-y-4">
            <CRMSectionCard title="Flow Connectivity">
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Source Appointment</div>
                  {appointment ? (
                    <button type="button" onClick={() => navigate(`/services/appointments/${appointment.id}`)} className="mt-1 text-left text-sm font-medium text-green-600">
                      {[appointment.appointmentNumber, appointment.appointmentForDisplay].filter(Boolean).join(" • ")}
                    </button>
                  ) : (
                    <div className="mt-1 text-sm text-slate-700">No appointment linked.</div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Source Service</div>
                  <button type="button" onClick={() => navigate(`/services/catalog/${jobSheet.serviceId}`)} className="mt-1 text-left text-sm font-medium text-green-600">
                    {service?.serviceName || jobSheet.serviceName}
                  </button>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Customer Context</div>
                  {appointment?.appointmentForId ? (
                    <button type="button" onClick={openCustomerRecord} className="mt-1 text-left text-sm font-medium text-green-600">
                      {appointment.appointmentForDisplay || `${appointment.appointmentForType} #${appointment.appointmentForId}`}
                    </button>
                  ) : (
                    <div className="mt-1 text-sm text-slate-700">{appointment?.appointmentForDisplay || "-"}</div>
                  )}
                </div>
              </div>
            </CRMSectionCard>
            <CRMSectionCard title="Submitted Fields">
              <div className="space-y-3">
                {jobSheet.fields.length ? jobSheet.fields.map((field, index) => (
                  <div key={`${field.fieldName}-${index}`} className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {field.fieldLabel}
                      {field.fieldName ? <span className="ml-1 normal-case tracking-normal text-slate-400">({field.fieldName})</span> : null}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{field.fieldValue || "-"}</div>
                  </div>
                )) : <div className="text-sm text-slate-500">No field values captured yet.</div>}
              </div>
            </CRMSectionCard>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
