import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import { apiRequest } from "../../../api/client";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  List,
  Loader2,
  MoreHorizontal,
  Phone,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  RefreshCw,
  Grid2x2,
  Trash2,
  User,
  Lock,
  X,
} from "lucide-react";

type CallForType = "Contact" | "Lead";
type RelatedToType = "Account" | "Deal" | "None";
type CallType = "Outbound" | "Inbound";
type CallStatus = "Scheduled" | "Completed";
type ReminderType =
  | "None"
  | "At time of call"
  | "5 minutes before"
  | "10 minutes before"
  | "15 minutes before"
  | "30 minutes before"
  | "1 hour before";

type CallRecord = {
  id: number;
  subject: string;
  callType: CallType;
  startDate: string;
  startTime: string;
  durationMinutes?: number;
  durationSeconds?: number;
  relatedTo: string;
  owner: string;
  callForType: CallForType;
  callForName: string;
  relatedToType: RelatedToType;
  status: CallStatus;
  reminder?: ReminderType;
  purpose?: string;
  voiceRecording?: string;
};

type CallFormState = {
  callForType: CallForType;
  callForName: string;
  relatedToType: RelatedToType;
  relatedToName: string;
  callType: CallType;
  status: CallStatus;
  startDate: string;
  startTime: string;
  owner: string;
  subject: string;
  reminder: ReminderType;
  purpose: string;
  durationMinutes: string;
  durationSeconds: string;
  voiceRecording: string;
};

type BackendCall = {
  id: number;
  subject: string;
  call_type: string;
  call_status: string;
  call_start_time: string;
  duration_minutes: number;
  duration_seconds: number;
  owner: number | null;
  owner_name: string | null;
  lead: number | null;
  lead_name: string | null;
  contact: number | null;
  contact_name: string | null;
  related_to_type: string;
  account: number | null;
  account_name: string | null;
  deal: number | null;
  deal_name: string | null;
  reminder: string;
  purpose: string;
  voice_recording: string;
};

function mapBackendCall(c: BackendCall): CallRecord {
  const dt = new Date(c.call_start_time);
  const startDate = dt.toISOString().split("T")[0];
  const startTime = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  const callForType: CallForType = c.lead ? "Lead" : "Contact";
  const callForName = c.lead ? (c.lead_name ?? "") : (c.contact_name ?? "");
  const relatedToType: RelatedToType =
    c.related_to_type === "Account" ? "Account" : c.related_to_type === "Deal" ? "Deal" : "None";
  const relatedTo = c.account_name || c.deal_name || callForName || "—";
  return {
    id: c.id,
    subject: c.subject,
    callType: c.call_type as CallType,
    startDate,
    startTime,
    relatedTo,
    owner: c.owner_name ?? "",
    callForType,
    callForName,
    relatedToType,
    status: c.call_status as CallStatus,
    durationMinutes: c.duration_minutes,
    durationSeconds: c.duration_seconds,
    reminder: c.reminder as ReminderType,
    purpose: c.purpose,
    voiceRecording: c.voice_recording,
  };
}

const owners = ["John Prakash", "Lavanya S", "Admin User"];
const contacts = [
  "Chau Kitzman",
  "Josephine Darakjy",
  "James Venere",
  "John Butt",
  "Donette Foller",
];
const leads = ["Follow up Lead", "Website Lead", "Demo Lead", "Hot Prospect"];
const accounts = [
  "Morlong Associates",
  "Printing Dimensions",
  "Commercial Press",
  "Chemel",
  "Chanay",
];
const deals = ["Q1 Sales Deal", "Renewal Deal", "Enterprise Upgrade"];

const systemDefinedFilters = [
  "Record Action",
  "Related Records Action",
  "Touched Records",
  "Untouched Records",
];

const fieldFilters = [
  "Call Agenda",
  "Call Duration",
  "Call Duration (in seconds)",
  "Call Owner",
  "Call Purpose",
  "Call Result",
  "Call Start Time",
  "Call Type",
  "Caller ID",
];

