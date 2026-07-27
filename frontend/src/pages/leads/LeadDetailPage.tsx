import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { NoteModal } from "../../components/crm/CRMActionModals";
import { leadModuleConfig } from "../../components/modules/leads/leadsMockData";
import { loadLeadLinkedData } from "../../lib/api/linkedRecordsApi";
import { addLeadNote, getLeadById, getLeadNotes, getLeadTimeline } from "../../lib/api/leadsApi";
import type { LeadRecord, Note, TimelineItem } from "../../lib/shared/crmTypes";
import { buildFlowTimeline } from "../../lib/shared/timelineFlow";
import CRMModuleDetailPage from "../crm/CRMModuleDetailPage";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-blue-500";

function SendEmailModal({
  leadEmail,
  leadId,
  onClose,
  onSent,
}: {
  leadEmail: string;
  leadId: string;
  onClose: () => void;
  onSent?: () => void | Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }
    if (!body.trim()) {
      setError("Body is required");
      return;
    }
    try {
      setLoading(true);
      await apiRequest(`/leads/${leadId}/send-email/`, {
        method: "POST",
        body: JSON.stringify({ subject, body }),
      });
      await onSent?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Send Email" onClose={onClose}>
      <div className="px-6 py-4">
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <Field label="To">
          <input className={inputCls} value={leadEmail} readOnly />
        </Field>
        <Field label="Subject">
          <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
        </Field>
        <Field label="Body">
          <textarea className={inputCls} rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Email body" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-3">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={loading} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </Modal>
  );
}

