import { useCallback, useEffect, useState } from "react";
import CRMModuleListPage from "../crm/CRMModuleListPage";
import { accountModuleConfig } from "../../components/modules/accounts/accountsMockData";
import { deleteAccount, getAccounts } from "../../lib/api/accountsApi";
import { keepEmployeeOwnedRows } from "../../lib/shared/recordVisibility";
import type { AccountRecord } from "../../lib/shared/crmTypes";

export default function AccountsPage() {
  const [rows, setRows] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAccounts();
      setRows(keepEmployeeOwnedRows(data));
    } catch (err) {
      console.error("Failed to load accounts:", err);
      setError(err instanceof Error ? err.message : "Unable to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    const handleImport = (event: Event) => {
      const detail = (event as CustomEvent<{ module?: string }>).detail;
      if (!detail?.module || detail.module === "accounts") {
        void loadAccounts();
      }
    };
    window.addEventListener("crm:imported", handleImport as EventListener);
    return () => window.removeEventListener("crm:imported", handleImport as EventListener);
  }, [loadAccounts]);

  const handleDeleteRow = async (id: string) => {
    await deleteAccount(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  if (error && !loading && rows.length === 0) {
    return <div className="p-6 text-sm text-rose-600">{error}</div>;
  }

  return (
    <CRMModuleListPage
      config={accountModuleConfig}
      rows={rows}
      loading={loading}
      showNotes={true}
      showActivity={false}
      onDeleteRow={handleDeleteRow}
    />
  );
}
