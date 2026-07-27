import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import type { Deal } from "../../lib/shared/crmTypes";
import { loadDealLinkedData } from "../../lib/api/linkedRecordsApi";

const DEAL_STAGE_ORDER = [
  "Qualification",
  "Needs Analysis",
  "Value Proposition",
  "Identify Decision Makers",
  "Proposal / Price Quote",
  "Negotiation / Review",
  "Closed Won",
  "Closed Lost",
] as const;

const STAGE_PROBABILITY: Record<(typeof DEAL_STAGE_ORDER)[number], number> = {
  Qualification: 10,
  "Needs Analysis": 20,
  "Value Proposition": 40,
  "Identify Decision Makers": 60,
  "Proposal / Price Quote": 75,
  "Negotiation / Review": 90,
  "Closed Won": 100,
  "Closed Lost": 0,
};

const STAGE_TONE: Record<(typeof DEAL_STAGE_ORDER)[number], string> = {
  Qualification: "border-sky-200 bg-sky-50",
  "Needs Analysis": "border-cyan-200 bg-cyan-50",
  "Value Proposition": "border-indigo-200 bg-indigo-50",
  "Identify Decision Makers": "border-violet-200 bg-violet-50",
  "Proposal / Price Quote": "border-amber-200 bg-amber-50",
  "Negotiation / Review": "border-emerald-200 bg-emerald-50",
  "Closed Won": "border-green-200 bg-green-50",
  "Closed Lost": "border-rose-200 bg-rose-50",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function normalizeStage(stage?: string): (typeof DEAL_STAGE_ORDER)[number] {
  const value = (stage ?? "").trim().toLowerCase();
  if (value === "qualification") return "Qualification";
  if (value === "needs analysis") return "Needs Analysis";
  if (value === "value proposition") return "Value Proposition";
  if (value === "identify decision makers" || value === "id. decision makers") {
    return "Identify Decision Makers";
  }
  if (
    value === "proposal / price quote" ||
    value === "proposal/price quote" ||
    value === "proposal / price quotation"
  ) {
    return "Proposal / Price Quote";
  }
  if (
    value === "negotiation / review" ||
    value === "negotiation/review"
  ) {
    return "Negotiation / Review";
  }
  if (value === "closed won") return "Closed Won";
  if (value === "closed lost" || value === "closed lost to competition") {
    return "Closed Lost";
  }
  return "Qualification";
}

type Props = {
  deals: Deal[];
  loading?: boolean;
};

export default function DealsPipelinePanel({ deals, loading = false }: Props) {
  const navigate = useNavigate();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [linkedData, setLinkedData] = useState<Awaited<ReturnType<typeof loadDealLinkedData>> | null>(null);

  const ownerOptions = useMemo(() => {
    return Array.from(
      new Set(
        deals
          .map((deal) => (deal.dealOwner ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [deals]);

  const [ownerFilter, setOwnerFilter] = useState("all");

  useEffect(() => {
    if (ownerFilter === "all") return;
    if (!ownerOptions.includes(ownerFilter)) {
      setOwnerFilter("all");
    }
  }, [ownerFilter, ownerOptions]);

  useEffect(() => {
    if (!selectedDeal) {
      setLinkedData(null);
      setPreviewError(null);
      return;
    }

    let active = true;
    const loadPreview = async () => {
      try {
        setPreviewLoading(true);
        setPreviewError(null);
        const result = await loadDealLinkedData(selectedDeal, { forceRefresh: true });
        if (!active) return;
        setLinkedData(result);
      } catch (error) {
        if (!active) return;
        setPreviewError(error instanceof Error ? error.message : "Unable to load deal preview.");
      } finally {
        if (active) setPreviewLoading(false);
      }
    };

    void loadPreview();
    return () => {
      active = false;
    };
  }, [selectedDeal]);

  const filteredDeals = useMemo(() => {
    if (ownerFilter === "all") return deals;
    return deals.filter((deal) => (deal.dealOwner ?? "").trim() === ownerFilter);
  }, [deals, ownerFilter]);

  const groupedDeals = useMemo(() => {
    return DEAL_STAGE_ORDER.reduce<Record<(typeof DEAL_STAGE_ORDER)[number], Deal[]>>(
      (acc, stage) => {
        acc[stage] = filteredDeals.filter((deal) => normalizeStage(deal.stage) === stage);
        return acc;
      },
      {} as Record<(typeof DEAL_STAGE_ORDER)[number], Deal[]>
    );
  }, [filteredDeals]);

  const totalOpenValue = filteredDeals
    .filter((deal) => {
      const stage = normalizeStage(deal.stage);
      return stage !== "Closed Won" && stage !== "Closed Lost";
    })
    .reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0);

  const wonDeals = filteredDeals.filter((deal) => normalizeStage(deal.stage) === "Closed Won");
  const wonValue = wonDeals.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0);
  const activeDeals = filteredDeals.filter((deal) => {
    const stage = normalizeStage(deal.stage);
    return stage !== "Closed Won" && stage !== "Closed Lost";
  });
  const closeRate = filteredDeals.length
    ? Math.round((wonDeals.length / filteredDeals.length) * 100)
    : 0;

  return (
    <section className="mb-4 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Deal Pipeline</h2>
            <p className="text-sm text-slate-500">
              Stage-wise visibility with owner focus, without losing any existing deal connections.
            </p>
          </div>

          <div className="w-full lg:w-72">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Deal Owner View
            </label>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-green-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Deal Owners</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Open Pipeline Value"
            value={formatCurrency(totalOpenValue)}
            hint={`${activeDeals.length} active deals`}
          />
          <SummaryCard
            label="Won Value"
            value={formatCurrency(wonValue)}
            hint={`${wonDeals.length} closed won`}
          />
          <SummaryCard
            label="Overall Close Rate"
            value={`${closeRate}%`}
            hint={`${filteredDeals.length} total deals in view`}
          />
          <SummaryCard
            label="Stages Covered"
            value={`${DEAL_STAGE_ORDER.filter((stage) => groupedDeals[stage].length > 0).length}/${DEAL_STAGE_ORDER.length}`}
            hint="Empty stages stay visible for full pipeline clarity"
          />
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {DEAL_STAGE_ORDER.map((stage) => {
          const stageDeals = groupedDeals[stage];
          const total = stageDeals.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0);

          return (
            <div
              key={stage}
              className="min-w-[280px] max-w-[280px] rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className={`rounded-t-2xl border-b border-slate-200 px-4 py-3 ${STAGE_TONE[stage]}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900">{stage}</h3>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {stageDeals.length}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-700">
                  <span>{formatCurrency(total)}</span>
                  <span>{STAGE_PROBABILITY[stage]}%</span>
                </div>
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto p-3">
                {loading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
                    Loading deals...
                  </div>
                ) : stageDeals.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-400">
                    No deals in this stage.
                  </div>
                ) : (
                  stageDeals.map((deal) => (
                    <button
                      key={deal.id}
                      type="button"
                      onClick={() => setSelectedDeal(deal)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-green-50"
                    >
                      <div className="text-lg font-semibold text-slate-900">{deal.dealName}</div>
                      <div className="mt-1 text-sm text-slate-600">{deal.accountName || "No account linked"}</div>
                      <div className="text-sm text-slate-600">{deal.contactName || "No contact linked"}</div>
                      <div className="mt-2 text-sm font-medium text-slate-700">{deal.dealOwner || "Unassigned"}</div>
                      <div className="mt-2 text-base font-semibold text-green-700">
                        {formatCurrency(Number(deal.amount ?? 0))}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        Close: {formatDate(deal.closingDate)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDeal ? (
        <DealPreviewDrawer
          deal={selectedDeal}
          linkedData={linkedData}
          loading={previewLoading}
          error={previewError}
          onClose={() => setSelectedDeal(null)}
          onOpenFull={() => navigate(`/deals/${selectedDeal.id}`)}
        />
      ) : null}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{hint}</div>
    </div>
  );
}

function DealPreviewDrawer({
  deal,
  linkedData,
  loading,
  error,
  onClose,
  onOpenFull,
}: {
  deal: Deal;
  linkedData: Awaited<ReturnType<typeof loadDealLinkedData>> | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25">
      <div className="h-full w-full max-w-[430px] overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deal Preview</div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">{deal.dealName}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {deal.stage} • {deal.dealOwner || "Unassigned"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <PreviewMetric label="Amount" value={formatCurrency(Number(deal.amount ?? 0))} />
            <PreviewMetric label="Close Date" value={formatDate(deal.closingDate)} />
            <PreviewMetric label="Account" value={deal.accountName || "-"} />
            <PreviewMetric label="Contact" value={deal.contactName || "-"} />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onOpenFull}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              View Full Deal
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Loading related records...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : (
            <>
              <RelatedPreviewSection
                title="Products"
                items={(linkedData?.products || []).map((item) => item.productName)}
                emptyMessage="No products linked."
              />
              <RelatedPreviewSection
                title="Quotes"
                items={(linkedData?.quotes || []).map((item) => item.quoteName)}
                emptyMessage="No quotes linked."
              />
              <RelatedPreviewSection
                title="Sales Orders"
                items={(linkedData?.salesOrders || []).map((item) => item.orderNumber)}
                emptyMessage="No sales orders linked."
              />
              <RelatedPreviewSection
                title="Invoices"
                items={(linkedData?.invoices || []).map((item) => item.invoiceNumber)}
                emptyMessage="No invoices linked."
              />
              <RelatedPreviewSection
                title="Cases"
                items={(linkedData?.cases || []).map((item) => `${item.caseNumber} • ${item.subject}`)}
                emptyMessage="No support cases linked."
              />
              <RelatedPreviewSection
                title="Solutions"
                items={(linkedData?.solutions || []).map((item) => item.solutionTitle)}
                emptyMessage="No solutions linked."
              />
              <RelatedPreviewSection
                title="Connected Records"
                items={(linkedData?.connectedRecords || []).map((item) => `${item.recordType} • ${item.name}`)}
                emptyMessage="No additional connected records."
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

function RelatedPreviewSection({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: string[];
  emptyMessage: string;
}) {
  const previewItems = items.slice(0, 4);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {items.length}
          </span>
        </div>
      </div>
      <div className="px-4 py-3">
        {previewItems.length === 0 ? (
          <p className="text-sm text-slate-400">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {previewItems.map((item) => (
              <div key={`${title}-${item}`} className="text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
