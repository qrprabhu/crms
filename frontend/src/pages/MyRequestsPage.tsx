import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Clock3, Layers3, RefreshCw } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout";
import CRMSectionCard from "../components/crm/CRMSectionCard";
import { useAuth } from "../hooks/useAuth";
import {
  getMyRequestsDashboard,
  type DashboardRequestItem,
  type MyRequestsDashboardResponse,
} from "../lib/api/dashboardApi";
import { readDashboardCache, writeDashboardCache } from "../lib/dashboardCache";

const MY_REQUESTS_CACHE_KEY = "my-requests-cache-v2";
const MY_REQUESTS_CACHE_TTL_MS = 5 * 60 * 1000;

const EMPTY_STATE: MyRequestsDashboardResponse = {
  updated: "",
  summary_cards: { created_today: 0, updated_today: 0, due_today: 0, closed_today: 0 },
  focus_today: { overdue: 0, due_today: 0, pending: 0 },
  request_mix: [],
  open_requests: [],
  upcoming_queue: [],
  closed_history: [],
  pending_approval: [],
};

function toDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value?: string | null) {
  const parsed = toDate(value);
  if (!parsed) return "N/A";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUpdatedAt(value?: string | null) {
  const parsed = toDate(value);
  if (!parsed) return "Not updated yet";
  const seconds = Math.max(1, Math.round((Date.now() - parsed.getTime()) / 1000));
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.round(hours / 24)}d ago`;
}

function statusTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("pending")) return "bg-amber-100 text-amber-800";
  if (["closed", "completed", "resolved", "done"].some((token) => normalized.includes(token))) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized.includes("overdue")) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function RequestList({ items, emptyText }: { items: DashboardRequestItem[]; emptyText: string }) {
  if (!items.length) {
    return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.href}
          className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-slate-900">{item.title}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</span>
              </div>
              <div className="mt-2 text-sm text-slate-600">{item.module}</div>
              <div className="mt-1 text-sm leading-6 text-slate-500">{item.meta}</div>
            </div>
            <div className="shrink-0 text-right text-xs text-slate-500">
              <div>{item.priority || "Standard"}</div>
              <div className="mt-1">{formatDateTime(item.updated_at || item.created_at || item.due_at)}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function MyRequestsPage() {
  const { user } = useAuth();
  const [initialCache] = useState(() => readDashboardCache<MyRequestsDashboardResponse>(MY_REQUESTS_CACHE_KEY, MY_REQUESTS_CACHE_TTL_MS));
  const [loading, setLoading] = useState(!initialCache?.state);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<MyRequestsDashboardResponse>(initialCache?.state ?? EMPTY_STATE);

  useEffect(() => {
    let active = true;
    const hasCachedState = Boolean(initialCache?.state);

    const load = async () => {
      try {
        setError(null);
        setLoading(!hasCachedState);
        setRefreshing(hasCachedState || refreshKey > 0);
        const nextState = await getMyRequestsDashboard(2 * 60 * 1000);
        if (!active) return;
        setState(nextState);
        writeDashboardCache(MY_REQUESTS_CACHE_KEY, nextState);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load your requests.");
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

  if (error) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600">{error}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        <div className="relative overflow-hidden rounded-[34px] border border-[#d6d9f6] bg-[linear-gradient(135deg,#faf8ff_0%,#f1efff_46%,#ffffff_100%)] shadow-[0_18px_42px_rgba(101,87,180,0.10)]">
          <div className="pointer-events-none absolute -right-6 top-0 h-40 w-40 rounded-full bg-violet-300/25 blur-3xl" />
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700">Personal Queue</div>
              <h1 className="mt-2 text-[2.1rem] font-semibold tracking-[-0.04em] text-slate-950">My Requests</h1>
              <p className="mt-1 text-sm text-slate-500">
                Daily requests assigned to {user?.name || user?.email || "you"} across tasks, meetings, support, and services.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700">
                {formatUpdatedAt(state.updated)}
              </div>
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

          <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Created Today</span>
                <ClipboardList className="h-5 w-5 text-slate-500" />
              </div>
              <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{loading ? "..." : state.summary_cards.created_today}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Updated Today</span>
                <Layers3 className="h-5 w-5 text-slate-500" />
              </div>
              <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{loading ? "..." : state.summary_cards.updated_today}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Due Today</span>
                <CalendarDays className="h-5 w-5 text-slate-500" />
              </div>
              <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{loading ? "..." : state.summary_cards.due_today}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Closed Today</span>
                <CheckCircle2 className="h-5 w-5 text-slate-500" />
              </div>
              <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{loading ? "..." : state.summary_cards.closed_today}</div>
            </div>
          </div>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-rose-200 bg-[linear-gradient(180deg,#fff9f9_0%,#fff2f3_100%)] px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Overdue</div>
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{state.focus_today.overdue}</div>
            <div className="mt-2 text-sm text-slate-500">Requests that need immediate attention.</div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-[linear-gradient(180deg,#fffdf7_0%,#fff8ea_100%)] px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Due Today</div>
              <Clock3 className="h-5 w-5 text-amber-600" />
            </div>
            <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{state.focus_today.due_today}</div>
            <div className="mt-2 text-sm text-slate-500">Queue items expected to move before today ends.</div>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-[linear-gradient(180deg,#fbf9ff_0%,#f4efff_100%)] px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Pending</div>
              <ClipboardList className="h-5 w-5 text-violet-600" />
            </div>
            <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{state.focus_today.pending}</div>
            <div className="mt-2 text-sm text-slate-500">Approvals or waiting states that may block progress.</div>
          </div>
        </div>

        <CRMSectionCard title="Request Mix" subtitle="Current distribution across your assigned CRM work.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {state.request_mix.map((item) => (
              <div key={item.module} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">{item.module}</div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{item.count}</div>
              </div>
            ))}
          </div>
        </CRMSectionCard>

        <div className="grid items-start gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <CRMSectionCard title="Open Requests" subtitle="Active work that currently needs your attention.">
            <RequestList items={state.open_requests} emptyText="No open requests assigned right now." />
          </CRMSectionCard>

          <CRMSectionCard title="Upcoming Queue" subtitle="What is scheduled next in your request pipeline.">
            <RequestList items={state.upcoming_queue} emptyText="No upcoming queue items scheduled yet." />
          </CRMSectionCard>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[1fr_1fr]">
          <CRMSectionCard title="Closed History" subtitle="Recently completed request history for today and recent cycles.">
            <RequestList items={state.closed_history} emptyText="No recently closed request history available." />
          </CRMSectionCard>

          <CRMSectionCard title="Pending Approval" subtitle="Requests still waiting on confirmation, input, or review.">
            <RequestList items={state.pending_approval} emptyText="No pending approval items right now." />
          </CRMSectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
