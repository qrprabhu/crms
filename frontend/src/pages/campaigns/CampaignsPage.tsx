import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { deleteCampaign, getCampaigns, type CampaignRecord } from "../../lib/api/campaignsApi";
import { keepEmployeeOwnedRows } from "../../lib/shared/recordVisibility";
import { Pencil, Trash2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Planning: "bg-green-100 text-green-700",
  Inactive: "bg-slate-100 text-slate-600",
  Complete: "bg-purple-100 text-purple-700",
};

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CampaignRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setRows(keepEmployeeOwnedRows(await getCampaigns({ search })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [search]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this campaign?")) return;
    try {
      setDeletingId(id);
      await deleteCampaign(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete campaign.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="h-full overflow-hidden bg-[#f0fdf4]">
        <div className="border-b border-[#d9e1ef] bg-[#f0fdf4] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold text-[#1f2d3d]">Campaigns</h1>
              <p className="text-sm text-slate-500">Manage sales campaigns from live CRM data.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns"
                className="h-[38px] w-[240px] rounded-[6px] border border-[#cfd7e6] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#6d8dff]"
              />
              <button
                type="button"
                onClick={() => navigate("/campaigns/create")}
                className="rounded-[6px] border border-[#bbf7d0] bg-[linear-gradient(135deg,#4ade80_0%,#16a34a_100%)] px-4 py-2 text-[14px] font-medium text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)] transition hover:brightness-105"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>

        <div className="h-[calc(100%-57px)] p-4">
          {loading ? (
            <div className="rounded-[10px] border border-[#d9e1ef] bg-white p-4 text-sm text-slate-600">
              Loading campaigns...
            </div>
          ) : error ? (
            <div className="rounded-[10px] border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[10px] border border-[#d9e1ef] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Campaign Name</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Start Date</th>
                    <th className="px-4 py-3">End Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={7}>
                        No campaigns found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                        onClick={() => navigate(`/campaigns/${row.id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-[#2563eb]">{row.campaignName}</td>
                        <td className="px-4 py-3 text-slate-600">{row.campaignOwnerEmail || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.type || "-"}</td>
                        <td className="px-4 py-3">
                          {row.status ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {row.status}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.startDate || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.endDate || "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/campaigns/${row.id}/edit`); }}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => void handleDelete(e, row.id)}
                              disabled={deletingId === row.id}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
