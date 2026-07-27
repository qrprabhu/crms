import { useCallback, useEffect, useState } from "react";
import { contactModuleConfig } from "../../components/modules/contacts/contactsMockData";
import { deleteContact, getContacts } from "../../lib/api/contactsApi";
import { keepEmployeeOwnedRows } from "../../lib/shared/recordVisibility";
import type { ContactRecord } from "../../lib/shared/crmTypes";
import CRMModuleListPage from "../crm/CRMModuleListPage";

export default function ContactsPage() {
  const [rows, setRows] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getContacts();
      setRows(keepEmployeeOwnedRows(data));
    } catch (err) {
      console.error("Failed to load contacts:", err);
      setError(err instanceof Error ? err.message : "Unable to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const handleImport = (event: Event) => {
      const detail = (event as CustomEvent<{ module?: string }>).detail;
      if (!detail?.module || detail.module === "contacts") {
        void loadContacts();
      }
    };
    window.addEventListener("crm:imported", handleImport as EventListener);
    return () => window.removeEventListener("crm:imported", handleImport as EventListener);
  }, [loadContacts]);

  const handleDeleteRow = async (id: string) => {
    await deleteContact(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  if (error && !loading && rows.length === 0) {
    return <div className="p-6 text-sm text-rose-600">{error}</div>;
  }

  return (
    <CRMModuleListPage
      config={contactModuleConfig}
      rows={rows}
      loading={loading}
      showNotes={true}
      showActivity={false}
      onDeleteRow={handleDeleteRow}
    />
  );
}
