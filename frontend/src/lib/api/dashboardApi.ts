import { apiRequest } from "../../api/client";

export type HomeDashboardResponse = {
  hero: {
    follow_ups: number;
    inactive_customers: number;
    repeat_revenue: number;
    tasks_due_today: number;
    meetings_today: number;
    deals_updated_today: number;
    customers_added_today: number;
  };
  summary_cards: Array<{ title: string; value: number; note: string; trend: string }>;
  top_insight_chips: Array<{ label: string; value: string | number }>;
  action_queue: Array<{ title: string; count: number }>;
  segments: Array<{ name: string; count: number }>;
  recent_activity: Array<{ key: string; customer: string; type: string; context: string; time: string | null; tag: string }>;
  top_customers: Array<{ id: string; name: string; status_line: string; revenue: number; deals: number; rank: number }>;
};

export type AnalyticsDashboardResponse = {
  hero: { updated: string; revenue_today: number; leads_today: number; deals_today: number };
  daily_metrics: {
    leads_today: number;
    leads_yesterday: number;
    accounts_today: number;
    accounts_yesterday: number;
    deals_today: number;
    deals_yesterday: number;
    revenue_today: number;
    revenue_yesterday: number;
  };
  month_scorecard: {
    leads_created: number;
    contacts_added: number;
    deals_created: number;
    deals_won: number;
    revenue_won: number;
    open_amount: number;
  };
  revenue_target: { achieved: number; won: number; goal: number };
  risk: {
    stale_pipeline_deals: number;
    stale_pipeline_amount: number;
    overdue_invoices: number;
    overdue_invoice_amount: number;
    lead_conversion_rate: number;
    top_source: { name: string; value: number } | null;
  };
  daily_series: Array<{ day: string; leads: number; deals: number; revenue: number }>;
  lead_sources: Array<{ name: string; value: number }>;
  owner_rows: Array<{ owner: string; revenue: number; won: number }>;
  recent_signals: Array<{ key: string; title: string; note: string; time: string | null; tone: string }>;
  top_revenue_accounts: Array<{ name: string; revenue: number; deals: number; last_touched_days: number }>;
  pipeline_health: { open_amount: number; pipeline_deals: number; won_revenue: number; won_deals: number };
};

export type MyRequestsDashboardResponse = {
  updated: string;
  summary_cards: { created_today: number; updated_today: number; due_today: number; closed_today: number };
  focus_today: { overdue: number; due_today: number; pending: number };
  request_mix: Array<{ module: string; count: number }>;
  open_requests: DashboardRequestItem[];
  upcoming_queue: DashboardRequestItem[];
  closed_history: DashboardRequestItem[];
  pending_approval: DashboardRequestItem[];
};

export type DashboardRequestItem = {
  id: string;
  module: "Task" | "Meeting" | "Case" | "Appointment";
  title: string;
  status: string;
  priority?: string;
  created_at?: string;
  updated_at?: string;
  due_at?: string;
  href: string;
  meta: string;
};

export function getHomeDashboard(cacheTtlMs = 2 * 60 * 1000) {
  return apiRequest<HomeDashboardResponse>("/dashboard/home/", { cacheTtlMs });
}

export function getAnalyticsDashboard(cacheTtlMs = 5 * 60 * 1000) {
  return apiRequest<AnalyticsDashboardResponse>("/dashboard/analytics/", { cacheTtlMs });
}

export function getMyRequestsDashboard(cacheTtlMs = 2 * 60 * 1000) {
  return apiRequest<MyRequestsDashboardResponse>("/dashboard/my-requests/", { cacheTtlMs });
}
