import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import ModuleToolbar from "../../components/crm/ModuleToolbar";
import FilterSidebar from "../../components/crm/FilterSidebar";
import CRMTable from "../../components/crm/CRMTable";
import CRMPagination from "../../components/crm/CRMPagination";
import { filterRecords, sortRecords } from "../../lib/shared/crmHelpers";
import type { CRMRecord, CRMRowAction } from "../../lib/shared/crmTypes";
import { getSupportList } from "../api";
import { supportModuleMeta } from "../config";
import type { SupportModuleKey } from "../types";

const rowActions: CRMRowAction[] = [
  { key: "open", label: "Open" },
  { key: "edit", label: "Edit" },
];

type Props = {
  moduleKey: SupportModuleKey;
};

export default function SupportListPageCore({ moduleKey }: Props) {
  const meta = supportModuleMeta[moduleKey];
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
      setRows(await getSupportList(moduleKey));
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
    () => meta.rowColumns.filter((column) => !hiddenColumns.includes(column.key)),
    [hiddenColumns, meta.rowColumns]
  );

  const processedRows = useMemo(() => {
    const combined = { ...sidebarFilters, ...columnFilters };
    let output = filterRecords(rows, visibleColumns as any, combined, globalSearch);
    if (sortState) {
      output = sortRecords(output as any, sortState.key as never, sortState.direction) as CRMRecord[];
    }
    return output;
  }, [rows, visibleColumns, sidebarFilters, columnFilters, sortState]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * 10;
    return processedRows.slice(start, start + 10);
  }, [page, processedRows]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <ModuleToolbar
          viewName={meta.title}
          createButtonLabel={meta.createLabel}
          baseRoute={meta.baseRoute}
          importPrimaryLabel={meta.importLabel}
          isFilterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((prev) => !prev)}
          onCreateClick={() => navigate(meta.createRoute)}
        />

        {loading ? <div className="p-6 text-sm text-slate-600">Loading {meta.title.toLowerCase()}...</div> : null}
        {error ? <div className="p-6 text-sm text-rose-600">{error}</div> : null}

        {!loading && !error && rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
            <h1 className="text-2xl font-semibold text-slate-900">{meta.emptyTitle}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">{meta.emptyDescription}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" onClick={() => navigate(meta.createRoute)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">
                {meta.createLabel}
              </button>
              <button type="button" onClick={() => navigate(meta.importRoute)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
                {meta.importLabel}
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className="flex gap-3">
            {filterOpen ? (
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
            ) : null}

            <div className="min-w-0 flex-1 space-y-3">
              <CRMTable
                rows={paginatedRows as any}
                columns={visibleColumns as any}
                rowActions={rowActions}
                selectedIds={selectedIds}
                hiddenColumns={hiddenColumns}
                pinnedColumn={pinnedColumn}
                columnFilters={columnFilters}
                showNotes={false}
                showActivity={false}
                onToggleAll={(checked) => {
                  setSelectedIds(checked ? paginatedRows.map((row) => row.id) : []);
                }}
                onToggleRow={(id, checked) => {
                  setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id)));
                }}
                onOpenRow={(row) => navigate(`${meta.baseRoute}/${row.id}`)}
                onRowAction={(actionKey, row) => {
                  if (actionKey === "open") navigate(`${meta.baseRoute}/${row.id}`);
                  if (actionKey === "edit") navigate(`${meta.baseRoute}/${row.id}/edit`);
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
              <CRMPagination page={page} pageSize={10} totalItems={processedRows.length} onPageChange={setPage} />
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

