import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Search,
  Sparkles,
} from "lucide-react";

import DashboardLayout from "../components/layout/DashboardLayout";
import {
  DEV_REPORT_CATALOG,
  exportReport,
  fetchReportsCatalog,
  runReport,
  type ReportCatalogItem,
  type ReportRunResponse,
  type ReportSummaryCard,
} from "../services/reportsApi";

type FiltersState = {
  report_key: string;
  date_from: string;
  date_to: string;
  search: string;
  page_size: number;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function toneClasses(tone: ReportSummaryCard["tone"]) {
  if (tone === "sky") {
    return "border-[#c9c4ff] bg-[#f2f0ff] text-[#4338ca]";
  }
  if (tone === "violet") {
    return "border-[#d6bdf8] bg-[#f8f1ff] text-[#7c3aed]";
  }
  if (tone === "amber") {
    return "border-[#e0d4ff] bg-[#f6f1ff] text-[#15803d]";
  }
  return "border-[#cdbaf8] bg-[#f5f0ff] text-[#15803d]";
}

function iconToneClasses(tone: ReportSummaryCard["tone"]) {
  if (tone === "sky") return "bg-[#e1ddff] text-[#4338ca]";
  if (tone === "violet") return "bg-[#efe3ff] text-[#7c3aed]";
  if (tone === "amber") return "bg-[#ece2ff] text-[#15803d]";
  return "bg-[#eadfff] text-[#15803d]";
}

function formatDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  const toIso = (value: Date) => value.toISOString().slice(0, 10);
  return { date_from: toIso(start), date_to: toIso(end) };
}

