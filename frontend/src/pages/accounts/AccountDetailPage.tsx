import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { accountModuleConfig } from "../../components/modules/accounts/accountsMockData";
import {
  getAccountById,
  getAccountContacts,
  getAccountDeals,
  getAccountNotes,
} from "../../lib/api/accountsApi";
import { loadAccountLinkedData } from "../../lib/api/linkedRecordsApi";
import type { AccountRecord, Note } from "../../lib/shared/crmTypes";
import CRMModuleDetailPage from "../crm/CRMModuleDetailPage";

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountRecord | null>((location.state as { record?: AccountRecord } | null)?.record ?? null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [linkedData, setLinkedData] = useState<any | null>(null);
  const [loading, setLoading] = useState(!((location.state as { record?: AccountRecord } | null)?.record));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const accountData = await getAccountById(id);

        if (!accountData) {
          setAccount(null);
          setLinkedData(null);
          setLoading(false);
          return;
        }

        setAccount(accountData);
        setLoading(false);

        const [notesData, contactsData, dealsData] = await Promise.all([
          getAccountNotes(id).catch(() => []),
          getAccountContacts(id).catch(() => []),
          getAccountDeals(id).catch(() => []),
        ]);
        setNotes(notesData);

        const related = await loadAccountLinkedData(accountData, { forceRefresh: true }).catch(() => null);
        setLinkedData({
          ...related,
          contacts: related?.contacts?.length
            ? related.contacts
            : contactsData.map((contact) => ({
                id: contact.id,
                name: contact.contactName,
                email: contact.email,
                phone: contact.phone,
              })),
          deals: related?.deals?.length ? related.deals : dealsData,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading account...</div>;
  if (error || !account) return <div className="p-6 text-sm text-rose-600">{error ?? "Account not found."}</div>;

  return (
    <CRMModuleDetailPage
      config={accountModuleConfig}
      rows={[account]}
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
        timeline: linkedData?.timeline || [],
      }}
      onAction={(action) => {
        if (action === "Edit") navigate(`/accounts/${id}/edit`);
      }}
      onNavigate={(type, navId) => {
        navigate(`/${type}s/${navId}`);
      }}
    />
  );
}
