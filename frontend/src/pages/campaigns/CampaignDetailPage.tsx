import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import {
  bulkConvertSubmissions,
  convertSubmissionToLead,
  getCampaignById,
  getCampaignSubmissions,
  type CampaignRecord,
  type CampaignSubmission,
} from "../../lib/api/campaignsApi";
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  Users,
  X,
} from "lucide-react";

type FilterTab = "all" | "not_converted" | "converted";

function StatusBadge({ converted }: { converted: boolean }) {
  return converted ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <CheckCircle size={11} /> Converted
    </span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      New Submission
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="w-36 shrink-0 text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || "-"}</span>
    </div>
  );
}

function SubmissionDetailModal({
  submission,
  onClose,
}: {
  submission: CampaignSubmission;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-[12px] bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[#1f2d3d]">Submission Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <InfoRow label="Name" value={`${submission.firstName} ${submission.lastName}`} />
          <InfoRow label="Email" value={submission.email} />
          <InfoRow label="Phone" value={submission.phone} />
          <InfoRow label="Company" value={submission.company} />
          <InfoRow label="Notes" value={submission.notes} />
          <InfoRow label="Source" value={submission.source} />
          <InfoRow
            label="Submitted At"
            value={new Date(submission.submittedAt).toLocaleString()}
          />
          <div className="flex gap-2">
            <span className="w-36 shrink-0 text-slate-500">Status</span>
            <StatusBadge converted={submission.isConverted} />
          </div>
          {submission.isConverted && submission.convertedLead && (
            <InfoRow label="Lead ID" value={String(submission.convertedLead)} />
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-[6px] border border-[#cfd7e6] px-5 py-1.5 text-[14px] text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [submissions, setSubmissions] = useState<CampaignSubmission[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [converting, setConverting] = useState<Set<number>>(new Set());
  const [bulkConverting, setBulkConverting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [detailSub, setDetailSub] = useState<CampaignSubmission | null>(null);
  const [copied, setCopied] = useState(false);

  // Public form URL — includes tenant so anyone with the link can submit
  const publicFormUrl = `${window.location.origin}/public/campaigns/${id}/form`;

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadCampaign = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getCampaignById(id);
      setCampaign(data);
    } catch {
      setError("Failed to load campaign.");
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async (f: FilterTab = filter) => {
    if (!id) return;
    try {
      setSubLoading(true);
      const data = await getCampaignSubmissions(id, f);
      setSubmissions(data);
      setSelected(new Set());
    } catch {
      showToast("error", "Failed to load submissions.");
    } finally {
      setSubLoading(false);
    }
  };

  useEffect(() => { void loadCampaign(); }, [id]);
  useEffect(() => { void loadSubmissions(filter); }, [id, filter]);

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(publicFormUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleSelect = (subId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(subId) ? next.delete(subId) : next.add(subId);
      return next;
    });
  };

  const toggleAll = () => {
    const unconverted = submissions.filter((s) => !s.isConverted).map((s) => s.id);
    if (selected.size === unconverted.length && unconverted.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unconverted));
    }
  };

  const handleConvertOne = async (sub: CampaignSubmission) => {
    if (sub.isConverted) return;
    try {
      setConverting((p) => new Set(p).add(sub.id));
      const res = await convertSubmissionToLead(sub.id);
      showToast("success", `Lead #${res.lead_id} created successfully.`);
      void loadSubmissions(filter);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setConverting((p) => { const n = new Set(p); n.delete(sub.id); return n; });
    }
  };

  const handleBulkConvert = async () => {
    if (!id || selected.size === 0) return;
    try {
      setBulkConverting(true);
      const res = await bulkConvertSubmissions(id, Array.from(selected));
      const succeeded = res.results.filter((r) => r.success).length;
      const failed = res.results.filter((r) => !r.success);
      const msgs = failed.map((f) => `#${f.id}: ${f.error}`).join("; ");
      showToast(
        failed.length === 0 ? "success" : "error",
        failed.length === 0
          ? `${succeeded} lead(s) created.`
          : `${succeeded} created, ${failed.length} failed — ${msgs}`
      );
      void loadSubmissions(filter);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Bulk conversion failed.");
    } finally {
      setBulkConverting(false);
    }
  };

  const unconvertedSelectedCount = submissions.filter(
    (s) => !s.isConverted && selected.has(s.id)
  ).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center text-slate-500 text-sm">
          Loading campaign...
        </div>
      </DashboardLayout>
    );
  }

  if (error || !campaign) {
    return (
      <DashboardLayout>
        <div className="p-6 text-red-600 text-sm">{error ?? "Campaign not found."}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto bg-[#f0fdf4]">
        {/* Header */}
        <div className="border-b border-[#d9e1ef] bg-[#f0fdf4] px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/campaigns")}
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-[18px] font-semibold text-[#1f2d3d]">
                  {campaign.campaignName}
                </h1>
                <p className="text-xs text-slate-500">Campaign Detail</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/campaigns/${id}/edit`)}
              className="h-[32px] rounded-[6px] border border-[#cfd7e6] bg-white px-5 text-[14px] text-[#334155] hover:bg-slate-50"
            >
              Edit Campaign
            </button>
          </div>
        </div>

        <div className="space-y-4 p-6">
          {/* Toast */}
          {toast && (
            <div
              className={`rounded-[8px] px-4 py-3 text-sm ${
                toast.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-red-200 bg-red-50 text-red-600"
              }`}
            >
              {toast.msg}
            </div>
          )}

          {/* Campaign Info */}
          <div className="rounded-[10px] border border-[#d9e1ef] bg-white p-5">
            <h2 className="mb-4 text-[13px] font-semibold text-[#1f2d3d]">Campaign Information</h2>
            <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
              <InfoRow label="Campaign Name" value={campaign.campaignName} />
              <InfoRow label="Type" value={campaign.type} />
              <InfoRow label="Status" value={campaign.status} />
              <InfoRow label="Start Date" value={campaign.startDate} />
              <InfoRow label="End Date" value={campaign.endDate} />
              <InfoRow label="Expected Revenue" value={campaign.expectedRevenue ? `Rs. ${campaign.expectedRevenue}` : undefined} />
              <InfoRow label="Budgeted Cost" value={campaign.budgetedCost ? `Rs. ${campaign.budgetedCost}` : undefined} />
              <InfoRow label="Owner" value={campaign.campaignOwnerEmail} />
            </div>
            {campaign.description && (
              <div className="mt-3 text-sm">
                <span className="text-slate-500">Description: </span>
                <span className="text-slate-800">{campaign.description}</span>
              </div>
            )}
          </div>

          {/* Public Form Link */}
          <div className="rounded-[10px] border border-[#d9e1ef] bg-white p-5">
            <h2 className="mb-3 text-[13px] font-semibold text-[#1f2d3d]">Public Form Link</h2>
            <p className="mb-3 text-sm text-slate-500">
              Share this link to collect responses. Submissions will appear below for your review.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={publicFormUrl}
                className="flex-1 rounded-[6px] border border-[#cfd7e6] bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-[6px] border border-[#cfd7e6] bg-white px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50"
              >
                <ClipboardCopy size={14} />
                {copied ? "Copied!" : "Copy"}
              </button>
              <a
                href={publicFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-[6px] border border-[#cfd7e6] bg-white px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink size={14} /> Open
              </a>
            </div>
          </div>

          {/* Submissions */}
          <div className="rounded-[10px] border border-[#d9e1ef] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9e1ef] px-5 py-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-slate-500" />
                <h2 className="text-[13px] font-semibold text-[#1f2d3d]">Form Submissions</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {submissions.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Filter tabs */}
                {(["all", "not_converted", "converted"] as FilterTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    className={`rounded-[6px] px-3 py-1.5 text-[13px] ${
                      filter === tab
                        ? "bg-[#22c55e] text-white"
                        : "border border-[#cfd7e6] bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {tab === "all" ? "All" : tab === "not_converted" ? "Pending" : "Converted"}
                  </button>
                ))}
                {selected.size > 0 && (
                  <button
                    onClick={() => void handleBulkConvert()}
                    disabled={bulkConverting || unconvertedSelectedCount === 0}
                    className="flex items-center gap-1.5 rounded-[6px] bg-gradient-to-b from-[#22c55e] to-[#16a34a] px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-60"
                  >
                    {bulkConverting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <ChevronDown size={13} />
                    )}
                    Convert Selected ({unconvertedSelectedCount})
                  </button>
                )}
              </div>
            </div>

            {subLoading ? (
              <div className="px-5 py-6 text-sm text-slate-500">Loading submissions...</div>
            ) : submissions.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                No submissions yet. Share the public form link to start collecting responses.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          onChange={toggleAll}
                          checked={
                            selected.size > 0 &&
                            selected.size ===
                              submissions.filter((s) => !s.isConverted).length
                          }
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Submitted At</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr
                        key={sub.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            disabled={sub.isConverted}
                            checked={selected.has(sub.id)}
                            onChange={() => toggleSelect(sub.id)}
                            className="rounded disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {sub.firstName} {sub.lastName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{sub.email}</td>
                        <td className="px-4 py-3 text-slate-600">{sub.phone || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{sub.company || "-"}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(sub.submittedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge converted={sub.isConverted} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setDetailSub(sub)}
                              className="rounded border border-[#cfd7e6] px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              View
                            </button>
                            {!sub.isConverted && (
                              <button
                                onClick={() => void handleConvertOne(sub)}
                                disabled={converting.has(sub.id)}
                                className="flex items-center gap-1 rounded bg-gradient-to-b from-[#22c55e] to-[#16a34a] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                              >
                                {converting.has(sub.id) ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : null}
                                Convert to Lead
                              </button>
                            )}
                            {sub.isConverted && sub.convertedLead && (
                              <button
                                onClick={() => navigate(`/leads/${sub.convertedLead}`)}
                                className="rounded border border-emerald-300 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                              >
                                View Lead
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {detailSub && (
        <SubmissionDetailModal submission={detailSub} onClose={() => setDetailSub(null)} />
      )}
    </DashboardLayout>
  );
}
