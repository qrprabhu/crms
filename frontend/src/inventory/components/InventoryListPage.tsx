import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import ModuleToolbar from "../../components/crm/ModuleToolbar";
import FilterSidebar from "../../components/crm/FilterSidebar";
import CRMTable from "../../components/crm/CRMTable";
import CRMPagination from "../../components/crm/CRMPagination";
import { filterRecords, sortRecords } from "../../lib/shared/crmHelpers";
import type { CRMRecord } from "../../lib/shared/crmTypes";
import { convertQuoteToSalesOrder, convertSalesOrderToInvoice, deleteInventoryRecord, getInventoryList } from "../api";
import { getInventoryMeta } from "../config";
import type { InventoryModuleKey } from "../types";

type InventoryListPageProps = {
  moduleKey: InventoryModuleKey;
};

export default function InventoryListPage({ moduleKey }: InventoryListPageProps) {
  const meta = getInventoryMeta(moduleKey);
  const navigate = useNavigate();
  const [rows, setRows] = useState<CRMRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [pinnedColumn, setPinnedColumn] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<Partial<Record<string, string>>>({});
  const [sidebarFilters, setSidebarFilters] = useState<Record<string, string>>({});
  const [sortState, setSortState] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [filterOpen, setFilterOpen] = useState(true);
  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    const handleSearch = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setGlobalSearch(customEvent.detail);
      setPage(1);
    };
    window.addEventListener("topbar:search", handleSearch);
    return () => window.removeEventListener("topbar:search", handleSearch);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRows(await getInventoryList(moduleKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to load ${meta.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [meta.title, moduleKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleColumns = useMemo(
    () => meta.columns.filter((column) => !hiddenColumns.includes(column.key)),
    [hiddenColumns, meta.columns]
  );

  const processedRows = useMemo(() => {
    const combined = { ...sidebarFilters, ...columnFilters };
    let output = filterRecords(rows, visibleColumns as any, combined, globalSearch);
    if (sortState) {
      output = sortRecords(output as any, sortState.key as never, sortState.direction) as CRMRecord[];
    }
    return output;
  }, [rows, visibleColumns, sidebarFilters, columnFilters, sortState]);

  const pageSize = 10;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [page, pageSize, processedRows]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading {meta.title.toLowerCase()}...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-rose-600">{error}</div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <ModuleToolbar
          viewName={meta.title}
          createButtonLabel={meta.createLabel}
          baseRoute={meta.baseRoute}
          importPrimaryLabel={meta.importLabel}
          showImportActions={Boolean(meta.importRoute)}
          isFilterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((prev) => !prev)}
          onCreateClick={() => navigate(meta.createRoute || `${meta.baseRoute}/create`)}
        />

        {meta.extraHeaderAction && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate(meta.extraHeaderAction!.route)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              {meta.extraHeaderAction.label}
            </button>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
            <h1 className="text-2xl font-semibold text-slate-900">{meta.emptyTitle}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">{meta.emptyDescription}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate(meta.createRoute || `${meta.baseRoute}/create`)}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
              >
                {meta.createLabel}
              </button>
              {meta.importRoute && (
                <button
                  type="button"
                  onClick={() => navigate(meta.importRoute!)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
                >
                  {meta.importLabel}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            {filterOpen && (
              <FilterSidebar
                title={`Filter ${meta.title}`}
                sections={meta.filterSections}
                onApply={(filters) => {
                  setSidebarFilters(filters);
                  setPage(1);
                }}
                onClear={() => {
                  setSidebarFilters({});
                  setPage(1);
                }}
              />
            )}

            <div className="min-w-0 flex-1 space-y-3">
              <CRMTable
                rows={paginatedRows as any}
                columns={visibleColumns as any}
                rowActions={meta.rowActions}
                selectedIds={selectedIds}
                hiddenColumns={hiddenColumns}
                pinnedColumn={pinnedColumn}
                columnFilters={columnFilters}
                showNotes={moduleKey === "vendors"}
                showActivity={moduleKey === "vendors"}
                onToggleAll={(checked) => {
                  setSelectedIds(checked ? paginatedRows.map((row) => row.id) : []);
                }}
                onToggleRow={(id, checked) => {
                  setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id)));
                }}
                onOpenRow={(row) => navigate(`${meta.baseRoute}/${row.id}`)}
                onRowAction={async (actionKey, row) => {
                  if (actionKey === "open" || actionKey === "edit") {
                    navigate(`${meta.baseRoute}/${row.id}`);
                    return;
                  }
                  if (actionKey === "delete") {
                    await deleteInventoryRecord(moduleKey, row.id);
                    void load();
                    return;
                  }
                  if (actionKey === "convert-to-sales-order") {
                    const response = await convertQuoteToSalesOrder(row.id);
                    navigate(`/sales-orders/${response.id}`);
                    return;
                  }
                  if (actionKey === "convert-to-invoice") {
                    const response = await convertSalesOrderToInvoice(row.id);
                    navigate(`/invoices/${response.id}`);
                    return;
                  }
                  if (actionKey === "create-service-appointment") {
                    const query =
                      moduleKey === "sales-orders"
                        ? `?salesOrder=${encodeURIComponent(row.id)}`
                        : `?invoice=${encodeURIComponent(row.id)}`;
                    navigate(`/services/appointments/create${query}`);
                    return;
                  }
                  if (actionKey === "create-project") {
                    const inventoryRow = row as any;
                    const params = new URLSearchParams({
                      sourceModule: moduleKey,
                      sourceId: row.id,
                      sourceLabel: String(inventoryRow.subject || inventoryRow.name || meta.singular),
                      name: String(inventoryRow.subject || meta.singular),
                      accountName: String(inventoryRow.accountName || ""),
                      contactName: String(inventoryRow.contactName || ""),
                      dealName: String(inventoryRow.dealName || ""),
                      owner: String(inventoryRow.owner || ""),
                      dueDate: String(inventoryRow.dueDate || ""),
                    });
                    navigate(`/projects/create?${params.toString()}`);
                  }
                }}
                onSortColumn={(columnKey, direction) => setSortState({ key: columnKey, direction })}
                onToggleHideColumn={(columnKey) => {
                  setHiddenColumns((prev) =>
                    prev.includes(columnKey) ? prev.filter((item) => item !== columnKey) : [...prev, columnKey]
                  );
                }}
                onTogglePinColumn={(columnKey) => setPinnedColumn((prev) => (prev === columnKey ? null : columnKey))}
                onFilterColumn={(columnKey, value) => setColumnFilters((prev) => ({ ...prev, [columnKey]: value }))}
              />

              <CRMPagination
                page={page}
                pageSize={pageSize}
                totalItems={processedRows.length}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