function getTodayDateInput() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTimeInput() {
  const date = new Date();
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDisplayDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatDisplayTime(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function buildScheduledSubject(name: string) {
  return `Call scheduled with ${name || "Unknown"}`;
}

function buildLoggedSubject(type: CallType, name: string) {
  return `${type} call to ${name || "Unknown"}`;
}

function getDefaultScheduleForm(): CallFormState {
  return {
    callForType: "Contact",
    callForName: "",
    relatedToType: "Account",
    relatedToName: "",
    callType: "Outbound",
    status: "Scheduled",
    startDate: getTodayDateInput(),
    startTime: "13:00",
    owner: "John Prakash",
    subject: "Call scheduled with Unknown",
    reminder: "None",
    purpose: "",
    durationMinutes: "00",
    durationSeconds: "00",
    voiceRecording: "",
  };
}

function getDefaultLogForm(): CallFormState {
  return {
    callForType: "Contact",
    callForName: "",
    relatedToType: "Account",
    relatedToName: "",
    callType: "Outbound",
    status: "Completed",
    startDate: getTodayDateInput(),
    startTime: getCurrentTimeInput(),
    owner: "John Prakash",
    subject: "Outbound call to Unknown",
    reminder: "None",
    purpose: "",
    durationMinutes: "00",
    durationSeconds: "00",
    voiceRecording: "",
  };
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);

  const [searchText, setSearchText] = useState("");
  const [selectedTopView] = useState("All Calls");
  const [selectedFilterItems, setSelectedFilterItems] = useState<string[]>([]);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const createMenuRef = useRef<HTMLDivElement | null>(null);

  const loadCalls = async () => {
    try {
      const data = await apiRequest<BackendCall[]>("/calls/");
      setCalls(data.map(mapBackendCall));
    } catch (e) {
      console.error("Failed to load calls", e);
    }
  };

  useEffect(() => {
    void loadCalls();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      const matchesSearch =
        call.subject.toLowerCase().includes(searchText.toLowerCase()) ||
        call.relatedTo.toLowerCase().includes(searchText.toLowerCase()) ||
        call.owner.toLowerCase().includes(searchText.toLowerCase());

      const matchesSelectedFilters =
        selectedFilterItems.length === 0 ||
        selectedFilterItems.some((item) => {
          if (item === "Touched Records" || item === "Record Action") return true;
          if (item === "Call Type") return call.callType === "Outbound";
          if (item === "Call Owner") return !!call.owner;
          if (item === "Call Purpose") return !!call.purpose;
          if (item === "Call Start Time") return !!call.startTime;
          return true;
        });

      return matchesSearch && matchesSelectedFilters;
    });
  }, [calls, searchText, selectedFilterItems]);

  const toggleFilterItem = (item: string) => {
    setSelectedFilterItems((prev) =>
      prev.includes(item) ? prev.filter((entry) => entry !== item) : [...prev, item]
    );
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredCalls.map((c) => c.id)) : new Set());
  };

  const handleDelete = async () => {
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

  const handleCreateScheduledCall = async (form: CallFormState) => {
    try {
      await apiRequest("/calls/", {
        method: "POST",
        body: JSON.stringify({
          subject: form.subject || buildScheduledSubject(form.callForName),
          call_type: form.callType,
          call_status: "Scheduled",
          call_start_time: `${form.startDate}T${form.startTime}:00`,
          duration_minutes: 0,
          duration_seconds: 0,
          related_to_type: form.relatedToType,
          reminder: form.reminder,
          purpose: form.purpose,
        }),
      });
      await loadCalls();
    } catch (e) {
      console.error("Failed to schedule call", e);
    }
    setShowScheduleModal(false);
  };

  const handleCreateLoggedCall = async (form: CallFormState) => {
    try {
      await apiRequest("/calls/", {
        method: "POST",
        body: JSON.stringify({
          subject: form.subject || buildLoggedSubject(form.callType, form.callForName),
          call_type: form.callType,
          call_status: "Completed",
          call_start_time: `${form.startDate}T${form.startTime}:00`,
          duration_minutes: Number(form.durationMinutes || 0),
          duration_seconds: Number(form.durationSeconds || 0),
          related_to_type: form.relatedToType,
          reminder: form.reminder,
          purpose: form.purpose,
          voice_recording: form.voiceRecording,
        }),
      });
      await loadCalls();
    } catch (e) {
      console.error("Failed to log call", e);
    }
    setShowLogModal(false);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#f7f8fc]">
        <div className="px-6 pt-5">
          <h1 className="text-[30px] font-semibold text-slate-800">Calls</h1>
        </div>

        <div className="px-6 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <button className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                {selectedTopView}
              </button>
              <button className="text-slate-500 hover:text-slate-700">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <ToolbarIconButton icon={<Filter className="h-4 w-4" />} label="Filter" />
              <ToolbarIconButton icon={<ArrowUpDown className="h-4 w-4" />} label="Sort" />
              <IconOnlyButton icon={<List className="h-4 w-4 text-green-600" />} />
              <IconOnlyButton icon={<Grid2x2 className="h-4 w-4" />} />
              <IconOnlyButton icon={<Clock3 className="h-4 w-4" />} />
              <IconOnlyButton icon={<SlidersHorizontal className="h-4 w-4" />} />
              <IconOnlyButton icon={<ChevronDown className="h-4 w-4" />} />
              <IconOnlyButton icon={<RefreshCw className="h-4 w-4" />} />

              <div className="relative ml-2" ref={createMenuRef}>
                <div className="flex overflow-hidden rounded-md shadow-sm">
                  <button
                    onClick={() => setShowCreateMenu((prev) => !prev)}
                    className="bg-[#4f6ef7] px-5 py-2 text-sm font-semibold text-white hover:bg-[#425fe0]"
                  >
                    Create Call
                  </button>
                  <button
                    onClick={() => setShowCreateMenu((prev) => !prev)}
                    className="border-l border-blue-400 bg-[#4f6ef7] px-3 text-white hover:bg-[#425fe0]"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {showCreateMenu && (
                  <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-slate-200 bg-white shadow-lg">
                    <button
                      onClick={() => {
                        setShowCreateMenu(false);
                        setShowScheduleModal(true);
                      }}
                      className="block w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Schedule a call
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateMenu(false);
                        setShowLogModal(true);
                      }}
                      className="block w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Log a call
                    </button>
                  </div>
                )}
              </div>

              <button className="rounded-md border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-3 px-6 py-4">
          <aside className="rounded-md border border-slate-200 bg-white">
            <div className="p-4">
              <h2 className="text-[24px] font-semibold text-slate-800">Filter Calls by</h2>

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-green-500"
                />
              </div>

              <div className="mt-5">
                <button className="flex items-center gap-2 text-left text-[15px] font-semibold text-slate-900">
                  <ChevronDown className="h-4 w-4" />
                  System Defined Filters
                </button>
                <div className="mt-3 space-y-3">
                  {systemDefinedFilters.map((item) => (
                    <label key={item} className="flex items-start gap-3 text-[15px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedFilterItems.includes(item)}
                        onChange={() => toggleFilterItem(item)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-green-600"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <button className="flex items-center gap-2 text-left text-[15px] font-semibold text-slate-900">
                  <ChevronDown className="h-4 w-4" />
                  Filter By Fields
                </button>
                <div className="mt-3 space-y-3">
                  {fieldFilters.map((item) => (
                    <label key={item} className="flex items-start gap-3 text-[15px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedFilterItems.includes(item)}
                        onChange={() => toggleFilterItem(item)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-green-600"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {/* Selection bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-800 px-5 py-2.5">
                <span className="text-sm font-medium text-white">
                  {selectedIds.size} record{selectedIds.size !== 1 ? "s" : ""} selected
                </span>
                <span className="text-slate-500">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  Clear
                </button>
                <div className="ml-2">
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="flex items-center gap-1.5 rounded border border-red-400 px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500 hover:text-white disabled:opacity-60"
                  >
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-slate-200 bg-[#fbfcfe]">
                  <tr className="text-sm text-slate-600">
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredCalls.length && filteredCalls.length > 0}
                        ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredCalls.length; }}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span>Subject</span>
                        <span className="text-xs text-slate-500">All</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </div>
                    </th>
                    <th className="px-4 py-3 font-medium">Call Type</th>
                    <th className="px-4 py-3 font-medium">Call Start Time</th>
                    <th className="px-4 py-3 font-medium">Call Duration</th>
                    <th className="px-4 py-3 font-medium">Related To</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCalls.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-500">
                        No calls found.
                      </td>
                    </tr>
                  ) : (
                    filteredCalls.map((call) => (
                      <tr
                        key={call.id}
                        className={`cursor-pointer border-b border-slate-100 text-[15px] text-slate-700 hover:bg-slate-50 ${selectedIds.has(call.id) ? "bg-green-50" : ""}`}
                        onClick={() => setSelectedCall(call)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(call.id)}
                            onChange={() => toggleSelect(call.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="text-left font-medium text-green-600 hover:underline"
                            onClick={(e) => { e.stopPropagation(); setSelectedCall(call); }}
                          >
                            {call.subject}
                          </button>
                        </td>
                        <td className="px-4 py-3">{call.callType}</td>
                        <td className="px-4 py-3">
                          {formatDisplayDate(call.startDate)} {formatDisplayTime(call.startTime)}
                        </td>
                        <td className="px-4 py-3">
                          {call.durationMinutes !== undefined
                            ? `${String(call.durationMinutes).padStart(2, "0")}m ${String(
                                call.durationSeconds || 0
                              ).padStart(2, "0")}s`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">{call.relatedTo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>Total Records {filteredCalls.length}</span>

              <div className="flex items-center gap-3">
                <button className="text-slate-400 hover:text-slate-600">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-medium text-slate-800">1 to {filteredCalls.length || 1}</span>
                <button className="text-slate-400 hover:text-slate-600">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </div>

        {selectedCall && (
          <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />
        )}

        {showScheduleModal && (
          <ScheduleCallModal
            onClose={() => setShowScheduleModal(false)}
            onSubmit={handleCreateScheduledCall}
          />
        )}

        {showLogModal && (
          <LogCallModal onClose={() => setShowLogModal(false)} onSubmit={handleCreateLoggedCall} />
        )}
      </div>
    </DashboardLayout>
  );
}

function CallDetailModal({ call, onClose }: { call: CallRecord; onClose: () => void }) {
  const statusColors: Record<CallStatus, string> = {
    Scheduled: "bg-green-100 text-green-700",
    Completed: "bg-green-100 text-green-700",
  };
  const typeColors: Record<CallType, string> = {
    Outbound: "bg-orange-100 text-orange-700",
    Inbound: "bg-purple-100 text-purple-700",
  };

  function DetailRow({ label, value }: { label: string; value?: string | null }) {
    return (
      <div className="grid grid-cols-[160px_1fr] gap-2 border-b border-slate-100 py-3 text-sm last:border-0">
        <span className="font-medium text-slate-500">{label}</span>
        <span className="text-slate-800">{value || "—"}</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <Phone className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">{call.subject}</h2>
            </div>
            <div className="mt-2 flex gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[call.status]}`}>
                {call.status}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeColors[call.callType]}`}>
                {call.callType}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-2">
          <DetailRow label="Call For" value={`${call.callForType}: ${call.callForName || "—"}`} />
          <DetailRow label="Related To" value={call.relatedTo} />
          <DetailRow label="Call Start Time" value={`${formatDisplayDate(call.startDate)} ${formatDisplayTime(call.startTime)}`} />
          <DetailRow
            label="Duration"
            value={
              call.durationMinutes !== undefined
                ? `${String(call.durationMinutes).padStart(2, "0")}m ${String(call.durationSeconds || 0).padStart(2, "0")}s`
                : undefined
            }
          />
          <DetailRow label="Owner" value={call.owner} />
          <DetailRow label="Reminder" value={call.reminder} />
          {call.purpose && <DetailRow label="Purpose" value={call.purpose} />}
          {call.voiceRecording && <DetailRow label="Voice Recording" value={call.voiceRecording} />}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleCallModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: CallFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<CallFormState>(getDefaultScheduleForm());

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      subject: buildScheduledSubject(prev.callForName),
    }));
  }, [form.callForName]);

  const availableCallForNames = form.callForType === "Contact" ? contacts : leads;
  const availableRelatedNames =
    form.relatedToType === "Account" ? accounts : form.relatedToType === "Deal" ? deals : [];

  const updateField = <K extends keyof CallFormState>(key: K, value: CallFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <ModalShell title="Schedule a call" onClose={onClose}>
      <div className="space-y-8">
        <section>
          <h3 className="mb-5 text-[28px] font-semibold text-slate-800">Call Information</h3>

          <div className="space-y-5">
            <ModalRow label="Call For">
              <div className="grid grid-cols-[118px_minmax(0,1fr)_44px] overflow-hidden rounded-md border border-slate-300">
                <select
                  value={form.callForType}
                  onChange={(e) => updateField("callForType", e.target.value as CallForType)}
                  className="border-r border-slate-300 px-3 py-3 text-sm outline-none"
                >
                  <option value="Contact">Contact</option>
                  <option value="Lead">Lead</option>
                </select>
                <select
                  value={form.callForName}
                  onChange={(e) => updateField("callForName", e.target.value)}
                  className="px-3 py-3 text-sm outline-none"
                >
                  <option value="">Select</option>
                  {availableCallForNames.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button className="flex items-center justify-center border-l border-slate-300 text-slate-500">
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </ModalRow>

            <ModalRow label="Related To">
              <div className="grid grid-cols-[118px_minmax(0,1fr)_44px] overflow-hidden rounded-md border border-slate-300">
                <select
                  value={form.relatedToType}
                  onChange={(e) => updateField("relatedToType", e.target.value as RelatedToType)}
                  className="border-r border-slate-300 px-3 py-3 text-sm outline-none"
                >
                  <option value="Account">Account</option>
                  <option value="Deal">Deal</option>
                  <option value="None">None</option>
                </select>
                <select
                  value={form.relatedToName}
                  onChange={(e) => updateField("relatedToName", e.target.value)}
                  className="px-3 py-3 text-sm outline-none"
                  disabled={form.relatedToType === "None"}
                >
                  <option value="">Select</option>
                  {availableRelatedNames.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button className="flex items-center justify-center border-l border-slate-300 text-slate-500">
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </ModalRow>

            <ModalRow label="Call Type">
              <div className="grid grid-cols-[minmax(0,1fr)_44px] overflow-hidden rounded-md border border-slate-300">
                <select
                  value={form.callType}
                  onChange={(e) => updateField("callType", e.target.value as CallType)}
                  className="px-3 py-3 text-sm outline-none"
                >
                  <option value="Outbound">Outbound</option>
                  <option value="Inbound">Inbound</option>
                </select>
                <div className="flex items-center justify-center border-l border-slate-300 text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </ModalRow>

            <ModalRow label="Outgoing Call Status">
              <div className="grid grid-cols-[minmax(0,1fr)_44px] overflow-hidden rounded-md border border-slate-300 bg-slate-50">
                <input
                  value="Scheduled"
                  readOnly
                  className="px-3 py-3 text-sm outline-none"
                />
                <div className="flex items-center justify-center border-l border-slate-300 text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </ModalRow>

            <ModalRow label="Call Start Time">
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-300">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  className="border-r border-slate-300 px-3 py-3 text-sm outline-none"
                />
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField("startTime", e.target.value)}
                  className="px-3 py-3 text-sm outline-none"
                />
              </div>
            </ModalRow>

            <ModalRow label="Call Owner">
              <div className="grid grid-cols-[minmax(0,1fr)_44px] overflow-hidden rounded-md border border-slate-300">
                <select
                  value={form.owner}
                  onChange={(e) => updateField("owner", e.target.value)}
                  className="px-3 py-3 text-sm outline-none"
                >
                  {owners.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-center border-l border-slate-300 text-slate-500">
                  <User className="h-4 w-4" />
                </div>
              </div>
            </ModalRow>

            <ModalRow label="Subject">
              <input
                value={form.subject}
                onChange={(e) => updateField("subject", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-green-500"
              />
            </ModalRow>

            <ModalRow label="Reminder">
              <select
                value={form.reminder}
                onChange={(e) => updateField("reminder", e.target.value as ReminderType)}
                className="w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-green-500"
              >
                <option value="None">None</option>
                <option value="At time of call">At time of call</option>
                <option value="5 minutes before">5 minutes before</option>
                <option value="10 minutes before">10 minutes before</option>
                <option value="15 minutes before">15 minutes before</option>
                <option value="30 minutes before">30 minutes before</option>
                <option value="1 hour before">1 hour before</option>
              </select>
            </ModalRow>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-[18px] font-semibold text-slate-800">Purpose Of Outgoing Call</h4>
          <textarea
            rows={5}
            value={form.purpose}
            onChange={(e) => updateField("purpose", e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-green-500"
          />
        </section>
      </div>

      <div className="mt-8 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
        <button
          onClick={onClose}
          className="rounded-md border border-slate-300 bg-slate-100 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit(form)}
          className="rounded-md bg-[#4f6ef7] px-5 py-2 text-sm font-semibold text-white hover:bg-[#425fe0]"
        >
          Schedule
        </button>
      </div>
    </ModalShell>
  );
}

function LogCallModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: CallFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<CallFormState>(getDefaultLogForm());

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      subject: buildLoggedSubject(prev.callType, prev.callForName),
    }));
  }, [form.callForName, form.callType]);

  const availableCallForNames = form.callForType === "Contact" ? contacts : leads;
  const availableRelatedNames =
    form.relatedToType === "Account" ? accounts : form.relatedToType === "Deal" ? deals : [];

  const updateField = <K extends keyof CallFormState>(key: K, value: CallFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <ModalShell title="Log a call" onClose={onClose}>
      <div className="space-y-8">
        <section>
          <h3 className="mb-5 text-[28px] font-semibold text-slate-800">Call Information</h3>

          <div className="space-y-5">
            <ModalRow label="Call For">
              <div className="grid grid-cols-[118px_minmax(0,1fr)_44px] overflow-hidden rounded-md border border-slate-300">
                <select
                  value={form.callForType}
                  onChange={(e) => updateField("callForType", e.target.value as CallForType)}
                  className="border-r border-slate-300 px-3 py-3 text-sm outline-none"
                >
                  <option value="Contact">Contact</option>
                  <option value="Lead">Lead</option>
                </select>
                <select
                  value={form.callForName}
                  onChange={(e) => updateField("callForName", e.target.value)}
                  className="px-3 py-3 text-sm outline-none"
                >
                  <option value="">Select</option>
                  {availableCallForNames.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button className="flex items-center justify-center border-l border-slate-300 text-slate-500">
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </ModalRow>

            <ModalRow label="Related To">
              <div className="grid grid-cols-[118px_minmax(0,1fr)_44px] overflow-hidden rounded-md border border-slate-300">
                <select
                  value={form.relatedToType}
                  onChange={(e) => updateField("relatedToType", e.target.value as RelatedToType)}
                  className="border-r border-slate-300 px-3 py-3 text-sm outline-none"
                >
                  <option value="Account">Account</option>
                  <option value="Deal">Deal</option>
                  <option value="None">None</option>
                </select>
                <select
                  value={form.relatedToName}
                  onChange={(e) => updateField("relatedToName", e.target.value)}
                  className="px-3 py-3 text-sm outline-none"
                  disabled={form.relatedToType === "None"}
                >
                  <option value="">Select</option>
                  {availableRelatedNames.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button className="flex items-center justify-center border-l border-slate-300 text-slate-500">
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </ModalRow>

            <ModalRow label="Call Type">
              <select
                value={form.callType}
                onChange={(e) => updateField("callType", e.target.value as CallType)}
                className="w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-green-500"
              >
                <option value="Outbound">Outbound</option>
                <option value="Inbound">Inbound</option>
              </select>
            </ModalRow>

            <ModalRow label="Outgoing Call Status">
              <div className="grid grid-cols-[minmax(0,1fr)_44px] overflow-hidden rounded-md border border-slate-300 bg-slate-50">
                <input
                  value="Completed"
                  readOnly
                  className="px-3 py-3 text-sm outline-none"
                />
                <div className="flex items-center justify-center border-l border-slate-300 text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </ModalRow>

            <ModalRow label="Call Start Time">
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-300">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  className="border-r border-slate-300 px-3 py-3 text-sm outline-none"
                />
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField("startTime", e.target.value)}
                  className="px-3 py-3 text-sm outline-none"
                />
              </div>
            </ModalRow>

            <ModalRow label="Call Duration">
              <div className="grid grid-cols-[80px_auto_80px_auto] items-center overflow-hidden rounded-md border border-slate-300">
                <input
                  type="number"
                  min="0"
                  value={form.durationMinutes}
                  onChange={(e) => updateField("durationMinutes", e.target.value)}
                  className="px-3 py-3 text-sm outline-none"
                />
                <span className="border-r border-slate-300 pr-3 text-sm text-slate-600">minutes</span>
                <input
                  type="number"
                  min="0"
                  value={form.durationSeconds}
                  onChange={(e) => updateField("durationSeconds", e.target.value)}
                  className="px-3 py-3 text-sm outline-none"
                />
                <span className="pr-3 text-sm text-slate-600">seconds</span>
              </div>
            </ModalRow>

            <ModalRow label="Subject">
              <input
                value={form.subject}
                onChange={(e) => updateField("subject", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-green-500"
              />
            </ModalRow>

            <ModalRow label="Voice Recording">
              <input
                value={form.voiceRecording}
                onChange={(e) => updateField("voiceRecording", e.target.value)}
                placeholder=""
                className="w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-green-500"
              />
            </ModalRow>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-[18px] font-semibold text-slate-800">Purpose Of Outgoing Call</h4>
          <textarea
            rows={5}
            value={form.purpose}
            onChange={(e) => updateField("purpose", e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-green-500"
          />
        </section>
      </div>

      <div className="mt-8 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
        <button
          onClick={onClose}
          className="rounded-md border border-slate-300 bg-slate-100 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit(form)}
          className="rounded-md bg-[#4f6ef7] px-5 py-2 text-sm font-semibold text-white hover:bg-[#425fe0]"
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[34px] font-semibold text-slate-900">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function ModalRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] items-center gap-5">
      <label className="text-right text-[16px] font-medium text-slate-600">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function ToolbarIconButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
      {icon}
      <span>{label}</span>
    </button>
  );
}

function IconOnlyButton({ icon }: { icon: React.ReactNode }) {
  return (
    <button className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
      {icon}
    </button>
  );
}
