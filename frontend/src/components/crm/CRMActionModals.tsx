import { Lock, Paperclip, Phone, CalendarCheck, CalendarDays, Activity, X } from "lucide-react";
import { useEffect, useState } from "react";
import CRMModalBase from "./CRMModalBase";

// ── Shared call helpers ────────────────────────────────────────────────────

type CallType = "Outbound" | "Inbound";
type ReminderType =
  | "None"
  | "At time of call"
  | "5 minutes before"
  | "10 minutes before"
  | "15 minutes before"
  | "30 minutes before"
  | "1 hour before";

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCurrentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function FullCallModalShell({
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
      <div className="flex max-h-[92vh] w-full max-w-[820px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function CallFormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] items-center gap-4">
      <label className="text-right text-sm font-medium text-slate-600">{label}</label>
      <div>{children}</div>
    </div>
  );
}

const fieldCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-blue-500";

type BaseModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SendEmailModal({
  open,
  onClose,
  toEmail = "",
  recordName = "",
  onSend,
}: BaseModalProps & {
  toEmail?: string;
  recordName?: string;
  onSend?: (payload: { to: string; subject: string; body: string; from_email?: string }) => Promise<void>;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(toEmail);
  const [subject, setSubject] = useState(recordName ? `Re: ${recordName}` : "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTo(toEmail);
    setSubject(recordName ? `Re: ${recordName}` : "");
    setBody("");
    setError(null);
  }, [open, toEmail, recordName]);

  const handleSend = async () => {
    if (!to.trim()) {
      setError("Please enter a recipient email.");
      return;
    }
    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    try {
      setSending(true);
      setError(null);

      if (onSend) {
        await onSend({ to: to.trim(), subject: subject.trim(), body: body.trim(), from_email: from.trim() || undefined });
      } else {
        throw new Error("Email sending is not configured for this screen.");
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title="Email Composer"
      maxWidthClassName="max-w-3xl"
      footer={
        <>
          <button onClick={onClose} disabled={sending} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button onClick={() => void handleSend()} disabled={sending} className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50">
            {sending ? "Sending..." : "Send"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm"><span>From</span><input value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="grid gap-1 text-sm"><span>To</span><input value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
      </div>
      <label className="mt-3 grid gap-1 text-sm"><span>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
      <div className="mt-3 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
          <button className="rounded border border-slate-200 px-2 py-1 font-bold">B</button>
          <button className="rounded border border-slate-200 px-2 py-1 italic">I</button>
          <button className="rounded border border-slate-200 px-2 py-1 underline">U</button>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="w-full resize-none rounded-b-lg px-3 py-2 text-sm outline-none" />
      </div>
      <button className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"><Paperclip size={14} />Attach Files</button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </CRMModalBase>
  );
}

export function AddTagsModal({
  open,
  onClose,
  recordName = "",
}: BaseModalProps & { recordName?: string }) {
  const [value, setValue] = useState("");
  const tags = ["Hot Lead", "Follow-Up", "Priority", "Enterprise", "Decision Maker"];

  return (
    <CRMModalBase
      open={open}
      title={recordName ? `Add Tags - ${recordName}` : "Add Tags"}
      maxWidthClassName="max-w-lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Cancel</button>
          <button
            onClick={() => {
              if (!value.trim()) return;
              onClose();
            }}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white"
          >
            Add
          </button>
        </>
      }
    >
      <label className="grid gap-1 text-sm">
        <span>Tag</span>
        <input value={value} onChange={(e) => setValue(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Type a tag or select below" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button key={tag} type="button" onClick={() => setValue(tag)} className={`rounded-full border px-3 py-1 text-xs transition ${value === tag ? "border-green-500 bg-green-50 text-green-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{tag}</button>
        ))}
      </div>
    </CRMModalBase>
  );
}

export function NoteModal({
  open,
  onClose,
  recordName = "",
  onSave,
}: BaseModalProps & { recordName?: string; onSave?: (note: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!note.trim()) {
      setError("Please enter a note.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave?.(note.trim());
      setTitle("");
      setNote("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title={recordName ? `Notes - ${recordName}` : "Notes"}
      maxWidthClassName="max-w-xl"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" rows={5} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </CRMModalBase>
  );
}

export function TaskModal({
  open,
  onClose,
  recordName = "",
  onSave,
}: BaseModalProps & {
  recordName?: string;
  onSave?: (payload: { subject: string; description?: string }) => Promise<void>;
}) {
  const [subject, setSubject] = useState(recordName ? `Follow up with ${recordName}` : "");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave?.({ subject: subject.trim(), description: description.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title="Create Task"
      maxWidthClassName="max-w-xl"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving} className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </CRMModalBase>
  );
}

export function MeetingModal({
  open,
  onClose,
  recordName = "",
  onSave,
}: BaseModalProps & {
  recordName?: string;
  onSave?: (payload: { meeting_subject: string; agenda?: string }) => Promise<void>;
}) {
  const [meetingSubject, setMeetingSubject] = useState(recordName ? `Meeting with ${recordName}` : "");
  const [agenda, setAgenda] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!meetingSubject.trim()) {
      setError("Please enter a meeting title.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave?.({ meeting_subject: meetingSubject.trim(), agenda: agenda.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule meeting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title="Create Meeting"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving} className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <input placeholder="Meeting Subject" value={meetingSubject} onChange={(e) => setMeetingSubject(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea rows={3} placeholder="Agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </CRMModalBase>
  );
}

type FullCallPayload = {
  call_summary: string;
  call_outcome?: string;
  call_type?: string;
  call_start_time?: string;
  reminder?: string;
  duration_minutes?: number;
  duration_seconds?: number;
  voice_recording?: string;
};

export function ScheduleCallModal({
  open,
  onClose,
  recordName = "",
  onSave,
}: BaseModalProps & {
  recordName?: string;
  onSave?: (payload: FullCallPayload) => Promise<void>;
}) {
  const [callType, setCallType] = useState<CallType>("Outbound");
  const [startDate, setStartDate] = useState(getTodayDate());
  const [startTime, setStartTime] = useState("13:00");
  const [subject, setSubject] = useState(recordName ? `Call scheduled with ${recordName}` : "");
  const [reminder, setReminder] = useState<ReminderType>("None");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSubject(recordName ? `Call scheduled with ${recordName}` : "");
      setCallType("Outbound");
      setStartDate(getTodayDate());
      setStartTime("13:00");
      setReminder("None");
      setPurpose("");
      setError(null);
    }
  }, [open, recordName]);

  if (!open) return null;

  const handleSave = async () => {
    if (!subject.trim()) { setError("Subject is required."); return; }
    try {
      setSaving(true);
      setError(null);
      await onSave?.({
        call_summary: subject.trim(),
        call_outcome: purpose.trim(),
        call_type: callType,
        call_start_time: `${startDate}T${startTime}:00`,
        reminder,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule call.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FullCallModalShell title="Schedule a Call" onClose={onClose}>
      <div className="space-y-8">
        <section>
          <h3 className="mb-5 text-xl font-semibold text-slate-800">Call Information</h3>
          <div className="space-y-4">
            <CallFormRow label="Call For">
              <input value={recordName || "—"} readOnly className={`${fieldCls} bg-slate-50`} />
            </CallFormRow>
            <CallFormRow label="Call Type">
              <div className="flex overflow-hidden rounded-md border border-slate-300">
                <select value={callType} onChange={(e) => setCallType(e.target.value as CallType)} className="flex-1 px-3 py-2 text-sm outline-none">
                  <option value="Outbound">Outbound</option>
                  <option value="Inbound">Inbound</option>
                </select>
                <div className="flex items-center border-l border-slate-300 px-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </CallFormRow>
            <CallFormRow label="Outgoing Call Status">
              <div className="flex overflow-hidden rounded-md border border-slate-300 bg-slate-50">
                <input value="Scheduled" readOnly className="flex-1 px-3 py-2 text-sm outline-none" />
                <div className="flex items-center border-l border-slate-300 px-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </CallFormRow>
            <CallFormRow label="Call Start Time">
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-300">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-r border-slate-300 px-3 py-2 text-sm outline-none" />
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="px-3 py-2 text-sm outline-none" />
              </div>
            </CallFormRow>
            <CallFormRow label="Subject">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldCls} />
            </CallFormRow>
            <CallFormRow label="Reminder">
              <select value={reminder} onChange={(e) => setReminder(e.target.value as ReminderType)} className={fieldCls}>
                <option>None</option>
                <option>At time of call</option>
                <option>5 minutes before</option>
                <option>10 minutes before</option>
                <option>15 minutes before</option>
                <option>30 minutes before</option>
                <option>1 hour before</option>
              </select>
            </CallFormRow>
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-base font-semibold text-slate-800">Purpose of Outgoing Call</h4>
          <textarea rows={4} value={purpose} onChange={(e) => setPurpose(e.target.value)} className={fieldCls} />
        </section>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button onClick={onClose} disabled={saving} className="rounded-md border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
        <button onClick={() => void handleSave()} disabled={saving} className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Scheduling..." : "Schedule"}
        </button>
      </div>
    </FullCallModalShell>
  );
}

export function LogCallModal({
  open,
  onClose,
  recordName = "",
  onSave,
}: BaseModalProps & {
  recordName?: string;
  onSave?: (payload: FullCallPayload) => Promise<void>;
}) {
  const [callType, setCallType] = useState<CallType>("Outbound");
  const [startDate, setStartDate] = useState(getTodayDate());
  const [startTime, setStartTime] = useState(getCurrentTime());
  const [durationMinutes, setDurationMinutes] = useState("0");
  const [durationSeconds, setDurationSeconds] = useState("0");
  const [subject, setSubject] = useState(recordName ? `Outbound call to ${recordName}` : "");
  const [voiceRecording, setVoiceRecording] = useState("");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSubject(recordName ? `Outbound call to ${recordName}` : "");
      setCallType("Outbound");
      setStartDate(getTodayDate());
      setStartTime(getCurrentTime());
      setDurationMinutes("0");
      setDurationSeconds("0");
      setVoiceRecording("");
      setPurpose("");
      setError(null);
    }
  }, [open, recordName]);

  useEffect(() => {
    setSubject(`${callType} call to ${recordName || "Unknown"}`);
  }, [callType, recordName]);

  if (!open) return null;

  const handleSave = async () => {
    if (!subject.trim()) { setError("Subject is required."); return; }
    try {
      setSaving(true);
      setError(null);
      await onSave?.({
        call_summary: subject.trim(),
        call_outcome: purpose.trim(),
        call_type: callType,
        call_start_time: `${startDate}T${startTime}:00`,
        duration_minutes: Number(durationMinutes) || 0,
        duration_seconds: Number(durationSeconds) || 0,
        voice_recording: voiceRecording.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log call.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FullCallModalShell title="Log a Call" onClose={onClose}>
      <div className="space-y-8">
        <section>
          <h3 className="mb-5 text-xl font-semibold text-slate-800">Call Information</h3>
          <div className="space-y-4">
            <CallFormRow label="Call For">
              <input value={recordName || "—"} readOnly className={`${fieldCls} bg-slate-50`} />
            </CallFormRow>
            <CallFormRow label="Call Type">
              <select value={callType} onChange={(e) => setCallType(e.target.value as CallType)} className={fieldCls}>
                <option value="Outbound">Outbound</option>
                <option value="Inbound">Inbound</option>
              </select>
            </CallFormRow>
            <CallFormRow label="Outgoing Call Status">
              <div className="flex overflow-hidden rounded-md border border-slate-300 bg-slate-50">
                <input value="Completed" readOnly className="flex-1 px-3 py-2 text-sm outline-none" />
                <div className="flex items-center border-l border-slate-300 px-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </CallFormRow>
            <CallFormRow label="Call Start Time">
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-300">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-r border-slate-300 px-3 py-2 text-sm outline-none" />
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="px-3 py-2 text-sm outline-none" />
              </div>
            </CallFormRow>
            <CallFormRow label="Call Duration">
              <div className="flex items-center gap-2">
                <input type="number" min="0" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500" />
                <span className="text-sm text-slate-500">minutes</span>
                <input type="number" min="0" max="59" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500" />
                <span className="text-sm text-slate-500">seconds</span>
              </div>
            </CallFormRow>
            <CallFormRow label="Subject">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldCls} />
            </CallFormRow>
            <CallFormRow label="Voice Recording">
              <input value={voiceRecording} onChange={(e) => setVoiceRecording(e.target.value)} placeholder="File path or URL" className={fieldCls} />
            </CallFormRow>
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-base font-semibold text-slate-800">Purpose of Outgoing Call</h4>
          <textarea rows={4} value={purpose} onChange={(e) => setPurpose(e.target.value)} className={fieldCls} />
        </section>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button onClick={onClose} disabled={saving} className="rounded-md border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
        <button onClick={() => void handleSave()} disabled={saving} className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </FullCallModalShell>
  );
}

export function DeleteModal({
  open,
  onClose,
  onConfirm,
  recordName = "this record",
}: BaseModalProps & { onConfirm: () => Promise<void>; recordName?: string }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title="Delete Record"
      maxWidthClassName="max-w-sm"
      footer={
        <>
          <button onClick={onClose} disabled={deleting} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        Are you sure you want to delete <span className="font-semibold">{recordName}</span>? This action cannot be undone.
      </p>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </CRMModalBase>
  );
}

export function ConvertLeadModal({
  open,
  onClose,
  leadName = "",
  onConvert,
}: BaseModalProps & {
  leadName?: string;
  onConvert?: (payload: { create_deal: boolean; deal_name?: string }) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    try {
      setSaving(true);
      setError(null);
      await onConvert?.({
        create_deal: false,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title={leadName ? `Convert Lead - ${leadName}` : "Convert Lead"}
      maxWidthClassName="max-w-xl"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button onClick={() => void handleConvert()} disabled={saving} className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Converting..." : "Convert"}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2"><input type="checkbox" checked readOnly />Create New Account</label>
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2"><input type="checkbox" checked readOnly />Create New Contact</label>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </CRMModalBase>
  );
}

// ── Activity Detail Modal ────────────────────────────────────────────────────

type ActivityType = "call" | "task" | "meeting" | "other";

const ACTIVITY_ICON: Record<ActivityType, React.ReactNode> = {
  call:    <Phone className="h-5 w-5" />,
  task:    <CalendarCheck className="h-5 w-5" />,
  meeting: <CalendarDays className="h-5 w-5" />,
  other:   <Activity className="h-5 w-5" />,
};

const ACTIVITY_COLOR: Record<ActivityType, { bg: string; text: string; badge: string }> = {
  call:    { bg: "bg-orange-50",  text: "text-orange-700", badge: "bg-orange-100 border-orange-200 text-orange-700" },
  task:    { bg: "bg-green-50",    text: "text-green-700",   badge: "bg-green-100 border-blue-200 text-green-700" },
  meeting: { bg: "bg-purple-50",  text: "text-purple-700", badge: "bg-purple-100 border-purple-200 text-purple-700" },
  other:   { bg: "bg-slate-50",   text: "text-slate-700",  badge: "bg-slate-100 border-slate-200 text-slate-700" },
};

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: "Call", task: "Task", meeting: "Meeting", other: "Activity",
};

export function ActivityDetailModal({
  open,
  onClose,
  activity,
  recordName,
  onViewLead,
}: BaseModalProps & {
  activity?: { date: string; type: ActivityType; action: string; description?: string } | null;
  recordName?: string;
  onViewLead?: () => void;
}) {
  if (!open || !activity) return null;

  const type = activity.type ?? "other";
  const colors = ACTIVITY_COLOR[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className={`flex items-center justify-between rounded-t-xl px-5 py-4 ${colors.bg}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full border ${colors.badge}`}>
              {ACTIVITY_ICON[type]}
            </span>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
                {ACTIVITY_LABEL[type]}
              </p>
              <p className="text-base font-semibold text-slate-900">{activity.action}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-500">Date</span>
            <span className="font-semibold text-slate-800">{activity.date}</span>
          </div>
          {recordName && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-500">Related To</span>
              <span className="font-semibold text-slate-800">{recordName}</span>
            </div>
          )}
          {activity.description && (
            <div className="text-sm">
              <span className="font-medium text-slate-500">Description</span>
              <p className="mt-1 rounded-md bg-slate-50 px-3 py-2 text-slate-700">{activity.description}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          {onViewLead && (
            <button
              type="button"
              onClick={() => { onViewLead(); onClose(); }}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              View Lead
            </button>
          )}
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

// ── Mass Delete Modal ────────────────────────────────────────────────────────

export function MassDeleteModal({
  open,
  onClose,
  count,
  onConfirm,
}: BaseModalProps & { count: number; onConfirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setDeleting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mass delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title="Mass Delete"
      maxWidthClassName="max-w-sm"
      footer={
        <>
          <button onClick={onClose} disabled={deleting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => void handleConfirm()} disabled={deleting} className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50">
            {deleting ? "Deleting..." : "Delete All"}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        Are you sure you want to delete all <span className="font-semibold">{count} record{count !== 1 ? "s" : ""}</span>? This action cannot be undone.
      </p>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </CRMModalBase>
  );
}

// ── Mass Update Modal ────────────────────────────────────────────────────────

export function MassUpdateModal({
  open,
  onClose,
  count,
  module,
  onConfirm,
}: BaseModalProps & {
  count: number;
  module: string;
  onConfirm: (updates: Record<string, string>) => Promise<void>;
}) {
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusOptions: Record<string, string[]> = {
    leads: ["New", "Contacted", "Qualified", "Lost", "Converted"],
    deals: ["Qualification", "Needs Analysis", "Value Proposition", "Identify Decision Makers", "Proposal/Price Quote", "Negotiation/Review", "Closed Won", "Closed Lost"],
    contacts: [],
    accounts: ["Analyst", "Competitor", "Customer", "Distributor", "Integrator", "Investor", "Partner", "Press", "Prospect", "Reseller", "Other"],
  };

  const options = statusOptions[module] ?? [];
  const statusLabel = module === "leads" ? "Lead Status" : module === "deals" ? "Stage" : module === "accounts" ? "Account Type" : "Status";

  useEffect(() => {
    if (open) { setOwner(""); setStatus(""); setError(null); }
  }, [open]);

  const handleConfirm = async () => {
    const updates: Record<string, string> = {};
    if (owner.trim()) updates.owner = owner.trim();
    if (status) {
      if (module === "leads") updates.lead_status = status;
      else if (module === "deals") updates.stage = status;
      else if (module === "accounts") updates.account_type = status;
    }
    if (Object.keys(updates).length === 0) {
      setError("Please fill in at least one field to update.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onConfirm(updates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mass update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title="Mass Update"
      maxWidthClassName="max-w-md"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => void handleConfirm()} disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Updating..." : `Update ${count} Record${count !== 1 ? "s" : ""}`}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-500">
        The following changes will be applied to all <span className="font-semibold">{count} record{count !== 1 ? "s" : ""}</span> in the table.
      </p>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Owner</label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Leave blank to keep existing"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
          />
        </div>
        {options.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{statusLabel}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
            >
              <option value="">— Leave unchanged —</option>
              {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </CRMModalBase>
  );
}

// ── Mass Convert Modal ───────────────────────────────────────────────────────

export function MassConvertModal({
  open,
  onClose,
  count,
  onConfirm,
}: BaseModalProps & { count: number; onConfirm: () => Promise<void> }) {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setConverting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mass convert failed.");
    } finally {
      setConverting(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title="Mass Convert Leads"
      maxWidthClassName="max-w-sm"
      footer={
        <>
          <button onClick={onClose} disabled={converting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => void handleConfirm()} disabled={converting} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {converting ? "Converting..." : "Convert All"}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        Convert all <span className="font-semibold">{count} lead{count !== 1 ? "s" : ""}</span> into Accounts and Contacts? Each lead will also create a new Deal.
      </p>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </CRMModalBase>
  );
}
