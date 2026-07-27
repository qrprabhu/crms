import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CRMDetailHeader from "../../components/crm/CRMDetailHeader";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { getAppointment, listJobSheets } from "../api";
import { formatDateOnly, formatTimeValue } from "../utils";
import type { AppointmentRecord, JobSheetRecord } from "../types";

export default function AppointmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [jobSheets, setJobSheets] = useState<JobSheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const detail = await getAppointment(id);
        setAppointment(detail);
        setJobSheets(await listJobSheets({ appointment: id }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load appointment.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (loading) return <DashboardLayout><div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading appointment...</div></DashboardLayout>;
  if (error || !appointment) return <DashboardLayout><div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error || "Appointment not found."}</div></DashboardLayout>;

  const openCustomerRecord = () => {
    if (!appointment.appointmentForId) return;
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
          title={appointment.appointmentForDisplay || appointment.appointmentNumber}
          subtitle={appointment.status}
          actions={["Edit"]}
          onBack={() => navigate("/services/appointments")}
          onActionClick={(action) => {
            if (action === "Edit") navigate(`/services/appointments/${appointment.id}/edit`);
          }}
        />
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <CRMSectionCard title="Appointment Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Appointment Number</p><p className="mt-1 text-sm text-slate-800">{appointment.appointmentNumber}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Service</p><p className="mt-1 text-sm text-slate-800">{appointment.serviceName}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Customer</p><p className="mt-1 text-sm text-slate-800">{appointment.appointmentForDisplay || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Member</p><p className="mt-1 break-all text-sm text-slate-800">{appointment.assignedMemberEmail || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Date</p><p className="mt-1 text-sm text-slate-800">{formatDateOnly(appointment.appointmentDate)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Time</p><p className="mt-1 text-sm text-slate-800">{formatTimeValue(appointment.appointmentStartTime)} - {formatTimeValue(appointment.appointmentEndTime)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Location</p><p className="mt-1 break-words text-sm text-slate-800">{appointment.location || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Status</p><p className="mt-1 text-sm text-slate-800">{appointment.status}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Coverage</p><p className="mt-1 text-sm text-slate-800">{appointment.coverageType || "-"} / {appointment.coverageStatus || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Asset</p><p className="mt-1 text-sm text-slate-800">{appointment.customerAssetName || appointment.productName || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Serial Number</p><p className="mt-1 text-sm text-slate-800">{appointment.productSerialNumber || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Sales Order</p><p className="mt-1 text-sm text-slate-800">{appointment.salesOrderSubject || appointment.salesOrderId || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Invoice</p><p className="mt-1 text-sm text-slate-800">{appointment.invoiceSubject || appointment.invoiceId || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Completed At</p><p className="mt-1 text-sm text-slate-800">{appointment.completedAt ? new Date(appointment.completedAt).toLocaleString() : "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Business Hours</p><p className="mt-1 text-sm text-slate-800">{appointment.businessHoursName || "-"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Timezone</p><p className="mt-1 text-sm text-slate-800">{appointment.businessHoursTimezone || "-"}</p></div>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{appointment.notes || "-"}</p>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Completion Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{appointment.completionNotes || "-"}</p>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Completion Proof</p>
              <div className="mt-1 space-y-1 text-sm text-slate-800">
                {appointment.completionProofUrl ? (
                  <a href={appointment.completionProofUrl} target="_blank" rel="noreferrer" className="break-all text-green-600">
                    {appointment.completionProofUrl}
                  </a>
                ) : null}
                {appointment.completionProofFileUrl ? (
                  <a href={appointment.completionProofFileUrl} target="_blank" rel="noreferrer" className="break-all text-green-600">
                    {appointment.completionProofFileName || "Open uploaded proof file"}
                  </a>
                ) : null}
                {!appointment.completionProofUrl && !appointment.completionProofFileUrl ? <p>-</p> : null}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Public Booking URL</p>
              <p className="mt-1 break-all text-sm text-slate-800">{appointment.publicBookingUrl || "-"}</p>
            </div>
          </CRMSectionCard>
          <div className="space-y-4">
            <CRMSectionCard title="Service Flow">
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Source Service</div>
                  <button type="button" onClick={() => navigate(`/services/catalog/${appointment.serviceId}`)} className="mt-1 text-left text-sm font-medium text-green-600">
                    {appointment.serviceName}
                  </button>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Customer Context</div>
                  {appointment.appointmentForId ? (
                    <button type="button" onClick={openCustomerRecord} className="mt-1 text-left text-sm font-medium text-green-600">
                      {appointment.appointmentForDisplay || `${appointment.appointmentForType} #${appointment.appointmentForId}`}
                    </button>
                  ) : (
                    <div className="mt-1 text-sm text-slate-700">{appointment.appointmentForDisplay || "-"}</div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Connected Order Flow</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {appointment.salesOrderId ? (
                      <button type="button" onClick={() => navigate(`/sales-orders/${appointment.salesOrderId}`)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                        Sales Order
                      </button>
                    ) : null}
                    {appointment.invoiceId ? (
                      <button type="button" onClick={() => navigate(`/invoices/${appointment.invoiceId}`)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                        Invoice
                      </button>
                    ) : null}
                    {appointment.productId ? (
                      <button type="button" onClick={() => navigate(`/products/${appointment.productId}`)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                        Product
                      </button>
                    ) : null}
                    {!appointment.salesOrderId && !appointment.invoiceId && !appointment.productId ? (
                      <div className="text-sm text-slate-500">No connected sales records.</div>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Next Step</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/services/job-sheets/create?appointment=${appointment.id}&service=${appointment.serviceId}`)}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Create Job Sheet
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/services/appointments/${appointment.id}/edit`)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Update Appointment
                    </button>
                  </div>
                </div>
              </div>
            </CRMSectionCard>
          <CRMSectionCard title="Linked Job Sheet" action={<button type="button" onClick={() => navigate(`/services/job-sheets/create?appointment=${appointment.id}&service=${appointment.serviceId}`)} className="text-xs font-medium text-green-600">New Job Sheet</button>}>
            <div className="space-y-2">
              {jobSheets.length ? jobSheets.map((sheet) => (
                <button key={sheet.id} type="button" onClick={() => navigate(`/services/job-sheets/${sheet.id}`)} className="block w-full rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50">
                  <div className="text-sm font-medium text-slate-800">{sheet.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{sheet.status}</div>
                </button>
              )) : <div className="text-sm text-slate-500">No job sheet linked yet.</div>}
            </div>
          </CRMSectionCard>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
