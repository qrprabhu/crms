import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import ModuleToolbar from "../../components/crm/ModuleToolbar";
import FilterSidebar from "../../components/crm/FilterSidebar";
import CRMTable from "../../components/crm/CRMTable";
import CRMPagination from "../../components/crm/CRMPagination";
import { filterRecords, sortRecords } from "../../lib/shared/crmHelpers";
import type { CRMRecord, CRMRowAction } from "../../lib/shared/crmTypes";
import { deleteService, listServices } from "../api";
import { servicesModuleMeta } from "../config";
import type { ServiceRecord } from "../types";

const rowActions: CRMRowAction[] = [
  { key: "open", label: "Open" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
];

export default function ServicesListPage() {
  const meta = servicesModuleMeta.catalog;
  const navigate = useNavigate();
  const [rows, setRows] = useState<ServiceRecord[]>([]);
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRows(await listServices());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load services.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleColumns = useMemo(
    () => meta.columns.filter((column) => !hiddenColumns.includes(column.key)),
    [hiddenColumns, meta.columns]
  );

  const processedRows = useMemo(() => {
    const combined = { ...sidebarFilters, ...columnFilters };
    let output = filterRecords(rows as CRMRecord[], visibleColumns as any, combined) as ServiceRecord[];
    if (sortState) output = sortRecords(output as any, sortState.key as never, sortState.direction) as ServiceRecord[];
    return output;
  }, [rows, visibleColumns, sidebarFilters, columnFilters, sortState]);

  const paginatedRows = useMemo(() => processedRows.slice((page - 1) * 10, page * 10), [page, processedRows]);
  const activeServicesCount = useMemo(() => rows.filter((row) => row.status.toLowerCase() === "active").length, [rows]);
  const draftServicesCount = useMemo(() => rows.filter((row) => row.status.toLowerCase() === "draft").length, [rows]);
  const totalAssignedMembers = useMemo(() => rows.reduce((sum, row) => sum + (row.membersCount || 0), 0), [rows]);
  const averageDuration = useMemo(
    () => (rows.length ? Math.round(rows.reduce((sum, row) => sum + row.durationMinutes, 0) / rows.length) : 0),
    [rows]
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <ModuleToolbar
          viewName={meta.title}
          createButtonLabel={meta.createLabel}
          baseRoute={meta.baseRoute}
          showImportActions={false}
          isFilterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((prev) => !prev)}
          onCreateClick={() => navigate("/services/catalog/create")}
        />

        {!loading && !error ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Services</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Active Services</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{activeServicesCount}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Draft Services</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{draftServicesCount}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Avg Duration</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{averageDuration} min</div>
              <div className="mt-1 text-xs text-slate-500">{totalAssignedMembers} member assignments</div>
            </div>
          </div>
        ) : null}

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading services...</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div> : null}

        {!loading && !error && rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">Start your services catalog</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
              Create service offerings with pricing, duration, linked business hours, and assigned members.
            </p>
          </div>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className="flex gap-3">
            {filterOpen ? (
              <FilterSidebar
                title="Filter Services"
                sections={meta.filters}
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
                onToggleAll={(checked) => setSelectedIds(checked ? paginatedRows.map((row) => row.id) : [])}
                onToggleRow={(id, checked) => setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id)))}
                onOpenRow={(row) => navigate(`/services/catalog/${row.id}`)}
                onRowAction={async (actionKey, row) => {
                  if (actionKey === "open") navigate(`/services/catalog/${row.id}`);
                  if (actionKey === "edit") navigate(`/services/catalog/${row.id}/edit`);
                  if (actionKey === "delete") {
                    await deleteService(row.id);
                    await load();
                  }
                }}
                onSortColumn={(columnKey, direction) => setSortState({ key: columnKey, direction })}
                onToggleHideColumn={(columnKey) => setHiddenColumns((prev) => (prev.includes(columnKey) ? prev.filter((item) => item !== columnKey) : [...prev, columnKey]))}
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