function ConvertModal({
  leadId,
  onClose,
  onConverted,
}: {
  leadId: string;
  onClose: () => void;
  onConverted: (result: { account_id: number; contact_id: number; deal_id?: number | null }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const result = await apiRequest<{ account_id: number; contact_id: number; deal_id?: number | null }>(
        `/leads/${leadId}/convert/`,
        {
          method: "POST",
          body: JSON.stringify({
            create_deal: false,
          }),
        }
      );
      onConverted(result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to convert lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Convert Lead" onClose={onClose}>
      <div className="px-6 py-4">
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <p className="mb-4 text-sm text-slate-600">
          Converting this lead will create an <strong>Account</strong> and a <strong>Contact</strong>.
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-3">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={loading} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? "Converting..." : "Convert"}
        </button>
      </div>
    </Modal>
  );
}

function AddTagsModal({
  leadId,
  existingTags,
  onClose,
  onSaved,
}: {
  leadId: string;
  existingTags: string[];
  onClose: () => void;
  onSaved: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed) && !existingTags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  const handleSubmit = async () => {
    const toAdd = [...tags];
    if (input.trim()) toAdd.push(input.trim());
    if (toAdd.length === 0) {
      setError("Add at least one tag");
      return;
    }
    try {
      setLoading(true);
      const res = await apiRequest<{ tags: string[] }>(`/leads/${leadId}/add-tags/`, {
        method: "POST",
        body: JSON.stringify({ tags: toAdd }),
      });
      onSaved(res.tags);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add tags");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Tags" onClose={onClose}>
      <div className="px-6 py-4">
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {existingTags.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-slate-500">Existing tags</p>
            <div className="flex flex-wrap gap-1">
              {existingTags.map((t) => (
                <span key={t} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{t}</span>
              ))}
            </div>
          </div>
        )}
        <Field label="New Tags (press Enter or comma to add)">
          <input
            className={inputCls}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. hot-lead, enterprise"
          />
        </Field>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs text-green-700">
                {t}
                <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-3">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={loading} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? "Saving..." : "Save Tags"}
        </button>
      </div>
    </Modal>
  );
}

function DeleteModal({ leadId, onClose, onDeleted }: { leadId: string; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    try {
      setLoading(true);
      await apiRequest(`/leads/${leadId}/`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete lead");
      setLoading(false);
    }
  };

  return (
    <Modal title="Delete Lead" onClose={onClose}>
      <div className="px-6 py-4">
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <p className="text-sm text-slate-600">Are you sure you want to delete this lead? This action cannot be undone.</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-3">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={handleDelete} disabled={loading} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
          {loading ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

type ActiveModal = "send-email" | "convert" | "add-tags" | "delete" | "note" | null;

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadRecord | null>((location.state as { record?: LeadRecord } | null)?.record ?? null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [linkedData, setLinkedData] = useState<any | null>(null);
  const [loading, setLoading] = useState(!((location.state as { record?: LeadRecord } | null)?.record));
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [convertedLinks, setConvertedLinks] = useState<{ account_id: number; contact_id: number; deal_id?: number | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const leadData = await getLeadById(id);
        if (!leadData) {
          setLead(null);
          setLinkedData(null);
          setLoading(false);
          return;
        }
        setLead(leadData);
        setLoading(false);

        const [notesData, timelineData, related] = await Promise.all([
          getLeadNotes(id).catch(() => []),
          getLeadTimeline(id).catch(() => []),
          loadLeadLinkedData(leadData, { forceRefresh: true }).catch(() => null),
        ]);
        setNotes(notesData);
        setTimeline(timelineData);
        setLinkedData(related);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lead");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const handleAction = async (action: string) => {
    if (!id) return;
    switch (action) {
      case "Edit":
        navigate(`/leads/${id}/edit`);
        break;
      case "Send Email":
        setActiveModal("send-email");
        break;
      case "Convert":
        setActiveModal("convert");
        break;
      case "Add Tags":
        setActiveModal("add-tags");
        break;
      case "Delete":
        setActiveModal("delete");
        break;
      case "Clone":
        try {
          const res = await apiRequest<{ lead_id: number }>(`/leads/${id}/clone/`, { method: "POST" });
          navigate(`/leads/${res.lead_id}`);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Failed to clone lead");
        }
        break;
      default:
        break;
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading lead...</div>;
  if (error || !lead) return <div className="p-6 text-sm text-rose-600">{error ?? "Lead not found."}</div>;

  const leadEmail = lead.email ?? "";
  const leadTags = lead.tags ?? [];

  const handleSaveNote = async (note: string) => {
    if (!id) {
      throw new Error("Lead not found.");
    }
    await addLeadNote(id, note);
    const refreshedNotes = await getLeadNotes(id);
    setNotes(refreshedNotes);
  };

  const refreshLeadRelatedData = async () => {
    if (!id || !lead) return;
    const [timelineData, related] = await Promise.all([
      getLeadTimeline(id).catch(() => []),
      loadLeadLinkedData(lead, { forceRefresh: true }).catch(() => null),
    ]);
    setTimeline(timelineData);
    setLinkedData(related);
  };

  return (
    <>
      <CRMModuleDetailPage
        config={leadModuleConfig}
        rows={[lead]}
        sectionActions={{
          "notes-section": (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveModal("note")}
                className="rounded-md border border-blue-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
              >
                Add Note
              </button>
              <button
                type="button"
                onClick={() => navigate(`/leads/import-notes?leadId=${id}`)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Import Notes
              </button>
            </div>
          ),
        }}
        onAction={handleAction}
        onNavigate={(type, navId) => navigate(`/${type}s/${navId}`)}
        data={{
          notes,
          deals: linkedData?.deals || [],
          openActivities: linkedData?.openActivities || [],
          closedActivities: linkedData?.closedActivities || [],
          meetings: linkedData?.meetings || [],
          products: linkedData?.products || [],
          emails: linkedData?.emails || [],
          attachments: linkedData?.attachments || [],
          connectedRecords: linkedData?.connectedRecords || [],
          cases: linkedData?.cases || [],
          solutions: linkedData?.solutions || [],
          contacts: linkedData?.contacts || [],
          accounts: linkedData?.accounts || [],
          quotes: linkedData?.quotes || [],
          salesOrders: linkedData?.salesOrders || [],
          purchaseOrders: linkedData?.purchaseOrders || [],
          invoices: linkedData?.invoices || [],
            timeline: buildFlowTimeline({ existing: [...timeline, ...(linkedData?.timeline || [])] }),
          }}
        />

      {convertedLinks && (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-green-200 bg-green-50 p-4 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-green-800">Lead converted successfully!</p>
              <div className="mt-2 space-y-1 text-sm text-green-700">
                <p>
                  Account:{" "}
                  <button type="button" className="font-medium underline hover:text-green-900" onClick={() => navigate(`/accounts/${convertedLinks.account_id}`)}>
                    View Account
                  </button>
                </p>
                <p>
                  Contact:{" "}
                  <button type="button" className="font-medium underline hover:text-green-900" onClick={() => navigate(`/contacts/${convertedLinks.contact_id}`)}>
                    View Contact
                  </button>
                </p>
                {convertedLinks.deal_id && (
                  <p>
                    Deal:{" "}
                    <button type="button" className="font-medium underline hover:text-green-900" onClick={() => navigate(`/deals/${convertedLinks.deal_id}`)}>
                      View Deal
                    </button>
                  </p>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setConvertedLinks(null)} className="text-green-600 hover:text-green-800">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {activeModal === "send-email" && (
        <SendEmailModal
          leadEmail={leadEmail}
          leadId={id!}
          onClose={() => setActiveModal(null)}
          onSent={refreshLeadRelatedData}
        />
      )}

      {activeModal === "convert" && (
        <ConvertModal
          leadId={id!}
          onClose={() => setActiveModal(null)}
          onConverted={(result) => {
            setConvertedLinks(result);
            void getLeadById(id!).then((updated) => {
              if (updated) setLead(updated);
            });
          }}
        />
      )}

      {activeModal === "add-tags" && (
        <AddTagsModal
          leadId={id!}
          existingTags={leadTags}
          onClose={() => setActiveModal(null)}
          onSaved={(newTags) => setLead((prev) => (prev ? { ...prev, tags: newTags } : prev))}
        />
      )}

      {activeModal === "delete" && (
        <DeleteModal leadId={id!} onClose={() => setActiveModal(null)} onDeleted={() => navigate("/leads")} />
      )}

      <NoteModal
        open={activeModal === "note"}
        onClose={() => setActiveModal(null)}
        recordName={lead.leadName}
        onSave={handleSaveNote}
      />
    </>
  );
}
