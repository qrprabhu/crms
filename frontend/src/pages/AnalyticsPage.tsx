import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowUpRight, Building2, CircleDollarSign, Clock3, Funnel, RefreshCw, Target, Users } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import CRMSectionCard from "../components/crm/CRMSectionCard";
import { getAnalyticsDashboard, type AnalyticsDashboardResponse } from "../lib/api/dashboardApi";
import { readDashboardCache, writeDashboardCache } from "../lib/dashboardCache";

const PIE_COLORS = ["#76d68a", "#6daac9", "#4f6ecf", "#ef5130", "#ffbd36", "#c069c5", "#1bc5c3", "#a7b2c8"];
const ANALYTICS_CACHE_KEY = "analytics-page-cache-v3";
const ANALYTICS_CACHE_TTL_MS = 10 * 60 * 1000;

const EMPTY_STATE: AnalyticsDashboardResponse = {
  hero: { updated: "", revenue_today: 0, leads_today: 0, deals_today: 0 },
  daily_metrics: {
    leads_today: 0,
    leads_yesterday: 0,
    accounts_today: 0,
    accounts_yesterday: 0,
    deals_today: 0,
    deals_yesterday: 0,
    revenue_today: 0,
    revenue_yesterday: 0,
  },
  month_scorecard: {
    leads_created: 0,
    contacts_added: 0,
    deals_created: 0,
    deals_won: 0,
    revenue_won: 0,
    open_amount: 0,
  },
  revenue_target: { achieved: 0, won: 0, goal: 300000 },
  risk: {
    stale_pipeline_deals: 0,
    stale_pipeline_amount: 0,
    overdue_invoices: 0,
    overdue_invoice_amount: 0,
    lead_conversion_rate: 0,
    top_source: null,
  },
  daily_series: [],
  lead_sources: [],
  owner_rows: [],
  recent_signals: [],
  top_revenue_accounts: [],
  pipeline_health: { open_amount: 0, pipeline_deals: 0, won_revenue: 0, won_deals: 0 },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatCurrencyCompactSafe(value: number) {
  return `INR ${compactNumber(value)}`;
}

function metricDelta(current: number, previous: number) {
  if (previous <= 0 && current > 0) return 100;
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

function formatLastUpdated(value?: string | null) {
  if (!value) return "Not updated yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not updated yet";
  const seconds = Math.max(1, Math.round((Date.now() - parsed.getTime()) / 1000));
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours}h ago`;
}

function monthLabel(date = new Date()) {
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function MetricCard({
  title,
  value,
  delta,
  note,
  icon,
}: {
  title: string;
  value: string;
  delta?: number;
  note: string;
  icon: React.ReactNode;
}) {
  const positive = (delta ?? 0) >= 0;

  return (
    <div className="flex min-h-[220px] flex-col rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</div>
          <div className="mt-4 break-words text-[clamp(2rem,2.3vw,2.8rem)] font-semibold leading-[1.05] tracking-tight text-slate-900">{value}</div>
          {delta !== undefined ? (
            <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              <ArrowUpRight className={`h-4 w-4 ${positive ? "" : "rotate-90"}`} />
              {Math.abs(delta)}%
            </div>
          ) : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">{icon}</div>
      </div>
      <div className="mt-auto pt-5 text-sm leading-6 text-slate-500">{note}</div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(120px,auto)] items-center gap-3 border-b border-slate-200/70 pb-3 last:border-b-0 last:pb-0">
      <div className="text-sm font-medium uppercase leading-tight tracking-[0.08em] text-slate-600">{label}</div>
      <div className="break-words text-right text-[clamp(1.5rem,2vw,2.25rem)] font-semibold leading-tight text-slate-900">{value}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, formatter }: { active?: boolean; payload?: any[]; formatter?: (value: number) => string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      {payload.map((entry) => (
        <div key={`${entry.dataKey}-${entry.name}`} className="flex items-center justify-between gap-3">
          <span className="text-slate-500">{entry.name}</span>
          <span className="font-semibold text-slate-900">{formatter ? formatter(Number(entry.value)) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsPlaceholder() {
  return (
    <div className="flex h-full items-end gap-3 rounded-3xl bg-slate-50 px-6 py-6">
      <div className="h-24 w-12 animate-pulse rounded-t-2xl bg-slate-200" />
      <div className="h-36 w-12 animate-pulse rounded-t-2xl bg-slate-200" />
      <div className="h-28 w-12 animate-pulse rounded-t-2xl bg-slate-200" />
      <div className="h-44 w-12 animate-pulse rounded-t-2xl bg-slate-200" />
      <div className="h-20 w-12 animate-pulse rounded-t-2xl bg-slate-200" />
    </div>
  );
}

function LegendPill({ label, color }: { label: string; color: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [initialCache] = useState(() => readDashboardCache<AnalyticsDashboardResponse>(ANALYTICS_CACHE_KEY, ANALYTICS_CACHE_TTL_MS));
  const [loading, setLoading] = useState(!initialCache?.state);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<AnalyticsDashboardResponse>(initialCache?.state || EMPTY_STATE);

  useEffect(() => {
    let active = true;
    const hasCachedState = Boolean(initialCache?.state);

    const load = async () => {
      try {
        setLoading(!hasCachedState);
        setRefreshing(hasCachedState || refreshKey > 0);
        setError(null);
        const nextState = await getAnalyticsDashboard(5 * 60 * 1000);
        if (!active) return;
        setState(nextState);
        writeDashboardCache(ANALYTICS_CACHE_KEY, nextState);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load analytics.");
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [initialCache?.state, refreshKey]);

  const analytics = useMemo(() => {
    const currentLeadTarget = Math.max(10, state.month_scorecard.leads_created + 3);
    const leadGaugeValue = Math.min(100, Math.round((state.month_scorecard.leads_created / currentLeadTarget) * 100));

    return {
      leadsToday: state.daily_metrics.leads_today,
      leadsYesterday: state.daily_metrics.leads_yesterday,
      accountsToday: state.daily_metrics.accounts_today,
      accountsYesterday: state.daily_metrics.accounts_yesterday,
      dealsToday: state.daily_metrics.deals_today,
      dealsYesterday: state.daily_metrics.deals_yesterday,
      revenueToday: state.daily_metrics.revenue_today,
      revenueYesterday: state.daily_metrics.revenue_yesterday,
      stalePipelineDeals: state.risk.stale_pipeline_deals,
      stalePipelineAmount: state.risk.stale_pipeline_amount,
      overdueInvoices: state.risk.overdue_invoices,
      overdueInvoiceAmount: state.risk.overdue_invoice_amount,
      leadConversionRate: state.risk.lead_conversion_rate,
      topSource: state.risk.top_source,
      unassignedLeads: 0,
      leadsThisMonth: state.month_scorecard.leads_created,
      contactsThisMonth: state.month_scorecard.contacts_added,
      dealsCreatedThisMonth: state.month_scorecard.deals_created,
      wonDealsThisMonth: state.month_scorecard.deals_won,
      wonRevenue: state.month_scorecard.revenue_won,
      openAmount: state.month_scorecard.open_amount,
      currentLeadTarget,
      leadGaugeData: [{ name: "Progress", value: leadGaugeValue }],
      invoiceRevenue: state.revenue_target.achieved,
      revenueGoal: state.revenue_target.goal,
      dailySeries: state.daily_series,
      leadSources: state.lead_sources,
      ownerRows: state.owner_rows,
      recentSignals: state.recent_signals,
      accountRevenueRows: state.top_revenue_accounts,
    };
  }, [state]);

  if (error) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600">{error}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        <div className="relative overflow-hidden rounded-[28px] border border-[#d6d9f6] bg-[linear-gradient(135deg,#faf8ff_0%,#f1efff_46%,#ffffff_100%)] shadow-[0_18px_42px_rgba(101,87,180,0.10)]">
          <div className="pointer-events-none absolute -right-6 top-0 h-40 w-40 rounded-full bg-violet-300/25 blur-3xl" />
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700">Performance Command</div>
              <h1 className="mt-2 text-[2.1rem] font-semibold tracking-[-0.04em] text-slate-950">Analytics</h1>
              <p className="mt-1 text-sm text-slate-500">
                Live CRM analytics for revenue momentum, conversion quality, and risks that need action today.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">{monthLabel()}</div>
              <button
                type="button"
                onClick={() => setRefreshKey((current) => current + 1)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="grid items-stretch gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Updated</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{formatLastUpdated(state.hero.updated).replace("Updated ", "")}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Revenue Today</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{formatCurrencyCompactSafe(analytics.revenueToday)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Leads Today</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{analytics.leadsToday}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Deals Today</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{analytics.dealsToday}</div>
            </div>
          </div>
        </div>

        <CRMSectionCard title="Revenue Risk And Next Actions" subtitle="Live attention signals derived from current deals, leads, and invoices.">
          <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
            <button type="button" onClick={() => navigate("/deals")} className="flex min-h-[182px] flex-col rounded-2xl border border-[#d7e3f8] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Stale Pipeline Deals</div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-green-600 shadow-sm"><Clock3 className="h-5 w-5" /></div>
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{analytics.stalePipelineDeals}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{formatCurrency(analytics.stalePipelineAmount)} sitting without recent movement.</div>
              <div className="mt-auto pt-4 text-sm font-medium text-slate-700">Open deals that need a push</div>
            </button>

            <button type="button" onClick={() => navigate("/invoices")} className="flex min-h-[182px] flex-col rounded-2xl border border-[#f3d2d4] bg-[linear-gradient(180deg,#fff8f8_0%,#fff1f2_100%)] px-4 py-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Overdue Invoices</div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-rose-600 shadow-sm"><AlertTriangle className="h-5 w-5" /></div>
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{analytics.overdueInvoices}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{formatCurrency(analytics.overdueInvoiceAmount)} needs collection attention.</div>
              <div className="mt-auto pt-4 text-sm font-medium text-slate-700">Revenue already billed but not closed</div>
            </button>

            <button type="button" onClick={() => navigate("/leads")} className="flex min-h-[182px] flex-col rounded-2xl border border-[#ddd3f3] bg-[linear-gradient(180deg,#faf8ff_0%,#f1edff_100%)] px-4 py-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Lead Conversion Rate</div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#7548b9] shadow-sm"><Target className="h-5 w-5" /></div>
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{analytics.leadConversionRate}%</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{analytics.leadsThisMonth} leads created this month, {analytics.contactsThisMonth} contacts added.</div>
              <div className="mt-auto pt-4 text-sm font-medium text-slate-700">Useful signal for funnel quality</div>
            </button>

            <button type="button" onClick={() => navigate("/leads")} className="flex min-h-[182px] flex-col rounded-2xl border border-[#dbe8d7] bg-[linear-gradient(180deg,#f7fcf5_0%,#eef9f1_100%)] px-4 py-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Source To Watch</div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm"><Users className="h-5 w-5" /></div>
              </div>
              <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{analytics.topSource?.name || "Unknown"}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{analytics.topSource ? `${analytics.topSource.value} leads from your strongest source right now.` : "Lead sources will appear here as data grows."}</div>
              <div className="mt-auto pt-4 text-sm font-medium text-slate-700">{analytics.unassignedLeads} unassigned leads still need ownership</div>
            </button>
          </div>
        </CRMSectionCard>

        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Leads Today" value={String(analytics.leadsToday)} delta={metricDelta(analytics.leadsToday, analytics.leadsYesterday)} note={`Yesterday: ${analytics.leadsYesterday}`} icon={<Users className="h-5 w-5" />} />
          <MetricCard title="Revenue Today" value={formatCurrencyCompactSafe(analytics.revenueToday)} delta={metricDelta(analytics.revenueToday, analytics.revenueYesterday)} note={`Yesterday: ${formatCurrency(analytics.revenueYesterday)}`} icon={<CircleDollarSign className="h-5 w-5" />} />
          <MetricCard title="Deals Created Today" value={String(analytics.dealsToday)} delta={metricDelta(analytics.dealsToday, analytics.dealsYesterday)} note={`Yesterday: ${analytics.dealsYesterday}`} icon={<Funnel className="h-5 w-5" />} />
          <MetricCard title="Accounts Added Today" value={String(analytics.accountsToday)} delta={metricDelta(analytics.accountsToday, analytics.accountsYesterday)} note={`Yesterday: ${analytics.accountsYesterday}`} icon={<Building2 className="h-5 w-5" />} />
        </div>

        <div className="grid items-stretch gap-4 xl:grid-cols-[1.15fr_1fr]">
          <CRMSectionCard title="Lead Generation Target" subtitle={`Live progress for ${monthLabel()}`}>
            <div className="grid items-stretch gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
              <div className="h-[240px]">
                {loading ? (
                  <AnalyticsPlaceholder />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="65%" outerRadius="100%" startAngle={180} endAngle={0} barSize={20} data={analytics.leadGaugeData}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={20} fill="#4f6ecf" background={{ fill: "#e5ebf7" }} />
                      <text x="50%" y="62%" textAnchor="middle" className="fill-slate-900 text-[28px] font-semibold">{analytics.leadsThisMonth}</text>
                      <text x="50%" y="75%" textAnchor="middle" className="fill-slate-500 text-[12px]">Remaining {Math.max(analytics.currentLeadTarget - analytics.leadsThisMonth, 0)}</text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-4 rounded-3xl bg-slate-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Current Month Scorecard</div>
                <ScoreRow label="Leads Created" value={analytics.leadsThisMonth} />
                <ScoreRow label="Contacts Added" value={analytics.contactsThisMonth} />
                <ScoreRow label="Deals Created" value={analytics.dealsCreatedThisMonth} />
                <ScoreRow label="Deals Won" value={analytics.wonDealsThisMonth} />
                <ScoreRow label="Revenue Won" value={formatCurrency(analytics.wonRevenue)} />
                <ScoreRow label="Open Amount" value={formatCurrency(analytics.openAmount)} />
              </div>
            </div>
          </CRMSectionCard>

          <CRMSectionCard title="Revenue Target" subtitle="Won revenue and invoiced revenue against a dynamic monthly goal">
            <div className="h-[240px]">
              {loading ? (
                <AnalyticsPlaceholder />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Achieved", amount: state.revenue_target.achieved },
                      { name: "Won", amount: state.revenue_target.won },
                      { name: "Goal", amount: state.revenue_target.goal },
                    ]}
                    layout="vertical"
                    margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={70} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                    <Bar dataKey="amount" radius={[0, 16, 16, 0]}>
                      {["#9ebcf2", "#4f6ecf", "#dfe6f2"].map((color) => <Cell key={color} fill={color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-500">Target</span>
              <span className="font-semibold text-slate-900">{formatCurrency(state.revenue_target.goal)}</span>
            </div>
          </CRMSectionCard>
        </div>

        <div className="grid items-stretch gap-4 xl:grid-cols-[1fr_1fr]">
          <CRMSectionCard title="Last 7 Days Performance" subtitle="Daily movement across leads, deals, and invoiced revenue">
            <div className="mb-3 flex flex-wrap gap-2 px-4 pt-4">
              <LegendPill label="Leads" color="#4f6ecf" />
              <LegendPill label="Deals" color="#9ebcf2" />
              <LegendPill label="Revenue" color="#76d68a" />
            </div>
            <div className="h-[360px]">
              {loading ? (
                <AnalyticsPlaceholder />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={state.daily_series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="day" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={compactNumber} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip formatter={(value) => value > 999 ? formatCurrency(value) : String(value)} />} />
                    <Bar yAxisId="left" dataKey="leads" fill="#4f6ecf" radius={[10, 10, 0, 0]} name="Leads" />
                    <Bar yAxisId="left" dataKey="deals" fill="#9ebcf2" radius={[10, 10, 0, 0]} name="Deals" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#76d68a" radius={[10, 10, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CRMSectionCard>

          <CRMSectionCard title="Leads By Source" subtitle="Distribution of incoming lead channels">
            <div className="h-[360px]">
              {loading ? (
                <AnalyticsPlaceholder />
              ) : state.lead_sources.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={state.lead_sources} dataKey="value" nameKey="name" innerRadius={72} outerRadius={100} paddingAngle={2} label={false}>
                      {state.lead_sources.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">No lead source data yet.</div>
              )}
            </div>
            {state.lead_sources.length ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {state.lead_sources.slice(0, 6).map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="truncate text-slate-700">{entry.name}</span>
                    </div>
                    <span className="shrink-0 font-semibold text-slate-900">{entry.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </CRMSectionCard>
        </div>

        <CRMSectionCard title="Prolific Sales Owners" subtitle="Top performers by won value">
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <div className="grid min-w-[620px] grid-cols-[1.4fr_1fr_0.8fr] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              <div>Owner</div>
              <div>Won Value</div>
              <div>Deals Won</div>
            </div>
            {state.owner_rows.length ? (
              state.owner_rows.map((row, rowIndex) => (
                <div key={row.owner} className="grid min-w-[620px] grid-cols-[1.4fr_1fr_0.8fr] items-center border-t border-slate-100 px-4 py-4 text-sm">
                  <div className="font-medium text-slate-800">{rowIndex + 1}. {row.owner}</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(row.revenue)}</div>
                  <div className="text-slate-500">{row.won}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-sm text-slate-500">No sales owners have closed won revenue this month yet.</div>
            )}
          </div>
        </CRMSectionCard>

        <div className="grid items-stretch gap-4 xl:grid-cols-[1fr_1fr]">
          <CRMSectionCard title="Pipeline Health" subtitle="Open versus won value from your live deals">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Open Pipeline</div>
                <div className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(state.pipeline_health.open_amount)}</div>
                <div className="mt-2 text-sm text-slate-500">{state.pipeline_health.pipeline_deals} active deals still in motion</div>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Won Revenue</div>
                <div className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(state.pipeline_health.won_revenue)}</div>
                <div className="mt-2 text-sm text-slate-500">{state.pipeline_health.won_deals} deals marked closed won this month</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Conversion</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{state.risk.lead_conversion_rate}%</div>
                <div className="mt-1 text-sm text-slate-500">Lead-to-conversion signal from this month's created leads.</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Collections Risk</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(state.risk.overdue_invoice_amount)}</div>
                <div className="mt-1 text-sm text-slate-500">{state.risk.overdue_invoices} overdue invoices still outstanding.</div>
              </div>
            </div>
          </CRMSectionCard>

          <CRMSectionCard title="Recent Commercial Signals" subtitle="Newest revenue, deal, and lead activity from your CRM">
            <div className="space-y-3">
              {state.recent_signals.length ? (
                state.recent_signals.map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{item.note}</div>
                    </div>
                    <div className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.tone === "alert" ? "bg-rose-100 text-rose-700" : item.tone === "good" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                      {item.time || "Recently"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">Recent sales and invoice activity will appear here once the CRM records update.</div>
              )}
            </div>
          </CRMSectionCard>
        </div>

        <CRMSectionCard title="Top Revenue Accounts" subtitle="Accounts and opportunities contributing the most value right now.">
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <div className="grid min-w-[720px] grid-cols-[1.5fr_1fr_0.8fr_0.9fr] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              <div>Account</div>
              <div>Revenue</div>
              <div>Deals</div>
              <div>Last Touched</div>
            </div>
            {state.top_revenue_accounts.length ? (
              state.top_revenue_accounts.map((row) => (
                <div key={row.name} className="grid min-w-[720px] grid-cols-[1.5fr_1fr_0.8fr_0.9fr] items-center border-t border-slate-100 px-4 py-4 text-sm">
                  <div className="font-medium text-slate-800">{row.name}</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(row.revenue)}</div>
                  <div className="text-slate-500">{row.deals}</div>
                  <div className="text-slate-500">{row.last_touched_days}d ago</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-sm text-slate-500">Revenue-driving accounts will appear here as deals accumulate.</div>
            )}
          </div>
        </CRMSectionCard>
      </div>
    </DashboardLayout>
  );
}
