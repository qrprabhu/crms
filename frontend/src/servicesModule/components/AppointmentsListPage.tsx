import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModuleToolbar from "../../components/crm/ModuleToolbar";
import FilterSidebar from "../../components/crm/FilterSidebar";
import CRMTable from "../../components/crm/CRMTable";
import CRMPagination from "../../components/crm/CRMPagination";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { filterRecords, sortRecords } from "../../lib/shared/crmHelpers";
import type { CRMRecord, CRMRowAction } from "../../lib/shared/crmTypes";
import { cancelAppointment, getAppointmentsSummary, listAppointments } from "../api";
import { servicesModuleMeta } from "../config";
import type { AppointmentRecord, AppointmentSummary } from "../types";

const rowActions: CRMRowAction[] = [
  { key: "open", label: "Open" },
  { key: "edit", label: "Edit" },
  { key: "cancel", label: "Cancel" },
];

export default function AppointmentsListPage() {
  const meta = servicesModuleMeta.appointments;
  const navigate = useNavigate();
  const [rows, setRows] = useState<AppointmentRecord[]>([]);
  const [summary, setSummary] = useState<AppointmentSummary | null>(null);
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
      const [appointmentRows, summaryPayload] = await Promise.all([listAppointments(), getAppointmentsSummary()]);
      setRows(appointmentRows);
      setSummary(summaryPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load appointments.");
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
    let output = filterRecords(rows as CRMRecord[], visibleColumns as any, combined) as AppointmentRecord[];
    if (sortState) output = sortRecords(output as any, sortState.key as never, sortState.direction) as AppointmentRecord[];
    return output;
  }, [rows, visibleColumns, sidebarFilters, columnFilters, sortState]);

  const paginatedRows = useMemo(() => processedRows.slice((page - 1) * 10, page * 10), [page, processedRows]);

  const summaryCards = [
    { label: "Total Appointments", value: summary?.totalAppointments ?? rows.length },
    { label: "Due Today", value: summary?.todayAppointments ?? 0 },
    { label: "Active Pipeline", value: summary?.activePipeline ?? 0 },
    { label: "Completed", value: summary?.completedAppointments ?? 0 },
    {
      label: "Top Technician Load",
      value: summary?.topWorkload?.length
        ? `${summary.topWorkload[0].count} • ${summary.topWorkload[0].email || "Unassigned"}`
        : "0 • No assignments",
    },
  ];

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
          onCreateClick={() => navigate("/services/appointments/create")}
        />

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading appointments...</div>
        ) : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div> : null}

        {!loading && !error && rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">No appointments scheduled yet</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
              Book appointments against real service records, members, and CRM entities.
            </p>
          </div>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {summaryCards.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              {filterOpen ? (
                <FilterSidebar
                  title="Filter Appointments"
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
                  onToggleRow={(id, checked) =>
                    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id)))
                  }
                  onOpenRow={(row) => navigate(`/services/appointments/${row.id}`)}
                  onRowAction={async (actionKey, row) => {
                    if (actionKey === "open") navigate(`/services/appointments/${row.id}`);
                    if (actionKey === "edit") navigate(`/services/appointments/${row.id}/edit`);
                    if (actionKey === "cancel") {
                      await cancelAppointment(row.id);
                      await load();
                    }
                  }}
                  onSortColumn={(columnKey, direction) => setSortState({ key: columnKey, direction })}
                  onToggleHideColumn={(columnKey) =>
                    setHiddenColumns((prev) =>
                      prev.includes(columnKey) ? prev.filter((item) => item !== columnKey) : [...prev, columnKey]
                    )
                  }
                  onTogglePinColumn={(columnKey) => setPinnedColumn((prev) => (prev === columnKey ? null : columnKey))}
                  onFilterColumn={(columnKey, value) => setColumnFilters((prev) => ({ ...prev, [columnKey]: value }))}
                />
                <CRMPagination page={page} pageSize={10} totalItems={processedRows.length} onPageChange={setPage} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
