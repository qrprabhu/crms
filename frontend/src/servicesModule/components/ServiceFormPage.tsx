import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { createService, getService, listBusinessHours, listTeamMembers, setServiceMembers, updateService } from "../api";
import { availabilityModeOptions, locationTypeOptions, serviceDeliveryTeamOptions, serviceStatusOptions } from "../config";
import type { BusinessHours, ServiceFormData, TeamMember } from "../types";

const inputClass = "h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500";
const textareaClass = "min-h-[110px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500";

const emptyForm: ServiceFormData = {
  serviceName: "",
  description: "",
  price: 0,
  durationMinutes: 60,
  locationType: "custom",
  location: "",
  status: "draft",
  deliveryTeam: "general",
  availableDaysMode: "business_hours",
  availableTimeMode: "business_hours",
  businessHoursId: "",
  memberIds: [],
  primaryMemberId: "",
};

export default function ServiceFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<ServiceFormData>(emptyForm);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [serviceCode, setServiceCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const hours = await listBusinessHours();
        setBusinessHours(hours);
        if (id) {
          const detail = await getService(id);
          const members = await listTeamMembers("", { team: detail.deliveryTeam });
          setTeamMembers(members);
          setServiceCode(detail.serviceCode);
          setForm({
            serviceName: detail.serviceName,
            description: detail.description,
            price: detail.price,
            durationMinutes: detail.durationMinutes,
            locationType: detail.locationType,
            location: detail.location,
            status: detail.status,
            deliveryTeam: detail.deliveryTeam || "general",
            availableDaysMode: detail.availableDaysMode,
            availableTimeMode: detail.availableTimeMode,
            businessHoursId: detail.businessHours,
            memberIds: detail.members?.map((item) => item.memberId) || [],
            primaryMemberId: detail.members?.find((item) => item.isPrimary)?.memberId || "",
          });
        } else {
          const members = await listTeamMembers("", { team: emptyForm.deliveryTeam });
          setTeamMembers(members);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load service form.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const members = await listTeamMembers("", { team: form.deliveryTeam });
        setTeamMembers(members);
        setForm((current) => {
          const allowedMemberIds = new Set(members.map((item) => item.id));
          const memberIds = current.memberIds.filter((memberId) => allowedMemberIds.has(memberId));
          const primaryMemberId = memberIds.includes(current.primaryMemberId) ? current.primaryMemberId : "";
          return memberIds.length === current.memberIds.length && primaryMemberId === current.primaryMemberId
            ? current
            : { ...current, memberIds, primaryMemberId };
        });
      } catch {
        setTeamMembers([]);
      }
    };
    void loadMembers();
  }, [form.deliveryTeam]);

  const handleSubmit = async (createNew = false) => {
    if (!form.serviceName.trim()) {
      setError("Service name is required.");
      return;
    }
    if (form.price < 0) {
      setError("Price must be greater than or equal to 0.");
      return;
    }
    if (form.durationMinutes <= 0) {
      setError("Duration must be positive.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const service = isEdit && id ? await updateService(id, form) : await createService(form);
      await setServiceMembers(service.id, form.memberIds, form.primaryMemberId || undefined);
      if (createNew) {
        setForm(emptyForm);
        navigate("/services/catalog/create");
      } else {
        navigate(`/services/catalog/${service.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save service.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{isEdit ? "Edit Service" : "Create Service"}</h1>
            <p className="text-sm text-slate-500">Create a service offering with availability, pricing, and member assignment.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate("/services/catalog")} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
            <button type="button" disabled={saving} onClick={() => void handleSubmit(true)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Save and New</button>
            <button type="button" disabled={saving} onClick={() => void handleSubmit(false)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading service...</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div> : null}

        {!loading ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Service Code</label>
                  <input className={`${inputClass} bg-slate-50`} readOnly value={serviceCode || "Auto-generated"} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Service Name</label>
                  <input className={inputClass} value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Price</label>
                  <input type="number" className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Duration (minutes)</label>
                  <input type="number" className={inputClass} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Location Type</label>
                  <select className={inputClass} value={form.locationType} onChange={(e) => setForm({ ...form, locationType: e.target.value })}>
                    {locationTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Location</label>
                  <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                  <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {serviceStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Delivery Team</label>
                  <select className={inputClass} value={form.deliveryTeam} onChange={(e) => setForm({ ...form, deliveryTeam: e.target.value })}>
                    {serviceDeliveryTeamOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Business Hours</label>
                  <select className={inputClass} value={form.businessHoursId} onChange={(e) => setForm({ ...form, businessHoursId: e.target.value })}>
                    <option value="">Select business hours</option>
                    {businessHours.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Available Day(s)</label>
                  <select className={inputClass} value={form.availableDaysMode} onChange={(e) => setForm({ ...form, availableDaysMode: e.target.value })}>
                    {availabilityModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Available Time</label>
                  <select className={inputClass} value={form.availableTimeMode} onChange={(e) => setForm({ ...form, availableTimeMode: e.target.value })}>
                    {availabilityModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <textarea className={textareaClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Members</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {teamMembers.map((member) => {
                  const checked = form.memberIds.includes(member.id);
                  return (
                    <label key={member.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                memberIds: e.target.checked
                                  ? [...new Set([...prev.memberIds, member.id])]
                                  : prev.memberIds.filter((item) => item !== member.id),
                                primaryMemberId:
                                  prev.primaryMemberId === member.id && !e.target.checked ? "" : prev.primaryMemberId,
                              }))
                            }
                          />
                          <span>{member.label} <span className="text-xs text-slate-500">({member.teamLabel})</span></span>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="radio"
                            name="primary-member"
                            checked={form.primaryMemberId === member.id}
                            disabled={!checked}
                            onChange={() => setForm((prev) => ({ ...prev, primaryMemberId: member.id }))}
                          />
                          Primary
                        </label>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
