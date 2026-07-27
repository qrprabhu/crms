import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import {
  appointmentCoverageStatusOptions,
  appointmentCoverageTypeOptions,
  appointmentEntityTypeOptions,
  appointmentStatusOptions,
} from "../config";
import {
  createAppointment,
  getAppointment,
  getLookupOptionById,
  getService,
  listHolidays,
  listServices,
  listTeamMembers,
  updateAppointment,
} from "../api";
import type { AppointmentFormData, Holiday, LookupOption, ServiceRecord, TeamMember } from "../types";
import ServicesLookupModal from "./ServicesLookupModal";

const inputClass = "h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500";
const textareaClass = "min-h-[110px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500";

const emptyForm: AppointmentFormData = {
  serviceId: "",
  appointmentForType: "contact",
  appointmentForId: "",
  appointmentForLabel: "",
  appointmentDate: "",
  appointmentStartTime: "",
  appointmentEndTime: "",
  assignedMemberId: "",
  productId: "",
  productLabel: "",
  salesOrderId: "",
  salesOrderLabel: "",
  invoiceId: "",
  invoiceLabel: "",
  customerAssetName: "",
  productSerialNumber: "",
  coverageType: "none",
  coverageStatus: "not_applicable",
  location: "",
  status: "scheduled",
  notes: "",
  completionNotes: "",
  completionProofUrl: "",
  completionProofFile: null,
  completionProofFileUrl: "",
  completionProofFileName: "",
  clearCompletionProofFile: false,
};

function withSearchDefaults(searchParams: URLSearchParams): AppointmentFormData {
  return {
    ...emptyForm,
    serviceId: searchParams.get("service") || "",
    salesOrderId: searchParams.get("salesOrder") || "",
    salesOrderLabel: "",
    invoiceId: searchParams.get("invoice") || "",
    invoiceLabel: "",
  };
}

