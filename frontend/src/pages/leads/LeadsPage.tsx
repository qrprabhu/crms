import { useCallback, useEffect, useState } from "react";
import CRMModuleListPage from "../crm/CRMModuleListPage";
import { leadModuleConfig } from "../../components/modules/leads/leadsMockData";
import { deleteLead, getLeads } from "../../lib/api/leadsApi";
import { keepEmployeeOwnedRows } from "../../lib/shared/recordVisibility";
import type { LeadRecord } from "../../lib/shared/crmTypes";

export default function LeadsPage() {
  const [rows, setRows] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLeads();
      setRows(keepEmployeeOwnedRows(data));
    } catch (error) {
      console.error("Failed to load leads:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    const handleImport = (event: Event) => {
      const detail = (event as CustomEvent<{ module?: string }>).detail;
      if (!detail?.module || detail.module === "leads") {
        void loadLeads();
      }
    };
    window.addEventListener("crm:imported", handleImport as EventListener);
    return () => window.removeEventListener("crm:imported", handleImport as EventListener);
  }, [loadLeads]);

  const handleDeleteRow = async (id: string) => {
    await deleteLead(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <CRMModuleListPage
      config={leadModuleConfig}
      rows={rows}
      loading={loading}
      showNotes={true}
      showActivity={true}
      onDeleteRow={handleDeleteRow}
    />
  );
}
