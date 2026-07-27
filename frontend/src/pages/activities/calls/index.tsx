import { useCallback, useEffect, useRef, useState } from "react";
import { Filter, Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import FilterSidebar from "../../../components/crm/FilterSidebar";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import { apiRequest } from "../../../api/client";
import type { FilterSection } from "../../../lib/shared/crmTypes";
import { keepEmployeeOwnedRows, keepEmployeeVisibleRows } from "../../../lib/shared/recordVisibility";

type FilterMap = Record<string, string>;
type CallType = "Outbound" | "Inbound";
type CallStatus = "Scheduled" | "Completed";
type RelatedToType = "Account" | "Deal" | "None";
type CallForType = "Contact" | "Lead";

interface BackendContact { id: number; first_name: string; last_name: string; email?: string | null }
interface BackendLead { id: number; first_name: string; last_name: string; company?: string }
interface BackendAccount { id: number; account_name: string }
interface BackendDeal { id: number; deal_name: string }
type Paginated<T> = { results: T[] };

interface SearchOption {
  id: number;
  label: string;
}

interface ApiCall {
  id: number;
  subject: string;
  call_type: CallType;
  call_status: CallStatus;
  call_start_time: string;
  duration_minutes: number;
  duration_seconds: number;
  lead?: number | null;
  contact?: number | null;
  related_to_type: RelatedToType;
  account?: number | null;
  deal?: number | null;
  reminder?: string;
  purpose?: string;
  voice_recording?: string;
  owner_name?: string;
  lead_name?: string;
  contact_name?: string;
  account_name?: string;
  deal_name?: string;
}

interface CallRecord {
  id: number;
  subject: string;
  callType: CallType;
  startDate: string;
  startTime: string;
  durationMinutes: number;
  durationSeconds: number;
  callFor: string;
  relatedTo: string;
  owner: string;
  status: CallStatus;
  callForType: CallForType;
  callForId: number | null;
  relatedToType: RelatedToType;
  relatedToId: number | null;
  reminder: string;
  purpose: string;
  voiceRecording: string;
}

interface CallFormValues {
  callForType: CallForType;
  callForId: number | null;
  callForLabel: string;
  relatedToType: RelatedToType;
  relatedToId: number | null;
  relatedToLabel: string;
  callType: CallType;
  startDate: string;
  startTime: string;
  subject: string;
  reminder: string;
  purpose: string;
  durationMinutes: string;
  durationSeconds: string;
  voiceRecording: string;
}

const CALL_FILTER_SECTIONS: FilterSection[] = [
  { title: "Call Type", items: [{ label: "Call type contains", key: "callType" }] },
  { title: "Status", items: [{ label: "Status contains", key: "status" }] },
  { title: "Owner", items: [{ label: "Owner name", key: "owner" }] },
  {
    title: "Related",
    items: [
      { label: "Call For (Contact / Lead)", key: "callFor" },
      { label: "Related To (Account / Deal)", key: "relatedTo" },
    ],
  },
];

function toList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatDisplayTime(timeStr: string) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(hour12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

function emptyFormValues(variant: "schedule" | "log"): CallFormValues {
  return {
    callForType: "Contact",
    callForId: null,
    callForLabel: "",
    relatedToType: "None",
    relatedToId: null,
    relatedToLabel: "",
    callType: "Outbound",
    startDate: getTodayDate(),
    startTime: variant === "schedule" ? "13:00" : getCurrentTime(),
    subject: "",
    reminder: "None",
    purpose: "",
    durationMinutes: "0",
    durationSeconds: "0",
    voiceRecording: "",
  };
}

function callToFormValues(call: CallRecord): CallFormValues {
  return {
    callForType: call.callForType,
    callForId: call.callForId,
    callForLabel: call.callFor === "-" ? "" : call.callFor,
    relatedToType: call.relatedToType,
    relatedToId: call.relatedToId,
    relatedToLabel: call.relatedTo === "-" ? "" : call.relatedTo,
    callType: call.callType,
    startDate: call.startDate,
    startTime: call.startTime,
    subject: call.subject,
    reminder: call.reminder,
    purpose: call.purpose,
    durationMinutes: String(call.durationMinutes),
    durationSeconds: String(call.durationSeconds),
    voiceRecording: call.voiceRecording,
  };
}

function toApiRecord(call: ApiCall): CallRecord {
  const start = new Date(call.call_start_time);
  return {
    id: call.id,
    subject: call.subject,
    callType: call.call_type,
    startDate: start.toISOString().slice(0, 10),
    startTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
    durationMinutes: call.duration_minutes,
    durationSeconds: call.duration_seconds,
    callFor: call.lead_name || call.contact_name || "-",
    relatedTo: call.account_name || call.deal_name || "-",
    owner: call.owner_name || "-",
    status: call.call_status,
    callForType: call.lead ? "Lead" : "Contact",
    callForId: call.lead ?? call.contact ?? null,
    relatedToType: call.related_to_type,
    relatedToId: call.account ?? call.deal ?? null,
    reminder: call.reminder || "None",
    purpose: call.purpose || "",
    voiceRecording: call.voice_recording || "",
  };
}

function buildPayload(values: CallFormValues, status: CallStatus) {
  return {
    subject: values.subject || `${values.callType} call with ${values.callForLabel || "Unknown"}`,
    call_type: values.callType,
    call_status: status,
    call_start_time: `${values.startDate}T${values.startTime}:00`,
    duration_minutes: Number(values.durationMinutes) || 0,
    duration_seconds: Number(values.durationSeconds) || 0,
    related_to_type: values.relatedToType,
    reminder: values.reminder,
    purpose: values.purpose,
    voice_recording: values.voiceRecording,
    ...(values.callForType === "Contact" && values.callForId ? { contact: values.callForId, lead: null } : { contact: null }),
    ...(values.callForType === "Lead" && values.callForId ? { lead: values.callForId, contact: null } : { lead: null }),
    ...(values.relatedToType === "Account" && values.relatedToId ? { account: values.relatedToId, deal: null } : { account: null }),
    ...(values.relatedToType === "Deal" && values.relatedToId ? { deal: values.relatedToId, account: null } : { deal: null }),
  };
}

function useLookupData() {
  const [contacts, setContacts] = useState<SearchOption[]>([]);
  const [leads, setLeads] = useState<SearchOption[]>([]);
  const [accounts, setAccounts] = useState<SearchOption[]>([]);
  const [deals, setDeals] = useState<SearchOption[]>([]);

  useEffect(() => {
    apiRequest<BackendContact[] | Paginated<BackendContact>>("/contacts/")
      .then((data) => setContacts(keepEmployeeOwnedRows(toList(data)).map((contact) => ({
        id: contact.id,
        label: `${contact.first_name} ${contact.last_name}`.trim() || contact.email || String(contact.id),
      }))))
      .catch(() => {});

    apiRequest<BackendLead[] | Paginated<BackendLead>>("/leads/")
      .then((data) => setLeads(keepEmployeeOwnedRows(toList(data)).map((lead) => ({
        id: lead.id,
        label: `${lead.first_name} ${lead.last_name}`.trim() || lead.company || String(lead.id),
      }))))
      .catch(() => {});

    apiRequest<BackendAccount[] | Paginated<BackendAccount>>("/accounts/")
      .then((data) => setAccounts(keepEmployeeOwnedRows(toList(data)).map((account) => ({ id: account.id, label: account.account_name }))))
      .catch(() => {});

    apiRequest<BackendDeal[] | Paginated<BackendDeal>>("/deals/")
      .then((data) => setDeals(keepEmployeeOwnedRows(toList(data)).map((deal) => ({ id: deal.id, label: deal.deal_name }))))
      .catch(() => {});
  }, []);

  return { contacts, leads, accounts, deals };
}

function SearchDropdown({
  placeholder,
  options,
  selectedId,
  selectedLabel,
  onSelect,
  onClear,
}: {
  placeholder: string;
  options: SearchOption[];
  selectedId: number | null;
  selectedLabel: string;
  onSelect: (id: number, label: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative flex-1" ref={ref}>
      {selectedId ? (
        <div className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm">
          <span className="text-slate-800">{selectedLabel}</span>
          <button type="button" onClick={onClear} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center rounded-md border border-slate-300 px-3 py-2">
            <Search size={14} className="mr-2 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          {open && (
            <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500">No results found.</p>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
                    onClick={() => {
                      onSelect(option.id, option.label);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function CallFormModal({
  title,
  submitLabel,
  initialValues,
  onClose,
  onSubmit,
  saving,
  status,
}: {
  title: string;
  submitLabel: string;
  initialValues: CallFormValues;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  saving?: boolean;
  status: CallStatus;
}) {
  const { contacts, leads, accounts, deals } = useLookupData();
  const [formValues, setFormValues] = useState<CallFormValues>(initialValues);

  useEffect(() => {
    setFormValues(initialValues);
  }, [initialValues]);

  const callForOptions = formValues.callForType === "Contact" ? contacts : leads;
  const relatedOptions =
    formValues.relatedToType === "Account"
      ? accounts
      : formValues.relatedToType === "Deal"
        ? deals
        : [];

  const handleSubmit = () => {
    onSubmit(buildPayload(formValues, status));
  };

  return (
    <ModalShell title={title} onClose={onClose}>
      <FormRow label="Call For">
        <div className="flex gap-2">
          <select
            value={formValues.callForType}
            onChange={(event) => setFormValues((current) => ({
              ...current,
              callForType: event.target.value as CallForType,
              callForId: null,
              callForLabel: "",
            }))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none"
          >
            <option value="Contact">Contact</option>
            <option value="Lead">Lead</option>
          </select>
          <SearchDropdown
            placeholder={`Search ${formValues.callForType}...`}
            options={callForOptions}
            selectedId={formValues.callForId}
            selectedLabel={formValues.callForLabel}
            onSelect={(id, label) => setFormValues((current) => ({ ...current, callForId: id, callForLabel: label }))}
            onClear={() => setFormValues((current) => ({ ...current, callForId: null, callForLabel: "" }))}
          />
        </div>
      </FormRow>

      <FormRow label="Related To">
        <div className="flex gap-2">
          <select
            value={formValues.relatedToType}
            onChange={(event) => setFormValues((current) => ({
              ...current,
              relatedToType: event.target.value as RelatedToType,
              relatedToId: null,
              relatedToLabel: "",
            }))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none"
          >
            <option value="None">None</option>
            <option value="Account">Account</option>
            <option value="Deal">Deal</option>
          </select>
          {formValues.relatedToType !== "None" && (
            <SearchDropdown
              placeholder={`Search ${formValues.relatedToType}...`}
              options={relatedOptions}
              selectedId={formValues.relatedToId}
              selectedLabel={formValues.relatedToLabel}
              onSelect={(id, label) => setFormValues((current) => ({ ...current, relatedToId: id, relatedToLabel: label }))}
              onClear={() => setFormValues((current) => ({ ...current, relatedToId: null, relatedToLabel: "" }))}
            />
          )}
        </div>
      </FormRow>

      <FormRow label="Call Type">
        <select
          value={formValues.callType}
          onChange={(event) => setFormValues((current) => ({ ...current, callType: event.target.value as CallType }))}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none"
        >
          <option value="Outbound">Outbound</option>
          <option value="Inbound">Inbound</option>
        </select>
      </FormRow>

      <FormRow label="Call Start Time">
        <div className="flex gap-2">
          <input
            type="date"
            value={formValues.startDate}
            onChange={(event) => setFormValues((current) => ({ ...current, startDate: event.target.value }))}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          <input
            type="time"
            value={formValues.startTime}
            onChange={(event) => setFormValues((current) => ({ ...current, startTime: event.target.value }))}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none"
          />
        </div>
      </FormRow>

      <FormRow label="Subject">
        <input
          value={formValues.subject}
          onChange={(event) => setFormValues((current) => ({ ...current, subject: event.target.value }))}
          placeholder="Call subject"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
        />
      </FormRow>

      <FormRow label="Reminder">
        <select
          value={formValues.reminder}
          onChange={(event) => setFormValues((current) => ({ ...current, reminder: event.target.value }))}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none"
        >
          <option value="None">None</option>
          <option value="At time of call">At time of call</option>
          <option value="5 minutes before">5 minutes before</option>
          <option value="15 minutes before">15 minutes before</option>
          <option value="30 minutes before">30 minutes before</option>
          <option value="1 hour before">1 hour before</option>
        </select>
      </FormRow>

      <FormRow label="Call Duration">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={formValues.durationMinutes}
            onChange={(event) => setFormValues((current) => ({ ...current, durationMinutes: event.target.value }))}
            className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          <span className="text-sm text-slate-600">min</span>
          <input
            type="number"
            min="0"
            value={formValues.durationSeconds}
            onChange={(event) => setFormValues((current) => ({ ...current, durationSeconds: event.target.value }))}
            className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          <span className="text-sm text-slate-600">sec</span>
        </div>
      </FormRow>

      <FormRow label="Voice Recording">
        <input
          value={formValues.voiceRecording}
          onChange={(event) => setFormValues((current) => ({ ...current, voiceRecording: event.target.value }))}
          placeholder="Recording URL or note"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
        />
      </FormRow>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Purpose</label>
        <textarea
          rows={4}
          value={formValues.purpose}
          onChange={(event) => setFormValues((current) => ({ ...current, purpose: event.target.value }))}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </ModalShell>
  );
}

function CallDetailModal({
  call,
  onClose,
  onEdit,
}: {
  call: CallRecord;
  onClose: () => void;
  onEdit: (call: CallRecord) => void;
}) {
  const statusColor = call.status === "Completed" ? "bg-green-100 text-green-800" : "bg-green-100 text-blue-800";
  const typeColor = call.callType === "Inbound" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex-1 pr-4">
            <h2 className="text-lg font-semibold text-slate-900">{call.subject}</h2>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>{call.status}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColor}`}>{call.callType}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date</p>
              <p className="text-sm text-slate-800">{formatDisplayDate(call.startDate)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Time</p>
              <p className="text-sm text-slate-800">{formatDisplayTime(call.startTime)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duration</p>
              <p className="text-sm text-slate-800">{String(call.durationMinutes).padStart(2, "0")}m {String(call.durationSeconds).padStart(2, "0")}s</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner</p>
              <p className="text-sm text-slate-800">{call.owner}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Call For</p>
              <p className="text-sm text-slate-800">{call.callFor}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Related To</p>
              <p className="text-sm text-slate-800">{call.relatedTo}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Purpose</p>
            <p className="text-sm text-slate-800">{call.purpose || "No purpose added."}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={() => onEdit(call)}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Pencil size={14} />
            Edit Call
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setFilters] = useState<FilterMap>({});
  const [showSchedule, setShowSchedule] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [editingCall, setEditingCall] = useState<CallRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const loadCalls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<ApiCall[] | Paginated<ApiCall>>("/calls/", { method: "GET" });
      setCalls(keepEmployeeVisibleRows(toList(data).map(toApiRecord), (call) => call.owner));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load calls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalls();
  }, [loadCalls]);

  const createCall = async (payload: Record<string, unknown>) => {
    try {
      setSaving(true);
      await apiRequest("/calls/", { method: "POST", body: JSON.stringify(payload) });
      setShowSchedule(false);
      setShowLog(false);
      void loadCalls();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save call");
    } finally {
      setSaving(false);
    }
  };

  const updateCall = async (payload: Record<string, unknown>) => {
    if (!editingCall) {
      return;
    }

    try {
      setSaving(true);
      await apiRequest(`/calls/${editingCall.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setEditingCall(null);
      setSelectedCall(null);
      void loadCalls();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update call");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(calls.map((c) => c.id)) : new Set());
  };

  const handleDeleteSingle = async (id: number) => {
    if (!confirm("Delete this call? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiRequest(`/calls/${id}/`, { method: "DELETE" });
      setCalls((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch {
      alert("Could not delete this call. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.size} call${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => apiRequest(`/calls/${id}/`, { method: "DELETE" })));
      setCalls((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
    } catch {
      alert("Some calls could not be deleted. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="px-6 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Calls</h1>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFilterOpen((prev) => !prev)}
              className={`flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 ${
                filterOpen ? "bg-slate-100 shadow-sm" : "bg-white"
              }`}
            >
              <Filter size={16} />
              <span>Filters</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSchedule(true)}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Call
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          {filterOpen && (
            <FilterSidebar
              title="Filter Calls by"
              sections={CALL_FILTER_SECTIONS}
              onApply={(activeFilters) => setFilters(activeFilters)}
              onClear={() => setFilters({})}
            />
          )}

          <div className="flex-1">
            {/* Bulk selection bar */}
            {selectedIds.size > 0 && (
              <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-800 px-5 py-2.5">
                <span className="text-sm font-medium text-white">
                  {selectedIds.size} record{selectedIds.size !== 1 ? "s" : ""} selected
                </span>
                <span className="text-slate-500">·</span>
                <button type="button" onClick={() => setSelectedIds(new Set())} className="text-sm text-slate-400 hover:text-white">
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteSelected()}
                  disabled={deleting}
                  className="ml-2 flex items-center gap-1.5 rounded border border-red-400 px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500 hover:text-white disabled:opacity-60"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white">
                  <X size={15} />
                </button>
              </div>
            )}

            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">Loading calls...</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-rose-600">{error}</p>
              </div>
            ) : calls.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm font-medium text-slate-500">No calls found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === calls.length && calls.length > 0}
                          ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < calls.length; }}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Subject</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Call Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Call Start Time</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Duration</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Call For</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Related To</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => (
                      <tr
                        key={call.id}
                        className={`cursor-pointer border-b transition hover:bg-slate-50 ${selectedIds.has(call.id) ? "bg-green-50" : ""}`}
                        onClick={() => setSelectedCall(call)}
                      >
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(call.id)}
                            onChange={() => toggleSelect(call.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                          />
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-green-600 underline-offset-2 hover:underline">
                          {call.subject}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">{call.callType}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {formatDisplayDate(call.startDate)} {formatDisplayTime(call.startTime)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {String(call.durationMinutes).padStart(2, "0")}m {String(call.durationSeconds).padStart(2, "0")}s
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">{call.callFor}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{call.relatedTo}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            call.status === "Completed" ? "bg-green-100 text-green-800" : "bg-green-100 text-blue-800"
                          }`}>
                            {call.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingCall(call)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteSingle(call.id)}
                              disabled={deleting}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 disabled:opacity-60"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSchedule && (
        <CallFormModal
          title="Schedule a Call"
          submitLabel="Schedule"
          initialValues={emptyFormValues("schedule")}
          onClose={() => setShowSchedule(false)}
          onSubmit={createCall}
          saving={saving}
          status="Scheduled"
        />
      )}

      {showLog && (
        <CallFormModal
          title="Log a Call"
          submitLabel="Save"
          initialValues={emptyFormValues("log")}
          onClose={() => setShowLog(false)}
          onSubmit={createCall}
          saving={saving}
          status="Completed"
        />
      )}

      {editingCall && (
        <CallFormModal
          title="Edit Call"
          submitLabel="Update"
          initialValues={callToFormValues(editingCall)}
          onClose={() => setEditingCall(null)}
          onSubmit={updateCall}
          saving={saving}
          status={editingCall.status}
        />
      )}

      {selectedCall && (
        <CallDetailModal
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          onEdit={(call) => {
            setSelectedCall(null);
            setEditingCall(call);
          }}
        />
      )}
    </DashboardLayout>
  );
}