export default function AppointmentFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<AppointmentFormData>(() => withSearchDefaults(searchParams));
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceRecord | null>(null);
  const [appointmentNumber, setAppointmentNumber] = useState("");
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupMode, setLookupMode] = useState<"appointment" | "product" | "sales-order" | "invoice">("appointment");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [serviceRows, holidayRows] = await Promise.all([listServices(), listHolidays()]);
        setServices(serviceRows);
        setHolidays(holidayRows);
        if (id) {
          const detail = await getAppointment(id);
          const serviceDetail = await getService(detail.serviceId);
          const memberRows = await listTeamMembers("", { serviceId: detail.serviceId });
          setSelectedService(serviceDetail);
          setMembers(memberRows);
          setAppointmentNumber(detail.appointmentNumber);
          setForm({
            serviceId: detail.serviceId,
            appointmentForType: detail.appointmentForType,
            appointmentForId: detail.appointmentForId,
            appointmentForLabel: detail.appointmentForDisplay,
            appointmentDate: detail.appointmentDate,
            appointmentStartTime: detail.appointmentStartTime,
            appointmentEndTime: detail.appointmentEndTime,
            assignedMemberId: detail.assignedMemberId,
            productId: detail.productId,
            productLabel: detail.productName,
            salesOrderId: detail.salesOrderId,
            salesOrderLabel: detail.salesOrderSubject,
            invoiceId: detail.invoiceId,
            invoiceLabel: detail.invoiceSubject,
            customerAssetName: detail.customerAssetName,
            productSerialNumber: detail.productSerialNumber,
            coverageType: detail.coverageType || "none",
            coverageStatus: detail.coverageStatus || "not_applicable",
            location: detail.location,
            status: detail.status,
            notes: detail.notes,
            completionNotes: detail.completionNotes,
            completionProofUrl: detail.completionProofUrl,
            completionProofFile: null,
            completionProofFileUrl: detail.completionProofFileUrl,
            completionProofFileName: detail.completionProofFileName,
            clearCompletionProofFile: false,
          });
        } else if (searchParams.get("service")) {
          const serviceDetail = await getService(searchParams.get("service") as string);
          const memberRows = await listTeamMembers("", { serviceId: serviceDetail.id });
          setSelectedService(serviceDetail);
          setMembers(memberRows);
          setForm((prev) => ({
            ...prev,
            serviceId: serviceDetail.id,
            location: prev.location || serviceDetail.location || "",
          }));
        } else {
          setForm((prev) => ({
            ...withSearchDefaults(searchParams),
            appointmentDate: prev.appointmentDate,
            appointmentStartTime: prev.appointmentStartTime,
            appointmentEndTime: prev.appointmentEndTime,
            assignedMemberId: prev.assignedMemberId,
            customerAssetName: prev.customerAssetName,
            productSerialNumber: prev.productSerialNumber,
            coverageType: prev.coverageType,
            coverageStatus: prev.coverageStatus,
            location: prev.location,
            status: prev.status,
            notes: prev.notes,
            completionNotes: prev.completionNotes,
            completionProofUrl: prev.completionProofUrl,
            completionProofFile: prev.completionProofFile,
            completionProofFileUrl: prev.completionProofFileUrl,
            completionProofFileName: prev.completionProofFileName,
            clearCompletionProofFile: prev.clearCompletionProofFile,
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load appointment form.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, searchParams]);

  useEffect(() => {
    if (isEdit) return;

    const salesOrderFromQuery = searchParams.get("salesOrder") || "";
    const invoiceFromQuery = searchParams.get("invoice") || "";
    const serviceFromQuery = searchParams.get("service") || "";

    setForm((prev) => ({
      ...prev,
      serviceId: serviceFromQuery || prev.serviceId,
      salesOrderId: salesOrderFromQuery || (invoiceFromQuery ? "" : ""),
      salesOrderLabel: salesOrderFromQuery || invoiceFromQuery ? "" : prev.salesOrderLabel,
      invoiceId: invoiceFromQuery || "",
      invoiceLabel: invoiceFromQuery ? "" : "",
    }));
  }, [isEdit, searchParams]);

  useEffect(() => {
    const loadSelectedService = async () => {
      if (!form.serviceId) {
        setSelectedService(null);
        return;
      }
      try {
        const detail = await getService(form.serviceId);
        const serviceMembers = await listTeamMembers("", { serviceId: detail.id });
        setSelectedService(detail);
        setMembers(serviceMembers);
        const allowedMemberIds = new Set((detail.members || []).map((member) => member.memberId));
        const teamMemberIds = new Set(serviceMembers.map((member) => member.id));
        if (form.assignedMemberId && !teamMemberIds.has(form.assignedMemberId)) {
          setForm((prev) => ({ ...prev, assignedMemberId: "" }));
        }
        if (allowedMemberIds.size === 1) {
          const [onlyMemberId] = Array.from(allowedMemberIds);
          setForm((prev) => ({ ...prev, assignedMemberId: prev.assignedMemberId || onlyMemberId }));
        } else if (!allowedMemberIds.size && serviceMembers.length === 1) {
          setForm((prev) => ({ ...prev, assignedMemberId: prev.assignedMemberId || serviceMembers[0].id }));
        }
        setForm((prev) => {
          if (prev.location.trim()) return prev;
          if (detail.locationBehavior === "online") {
            return { ...prev, location: detail.location || "Virtual meeting" };
          }
          if (detail.locationBehavior === "hybrid") {
            return { ...prev, location: detail.location || "Hybrid service" };
          }
          return { ...prev, location: detail.location || "" };
        });
      } catch {
        setSelectedService(null);
        setMembers([]);
      }
    };
    void loadSelectedService();
  }, [form.serviceId]);

  const memberOptions = members;

  useEffect(() => {
    if (!selectedService || !form.appointmentStartTime) return;
    const [hours, minutes] = form.appointmentStartTime.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
    const totalMinutes = hours * 60 + minutes + (selectedService.durationMinutes || 0);
    const normalizedHours = Math.floor(totalMinutes / 60) % 24;
    const normalizedMinutes = totalMinutes % 60;
    const computed = `${String(normalizedHours).padStart(2, "0")}:${String(normalizedMinutes).padStart(2, "0")}`;
    setForm((prev) => (prev.appointmentEndTime === computed ? prev : { ...prev, appointmentEndTime: computed }));
  }, [form.appointmentStartTime, selectedService]);

  useEffect(() => {
    if (form.appointmentForType === "product" && form.appointmentForId && form.productId !== form.appointmentForId) {
      setForm((prev) => ({ ...prev, productId: prev.appointmentForId }));
    }
  }, [form.appointmentForId, form.appointmentForType, form.productId]);

  useEffect(() => {
    let cancelled = false;

    const syncLabels = async () => {
      try {
        const [salesOrder, invoice, product] = await Promise.all([
          form.salesOrderId && !form.salesOrderLabel ? getLookupOptionById("sales-order", form.salesOrderId) : Promise.resolve(null),
          form.invoiceId && !form.invoiceLabel ? getLookupOptionById("invoice", form.invoiceId) : Promise.resolve(null),
          form.productId && !form.productLabel ? getLookupOptionById("product", form.productId) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        if (salesOrder || invoice || product) {
          setForm((prev) => ({
            ...prev,
            salesOrderLabel: prev.salesOrderLabel || salesOrder?.label || "",
            invoiceLabel: prev.invoiceLabel || invoice?.label || "",
            productLabel: prev.productLabel || product?.label || "",
            salesOrderId: prev.invoiceId ? invoice?.salesOrderId || "" : prev.salesOrderId || invoice?.salesOrderId || "",
          }));
        }
      } catch {
        // Keep ids as-is if linked lookup enrichment fails.
      }
    };

    void syncLabels();
    return () => {
      cancelled = true;
    };
  }, [form.invoiceId, form.invoiceLabel, form.productId, form.productLabel, form.salesOrderId, form.salesOrderLabel]);

  useEffect(() => {
    if (form.coverageType === "none" && form.coverageStatus !== "not_applicable") {
      setForm((prev) => ({ ...prev, coverageStatus: "not_applicable" }));
    }
  }, [form.coverageType, form.coverageStatus]);

  useEffect(() => {
    if (!form.appointmentDate) return;
    const holiday = holidays.find((item) => item.date === form.appointmentDate);
    if (holiday) {
      setError(`${holiday.name} is marked as a holiday. Appointment booking is blocked for this date.`);
    } else if (error?.includes("holiday")) {
      setError(null);
    }
  }, [form.appointmentDate, holidays]);

  const handleSubmit = async () => {
    if (!form.serviceId) return setError("Service is required.");
    if (!form.appointmentDate) return setError("Appointment date is required.");
    if (!form.appointmentStartTime) return setError("Appointment start time is required.");
    if (holidays.some((item) => item.date === form.appointmentDate)) {
      return setError("Appointments cannot be booked on a holiday.");
    }
    if (form.appointmentForType === "other" && !form.appointmentForLabel.trim()) {
      return setError("Appointment label is required for Other.");
    }
    try {
      setSaving(true);
      setError(null);
      const appointment = isEdit && id ? await updateAppointment(id, form) : await createAppointment(form);
      navigate(`/services/appointments/${appointment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save appointment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{isEdit ? "Edit Appointment" : "Create Appointment"}</h1>
            <p className="text-sm text-slate-500">Schedule a service against a CRM customer and staff member.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate("/services/appointments")} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
            <button type="button" disabled={saving} onClick={() => void handleSubmit()} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading appointment...</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div> : null}

        {!loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Appointment Number</label>
                <input className={`${inputClass} bg-slate-50`} readOnly value={appointmentNumber || "Auto-generated"} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Service Name</label>
                <select className={inputClass} value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
                  <option value="">Select service</option>
                  {services.map((item) => <option key={item.id} value={item.id}>{item.serviceName}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Appointment For</label>
                <div className="space-y-2">
                  <select className={inputClass} value={form.appointmentForType} onChange={(e) => setForm({ ...form, appointmentForType: e.target.value as any, appointmentForId: "", appointmentForLabel: "" })}>
                    {appointmentEntityTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {form.appointmentForType === "other" ? (
                    <input className={inputClass} value={form.appointmentForLabel} onChange={(e) => setForm({ ...form, appointmentForLabel: e.target.value })} placeholder="Enter name" />
                  ) : (
                    <div className="flex gap-2">
                      <input readOnly className={`${inputClass} flex-1`} value={form.appointmentForLabel} placeholder="Choose record" />
                      <button type="button" onClick={() => { setLookupMode("appointment"); setLookupOpen(true); }} className="rounded-md border border-slate-300 px-3 text-sm text-slate-700">Lookup</button>
                      {form.appointmentForId ? <button type="button" onClick={() => setForm({ ...form, appointmentForId: "", appointmentForLabel: "" })} className="rounded-md border border-slate-300 px-3 text-sm text-slate-700">Clear</button> : null}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Member</label>
                <select className={inputClass} value={form.assignedMemberId} onChange={(e) => setForm({ ...form, assignedMemberId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {memberOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                {selectedService?.members?.length ? <p className="mt-1 text-xs text-slate-500">Only members assigned to the selected service are available.</p> : null}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Appointment Date</label>
                <input type="date" className={inputClass} value={form.appointmentDate} onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Location</label>
                <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                {selectedService?.locationBehavior ? <p className="mt-1 text-xs text-slate-500">Location behavior: {selectedService.locationBehavior}. Service defaults are applied automatically.</p> : null}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Appointment Start Time</label>
                <input type="time" className={inputClass} value={form.appointmentStartTime} onChange={(e) => setForm({ ...form, appointmentStartTime: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Appointment End Time</label>
                <input type="time" className={`${inputClass} bg-slate-50`} readOnly value={form.appointmentEndTime} onChange={(e) => setForm({ ...form, appointmentEndTime: e.target.value })} />
                <p className="mt-1 text-xs text-slate-500">End time is auto-calculated from the selected service duration.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {appointmentStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
            {selectedService?.businessHoursDetails ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Booking follows <span className="font-medium text-slate-900">{selectedService.businessHoursName || selectedService.businessHoursDetails.name}</span>
                {selectedService.businessHoursTimezone ? ` (${selectedService.businessHoursTimezone})` : ""}.
              </div>
            ) : null}
            {form.salesOrderId || form.invoiceId ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-green-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">Linked execution source</div>
                {form.salesOrderId ? <div className="mt-1">Sales Order: {form.salesOrderLabel || form.salesOrderId}</div> : null}
                {form.invoiceId ? <div className="mt-1">Invoice: {form.invoiceLabel || form.invoiceId}</div> : null}
              </div>
            ) : null}
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-900">Asset & Coverage</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer Asset Name</label>
                  <input className={inputClass} value={form.customerAssetName} onChange={(e) => setForm({ ...form, customerAssetName: e.target.value })} placeholder="AC Unit, Printer, Router..." />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Product Serial Number</label>
                  <input className={inputClass} value={form.productSerialNumber} onChange={(e) => setForm({ ...form, productSerialNumber: e.target.value })} placeholder="Enter serial number" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Coverage Type</label>
                  <select className={inputClass} value={form.coverageType} onChange={(e) => setForm({ ...form, coverageType: e.target.value })}>
                    {appointmentCoverageTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Coverage Status</label>
                  <select className={inputClass} value={form.coverageStatus} onChange={(e) => setForm({ ...form, coverageStatus: e.target.value })} disabled={form.coverageType === "none"}>
                    {appointmentCoverageStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Linked Product ID</label>
                  <div className="flex gap-2">
                    <input readOnly className={`${inputClass} flex-1`} value={form.productLabel || form.productId} placeholder="Select product" />
                    <button type="button" onClick={() => { setLookupMode("product"); setLookupOpen(true); }} className="rounded-md border border-slate-300 px-3 text-sm text-slate-700">Lookup</button>
                    {form.productId ? <button type="button" onClick={() => setForm({ ...form, productId: "", productLabel: "" })} className="rounded-md border border-slate-300 px-3 text-sm text-slate-700">Clear</button> : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">If you selected Product in appointment lookup, this fills automatically.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Sales Order ID</label>
                  <div className="flex gap-2">
                    <input readOnly className={`${inputClass} flex-1`} value={form.salesOrderLabel || form.salesOrderId} placeholder="Select sales order" />
                    <button type="button" onClick={() => { setLookupMode("sales-order"); setLookupOpen(true); }} className="rounded-md border border-slate-300 px-3 text-sm text-slate-700">Lookup</button>
                    {form.salesOrderId ? <button type="button" onClick={() => setForm({ ...form, salesOrderId: "", salesOrderLabel: "", invoiceId: "", invoiceLabel: "" })} className="rounded-md border border-slate-300 px-3 text-sm text-slate-700">Clear</button> : null}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice ID</label>
                  <div className="flex gap-2">
                    <input readOnly className={`${inputClass} flex-1`} value={form.invoiceLabel || form.invoiceId} placeholder="Select invoice" />
                    <button type="button" onClick={() => { setLookupMode("invoice"); setLookupOpen(true); }} className="rounded-md border border-slate-300 px-3 text-sm text-slate-700">Lookup</button>
                    {form.invoiceId ? <button type="button" onClick={() => setForm({ ...form, invoiceId: "", invoiceLabel: "" })} className="rounded-md border border-slate-300 px-3 text-sm text-slate-700">Clear</button> : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
              <textarea className={textareaClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-900">Completion Details</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Completion Notes</label>
                  <textarea className={textareaClass} value={form.completionNotes} onChange={(e) => setForm({ ...form, completionNotes: e.target.value })} placeholder="Work done, parts replaced, final condition..." />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Completion Proof URL</label>
                  <input className={inputClass} value={form.completionProofUrl} onChange={(e) => setForm({ ...form, completionProofUrl: e.target.value })} placeholder="Photo, signature, drive link..." />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Completion Proof Document</label>
                  <input
                    type="file"
                    className={`${inputClass} h-auto py-2`}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        completionProofFile: e.target.files?.[0] || null,
                        clearCompletionProofFile: false,
                      }))
                    }
                  />
                  {form.completionProofFileName || form.completionProofFile ? (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span>{form.completionProofFile?.name || form.completionProofFileName}</span>
                      {form.completionProofFileUrl ? (
                        <a
                          href={form.completionProofFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-green-600"
                        >
                          Open current file
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            completionProofFile: null,
                            completionProofFileUrl: "",
                            completionProofFileName: "",
                            clearCompletionProofFile: true,
                          }))
                        }
                        className="font-medium text-slate-700"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">Upload photo, signed document, PDF, or any proof file.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <ServicesLookupModal
        open={lookupOpen}
        type={lookupMode === "appointment" ? form.appointmentForType : lookupMode}
        onClose={() => setLookupOpen(false)}
        onSelect={(option: LookupOption) => {
          if (lookupMode === "appointment") {
            setForm({ ...form, appointmentForId: option.id, appointmentForLabel: option.label });
            return;
          }
          if (lookupMode === "product") {
            setForm((prev) => ({ ...prev, productId: option.id, productLabel: option.label }));
            return;
          }
          if (lookupMode === "sales-order") {
            setForm((prev) => ({
              ...prev,
              salesOrderId: option.id,
              salesOrderLabel: option.label,
              invoiceId: "",
              invoiceLabel: "",
              appointmentForType:
                prev.appointmentForId
                  ? prev.appointmentForType
                  : option.contactId
                    ? "contact"
                    : option.accountId
                      ? "account"
                      : option.dealId
                        ? "deal"
                        : prev.appointmentForType,
              appointmentForId:
                prev.appointmentForId || option.contactId || option.accountId || option.dealId || "",
              appointmentForLabel: prev.appointmentForLabel || option.label,
            }));
            return;
          }
          setForm((prev) => ({
            ...prev,
            invoiceId: option.id,
            invoiceLabel: option.label,
            salesOrderId: option.salesOrderId || "",
            salesOrderLabel: "",
            appointmentForType:
              prev.appointmentForId
                ? prev.appointmentForType
                : option.contactId
                  ? "contact"
                  : option.accountId
                    ? "account"
                    : option.dealId
                      ? "deal"
                      : prev.appointmentForType,
            appointmentForId:
              prev.appointmentForId || option.contactId || option.accountId || option.dealId || "",
            appointmentForLabel: prev.appointmentForLabel || option.label,
          }));
        }}
      />
    </DashboardLayout>
  );
}
