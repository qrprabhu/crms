import { useCallback, useEffect, useState } from "react";
import CRMModuleListPage from "../crm/CRMModuleListPage";
import { dealModuleConfig } from "../../components/modules/deals/dealsConfig";
import { deleteDeal, getDeals } from "../../lib/api/dealsApi";
import { keepEmployeeOwnedRows } from "../../lib/shared/recordVisibility";
import type { Deal } from "../../lib/shared/crmTypes";
import DealsPipelinePanel from "./DealsPipelinePanel";

export default function DealsPage() {
  const [rows, setRows] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"pipeline" | "list">("pipeline");

  const loadDeals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDeals();
      setRows(keepEmployeeOwnedRows(data));
    } catch (err) {
      console.error("Failed to load deals:", err);
      const message = err instanceof Error ? err.message : "Unable to load deals";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals]);

  useEffect(() => {
    const handleImport = (event: Event) => {
      const detail = (event as CustomEvent<{ module?: string }>).detail;
      if (!detail?.module || detail.module === "deals") {
        void loadDeals();
      }
    };
    window.addEventListener("crm:imported", handleImport as EventListener);
    return () => window.removeEventListener("crm:imported", handleImport as EventListener);
  }, [loadDeals]);

  const handleDeleteRow = async (id: string) => {
    await deleteDeal(id);
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  if (error && !loading && rows.length === 0) {
    return <div className="p-6 text-sm text-rose-600">{error}</div>;
  }

  return (
    <CRMModuleListPage
      config={dealModuleConfig}
      rows={rows}
      loading={loading}
      showNotes={false}
      showActivity={false}
      onDeleteRow={handleDeleteRow}
      hideFilterSidebar={viewMode === "pipeline"}
      hideTable={viewMode === "pipeline"}
      renderTopContent={({ processedRows, loading: listLoading }) => (
        <div className="mb-4 space-y-4">
          <DealsViewToggle viewMode={viewMode} onChange={setViewMode} />
          {viewMode === "pipeline" ? (
            <DealsPipelinePanel deals={processedRows} loading={listLoading} />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
              List view is focused on filters, sorting, bulk actions, and deal management.
            </div>
          )}
        </div>
      )}
    />
  );
}

function DealsViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: "pipeline" | "list";
  onChange: (mode: "pipeline" | "list") => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Deals Workspace</h2>
        <p className="text-sm text-slate-500">
          Use pipeline view for stage movement and list view for full record management.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => onChange("pipeline")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            viewMode === "pipeline"
              ? "border border-[#bbf7d0] bg-[linear-gradient(135deg,#4ade80_0%,#16a34a_100%)] text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)]"
              : "text-slate-600 hover:bg-white"
          }`}
        >
          Pipeline View
        </button>
        <button
          type="button"
          onClick={() => onChange("list")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            viewMode === "list"
              ? "border border-[#bbf7d0] bg-[linear-gradient(135deg,#4ade80_0%,#16a34a_100%)] text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)]"
              : "text-slate-600 hover:bg-white"
          }`}
        >
          List View
        </button>
      </div>
    </div>
  );
}