export default function ReportsPage() {
  const initialRange = useMemo(() => formatDefaultDateRange(), []);
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [filters, setFilters] = useState<FiltersState>({
    report_key: "",
    date_from: initialRange.date_from,
    date_to: initialRange.date_to,
    search: "",
    page_size: 25,
  });
  const [reportData, setReportData] = useState<ReportRunResponse | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [runningReport, setRunningReport] = useState(false);
  const [exporting, setExporting] = useState<"" | "csv" | "xlsx">("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      try {
        setLoadingCatalog(true);
        const response = await fetchReportsCatalog();
        if (!active) return;
        setCatalog(response.length > 0 ? response : DEV_REPORT_CATALOG);
      } catch (err) {
        if (!active) return;
        setCatalog(DEV_REPORT_CATALOG);
        setError(err instanceof Error ? err.message : "Failed to load reports catalog.");
      } finally {
        if (active) setLoadingCatalog(false);
      }
    };
    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  const selectedReport = useMemo(
    () => catalog.find((item) => item.key === filters.report_key) ?? null,
    [catalog, filters.report_key]
  );

  const handleGenerate = async (page = 1) => {
    if (!filters.report_key) return;
    try {
      setRunningReport(true);
      setError("");
      const response = await runReport({
        reportKey: filters.report_key,
        date_from: filters.date_from,
        date_to: filters.date_to,
        search: filters.search,
        page,
        page_size: filters.page_size,
      });
      setReportData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setRunningReport(false);
    }
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    if (!filters.report_key) return;
    try {
      setExporting(format);
      await exportReport(
        {
          reportKey: filters.report_key,
          date_from: filters.date_from,
          date_to: filters.date_to,
          search: filters.search,
          page_size: filters.page_size,
        },
        format
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}.`);
    } finally {
      setExporting("");
    }
  };

  const availableReportCount = catalog.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-[#d8cdf8] bg-[linear-gradient(135deg,#fbf9ff_0%,#f3eeff_42%,#ffffff_100%)] shadow-[0_18px_50px_rgba(92,51,173,0.10)]">
          <div className="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d8cdf8] bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#15803d]">
                <Sparkles className="h-3.5 w-3.5" />
                CRM Reporting Workspace
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#24143f]">Reports</h1>
              <p className="mt-2 text-sm leading-6 text-[#6f5a95]">
                Generate CRM reports with date filters, searchable output, and export-ready tables.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#6f5a95]">
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Visible reports: {availableReportCount}</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Development catalog enabled</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleExport("csv")}
                disabled={!filters.report_key || exporting !== ""}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#cdbaf8] bg-white px-4 py-3 text-sm font-medium text-[#5b21b6] transition hover:bg-[#f7f2ff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {exporting === "csv" ? "Exporting..." : "Export CSV"}
              </button>
              <button
                type="button"
                onClick={() => void handleExport("xlsx")}
                disabled={!filters.report_key || exporting !== ""}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#cdbaf8] bg-white px-4 py-3 text-sm font-medium text-[#5b21b6] transition hover:bg-[#f7f2ff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {exporting === "xlsx" ? "Exporting..." : "Export Excel"}
              </button>
              <button
                type="button"
                onClick={() => void handleGenerate(1)}
                disabled={!filters.report_key || runningReport}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#15803d_0%,#16a34a_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(22,163,74,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className={`h-4 w-4 ${runningReport ? "animate-pulse" : ""}`} />
                {runningReport ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#d8cdf8] bg-white p-5 shadow-[0_14px_36px_rgba(76,29,149,0.08)]">
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr_1fr_1.4fr_0.9fr]">
            <label className="text-sm font-medium text-[#5b21b6]">
              <span className="mb-2 block">Report</span>
              <select
                value={filters.report_key}
                onChange={(event) => {
                  setReportData(null);
                  setFilters((current) => ({ ...current, report_key: event.target.value }));
                }}
                className="w-full rounded-2xl border border-[#cdbaf8] bg-[#fcfbff] px-4 py-3 text-sm text-[#24143f] outline-none transition focus:border-[#7c3aed]"
              >
                <option value="">Select Report</option>
                {catalog.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.title}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs text-[#7a67a5]">
                {loadingCatalog ? "Loading reports..." : selectedReport ? selectedReport.title : "No report available"}
              </span>
            </label>

            <label className="text-sm font-medium text-[#5b21b6]">
              <span className="mb-2 block">Date From</span>
              <div className="relative">
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))}
                  className="w-full rounded-2xl border border-[#cdbaf8] bg-[#fcfbff] px-4 py-3 text-sm text-[#24143f] outline-none transition focus:border-[#7c3aed]"
                />
                <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a67a5]" />
              </div>
            </label>

            <label className="text-sm font-medium text-[#5b21b6]">
              <span className="mb-2 block">Date To</span>
              <div className="relative">
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))}
                  className="w-full rounded-2xl border border-[#cdbaf8] bg-[#fcfbff] px-4 py-3 text-sm text-[#24143f] outline-none transition focus:border-[#7c3aed]"
                />
                <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a67a5]" />
              </div>
            </label>

            <label className="text-sm font-medium text-[#5b21b6]">
              <span className="mb-2 block">Search in report</span>
              <div className="relative">
                <input
                  type="text"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder={selectedReport ? `Search ${selectedReport.title}` : "Search in report"}
                  className="w-full rounded-2xl border border-[#cdbaf8] bg-[#fcfbff] px-11 py-3 text-sm text-[#24143f] outline-none transition focus:border-[#7c3aed]"
                />
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a67a5]" />
              </div>
            </label>

            <label className="text-sm font-medium text-[#5b21b6]">
              <span className="mb-2 block">Rows per page</span>
              <select
                value={filters.page_size}
                onChange={(event) => setFilters((current) => ({ ...current, page_size: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-[#cdbaf8] bg-[#fcfbff] px-4 py-3 text-sm text-[#24143f] outline-none transition focus:border-[#7c3aed]"
              >
                {PAGE_SIZE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {reportData ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {reportData.summary_cards.map((card) => (
                <article
                  key={card.key}
                  className={`rounded-[24px] border px-5 py-5 shadow-[0_10px_28px_rgba(52,37,19,0.05)] ${toneClasses(card.tone)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">{card.label}</div>
                      <div className="mt-3 text-4xl font-semibold tracking-tight">{card.value}</div>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconToneClasses(card.tone)}`}>
                      <Sparkles className="h-5 w-5" />
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="overflow-hidden rounded-[28px] border border-[#d8cdf8] bg-white shadow-[0_18px_44px_rgba(76,29,149,0.08)]">
              <div className="border-b border-[#ece5ff] px-6 py-5">
                <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#24143f]">{reportData.report.title}</h2>
                <p className="mt-2 text-sm text-[#7a67a5]">Date range: {reportData.filters.date_range_label}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-[#f6f1ff] text-left text-sm font-semibold text-[#5b21b6]">
                      {reportData.report.columns.map((column) => (
                        <th key={column.key} className="px-5 py-4 first:rounded-tl-2xl last:rounded-tr-2xl">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.length > 0 ? (
                      reportData.rows.map((row, index) => (
                        <tr key={`${index}-${row[reportData.report.columns[0]?.key] || "row"}`} className="text-sm text-[#24143f]">
                          {reportData.report.columns.map((column) => (
                            <td key={column.key} className="border-b border-[#f0ebff] px-5 py-4 align-middle">
                              {column.key === "status" ? (
                                <span className="inline-flex rounded-full bg-[#ede9fe] px-3 py-1 text-xs font-semibold text-[#15803d]">
                                  {row[column.key] || "-"}
                                </span>
                              ) : (
                                row[column.key] || "-"
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={reportData.report.columns.length} className="px-5 py-10 text-center text-sm text-[#7a67a5]">
                          {reportData.report.empty_message}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-[#ece5ff] px-6 py-4 text-sm text-[#6f5a95] md:flex-row md:items-center md:justify-between">
                <div>
                  Showing {reportData.rows.length} of {reportData.pagination.total_records} record
                  {reportData.pagination.total_records === 1 ? "" : "s"}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={reportData.pagination.page <= 1 || runningReport}
                    onClick={() => void handleGenerate(reportData.pagination.page - 1)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#cdbaf8] px-3 py-2 text-sm text-[#5b21b6] transition hover:bg-[#f7f2ff] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <span className="font-medium text-[#24143f]">
                    Page {reportData.pagination.page} of {reportData.pagination.total_pages}
                  </span>
                  <button
                    type="button"
                    disabled={reportData.pagination.page >= reportData.pagination.total_pages || runningReport}
                    onClick={() => void handleGenerate(reportData.pagination.page + 1)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#cdbaf8] px-3 py-2 text-sm text-[#5b21b6] transition hover:bg-[#f7f2ff] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-[28px] border border-dashed border-[#cdbaf8] bg-white/70 px-6 py-10 text-center text-sm text-[#7a67a5]">
            {loadingCatalog ? "Loading reports..." : "Select a report and click Generate to see data."}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
