import { getResolvedApiBaseUrl } from "../api/config";
import { apiRequest } from "../api/client";
import { getAccessToken } from "../lib/api/authApi";

export type ReportCatalogItem = {
  key: string;
  title: string;
};

export type ReportSummaryCard = {
  key: string;
  label: string;
  value: string;
  tone: "mint" | "sky" | "violet" | "amber";
};

export type ReportRunResponse = {
  report: {
    key: string;
    title: string;
    description: string;
    columns: Array<{ key: string; label: string }>;
    search_placeholder: string;
    empty_message: string;
  };
  filters: {
    date_from: string | null;
    date_to: string | null;
    date_range_label: string;
    search: string;
    page_size: number;
  };
  summary_cards: ReportSummaryCard[];
  rows: Array<Record<string, string>>;
  pagination: {
    page: number;
    page_size: number;
    total_records: number;
    total_pages: number;
  };
};

export type ReportQuery = {
  reportKey: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
};

export const DEV_REPORT_CATALOG: ReportCatalogItem[] = [
  { key: "sales_report", title: "Sales Report" },
  { key: "leads_report", title: "Leads Report" },
  { key: "deals_report", title: "Deals Report" },
  { key: "contacts_report", title: "Contacts Report" },
  { key: "projects_report", title: "Projects Report" },
  { key: "services_report", title: "Services Report" },
];

function toQuery(query: ReportQuery) {
  return {
    reportKey: query.reportKey,
    date_from: query.date_from,
    date_to: query.date_to,
    search: query.search,
    page: query.page,
    page_size: query.page_size,
  };
}

export async function fetchReportsCatalog() {
  return apiRequest<ReportCatalogItem[]>("/reports/catalog/");
}

export async function runReport(query: ReportQuery) {
  return apiRequest<ReportRunResponse>("/reports/generate/", {
    query: toQuery(query),
    forceFresh: true,
    cacheTtlMs: 0,
  });
}

export async function exportReport(query: ReportQuery, format: "csv" | "xlsx") {
  const token = getAccessToken();
  const url = new URL(`${getResolvedApiBaseUrl()}/reports/download/`);
  Object.entries({ ...toQuery(query), export_format: format }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const filenameMatch = contentDisposition.match(/filename=\"?([^"]+)\"?/i);
  const filename = filenameMatch?.[1] || `report-export.${format === "csv" ? "csv" : "xlsx"}`;

  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}
