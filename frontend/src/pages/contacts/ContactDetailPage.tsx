import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Building2, ExternalLink, User } from "lucide-react";
import { contactModuleConfig } from "../../components/modules/contacts/contactsMockData";
import { getContactById, getContactDeals, getContactNotes } from "../../lib/api/contactsApi";
import { loadContactLinkedData } from "../../lib/api/linkedRecordsApi";
import type { ContactRecord, Deal, Note } from "../../lib/shared/crmTypes";
import CRMModuleDetailPage from "../crm/CRMModuleDetailPage";
import { apiRequest } from "../../api/client";

const DEAL_STAGES = ["Qualification", "Needs Analysis", "Value Proposition", "Identify Decision Makers", "Perception Analysis", "Proposal/Price Quote", "Negotiation/Review", "Closed Won", "Closed Lost"];

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [contact, setContact] = useState<ContactRecord | null>((location.state as { record?: ContactRecord } | null)?.record ?? null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [linkedData, setLinkedData] = useState<any | null>(null);
  const [loading, setLoading] = useState(!((location.state as { record?: ContactRecord } | null)?.record));
  const [error, setError] = useState<string | null>(null);

  const [convertModal, setConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState({ dealName: "", stage: "Qualification", amount: "", closingDate: "" });
  const [convertError, setConvertError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const contactData = await getContactById(id);

        if (!contactData) {
          setContact(null);
          setLinkedData(null);
          setLoading(false);
          return;
        }

        setContact(contactData);
        setLoading(false);

        const [notesData, dealsData] = await Promise.all([
          getContactNotes(id).catch(() => []),
          getContactDeals(id).catch(() => []),
        ]);

        setNotes(notesData);
        setDeals(dealsData);

        const related = await loadContactLinkedData(id, { forceRefresh: true }).catch(() => null);
        setLinkedData({
          ...related,
          deals: related?.deals?.length ? related.deals : dealsData,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load contact");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  const openConvertModal = () => {
    if (!contact) return;
    const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || "New Deal";
    setConvertForm({ dealName: `Deal with ${fullName}`, stage: "Qualification", amount: "", closingDate: "" });
    setConvertError(null);
    setConvertModal(true);
  };

  const handleConvertToDeal = async () => {
    if (!convertForm.dealName.trim()) { setConvertError("Deal name is required."); return; }
    setConverting(true);
    setConvertError(null);
    try {
      const body: Record<string, unknown> = {
        deal_name: convertForm.dealName.trim(),
        stage: convertForm.stage,
        contact: Number(id),
      };
      if (convertForm.amount) body.amount = convertForm.amount;
      if (convertForm.closingDate) body.closing_date = convertForm.closingDate;
      if (contact?.accountId) body.account = Number(contact.accountId);
      const deal = await apiRequest<{ id: number | string }>("/deals", { method: "POST", body: JSON.stringify(body) });
      setConvertModal(false);
      navigate(`/deals/${deal.id}`);
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : "Failed to create deal.");
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading contact...</div>;
  if (error || !contact) return <div className="p-6 text-sm text-rose-600">{error ?? "Contact not found."}</div>;

  return (
    <>
      {(contact.accountId || contact.createdFromLeadId) && (
        <div className="mx-4 mt-4 flex flex-wrap gap-2">
          {contact.accountId && (
            <button
              type="button"
              onClick={() => navigate(`/accounts/${contact.accountId}`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
            >
              <Building2 className="h-4 w-4" />
              Account: {contact.accountName || "View Account"}
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </button>
          )}
          {contact.createdFromLeadId && (
            <button
              type="button"
              onClick={() => navigate(`/leads/${contact.createdFromLeadId}`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
            >
              <User className="h-4 w-4" />
              Converted from Lead: {contact.createdFromLeadName || "View Lead"}
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </button>
          )}
        </div>
      )}

      <CRMModuleDetailPage
        config={contactModuleConfig}
        rows={[contact]}
        data={{
          notes,
          deals: linkedData?.deals || deals,
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
          accounts:
            linkedData?.accounts ||
            (contact.accountName ? [{ id: contact.accountId || "", name: contact.accountName }] : []),
          quotes: linkedData?.quotes || [],
          salesOrders: linkedData?.salesOrders || [],
          purchaseOrders: linkedData?.purchaseOrders || [],
          invoices: linkedData?.invoices || [],
          timeline: linkedData?.timeline || [],
        }}
        onAction={(action) => {
          if (action === "Edit") navigate(`/contacts/${id}/edit`);
          if (action === "Convert" || action === "Convert to Deal") openConvertModal();
        }}
        onNavigate={(type, navId) => {
          navigate(`/${type}s/${navId}`);
        }}
      />

      {convertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Convert to Deal</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Deal Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={convertForm.dealName}
                  onChange={(e) => setConvertForm((f) => ({ ...f, dealName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Stage</label>
                <select
                  value={convertForm.stage}
                  onChange={(e) => setConvertForm((f) => ({ ...f, stage: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                >
                  {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={convertForm.amount}
                  onChange={(e) => setConvertForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Closing Date</label>
                <input
                  type="date"
                  value={convertForm.closingDate}
                  onChange={(e) => setConvertForm((f) => ({ ...f, closingDate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>

              {convertError && <p className="text-sm text-red-600">{convertError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConvertModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvertToDeal}
                disabled={converting}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {converting ? "Creating..." : "Create Deal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
