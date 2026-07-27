import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, ChevronRight, Plus, UserCog, ChevronDown, X,
} from "lucide-react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { readDashboardCache, writeDashboardCache, removeDashboardCache } from "../../lib/dashboardCache";

type TeamMember = {
  id: number;
  email: string;
  role: "admin" | "manager" | "employee";
  is_active: boolean;
  manager: number | null;
  manager_email: string | null;
  name?: string;
};

type LeadItem = {
  id: number;
  first_name: string;
  last_name: string;
  company: string;
  email?: string;
  owner: number | null;
  owner_name?: string | null;
};

type ApiList<T> = {
  results?: T[];
};

const MANAGER_DASHBOARD_CACHE_KEY = "manager-dashboard-cache-v1";
const MANAGER_DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
const TEAM_UPDATED_EVENT = "team:updated";

function RoleBadge({ role }: { role: string }) {
  const cls =
    role === "admin" ? "bg-green-100 text-green-700"
    : role === "manager" ? "bg-violet-100 text-violet-700"
    : "bg-emerald-100 text-emerald-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
      {role}
    </span>
  );
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [initialCache] = useState(() => readDashboardCache<TeamMember[]>(MANAGER_DASHBOARD_CACHE_KEY, MANAGER_DASHBOARD_CACHE_TTL_MS));
  const [members, setMembers] = useState<TeamMember[]>(initialCache?.state ?? []);
  const [loading, setLoading] = useState(!initialCache?.state);
  const [refreshKey, setRefreshKey] = useState(0);
  const [projectDeskOpen, setProjectDeskOpen] = useState(false);
  const [assigningEmployee, setAssigningEmployee] = useState<TeamMember | null>(null);
  const [leadOptions, setLeadOptions] = useState<LeadItem[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [leadSearch, setLeadSearch] = useState("");

  useEffect(() => {
    let active = true;
    const shouldFetch = refreshKey > 0 || !initialCache?.state;

    if (!shouldFetch) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    apiRequest<TeamMember[]>("/auth/manage-users/")
      .then((data) => {
        if (!active) return;
        const nextMembers = Array.isArray(data) ? data.filter((u) => u.role === "employee") : [];
        setMembers(nextMembers);
        writeDashboardCache(MANAGER_DASHBOARD_CACHE_KEY, nextMembers);
      })
      .catch(() => { if (active) setMembers([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialCache?.state, refreshKey]);

  useEffect(() => {
    const refresh = () => {
      removeDashboardCache(MANAGER_DASHBOARD_CACHE_KEY);
      setRefreshKey((k) => k + 1);
    };

    window.addEventListener(TEAM_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(TEAM_UPDATED_EVENT, refresh);
  }, []);

  const openProjectTaskDesk = async () => {
    setProjectDeskOpen(false);
    try {
      const response = await apiRequest("/projects/");
      const projects = Array.isArray(response)
        ? response
        : ((response as { results?: Array<{ id: string | number }> }).results ?? []);

      if (projects.length > 0) {
        navigate(`/projectdesk/tasks/create?project=${projects[0].id}`);
        return;
      }
    } catch {
      // Fall through to project creation if loading projects fails.
    }

    navigate("/projects/create");
  };

  const openProjectMeetingDesk = async () => {
    setProjectDeskOpen(false);
    try {
      const response = await apiRequest("/projects/");
      const projects = Array.isArray(response)
        ? response
        : ((response as { results?: Array<{ id: string | number }> }).results ?? []);

      if (projects.length > 0) {
        navigate(`/projectdesk/meetings/create?project=${projects[0].id}`);
        return;
      }
    } catch {
      // Fall through to project creation if loading projects fails.
    }

    navigate("/projects/create");
  };

  const openAssignLeadModal = (employee: TeamMember) => {
    setAssigningEmployee(employee);
    setSelectedLeadIds([]);
    setAssignError("");
    setLeadSearch("");
    setLoadingLeads(true);
    apiRequest<LeadItem[] | ApiList<LeadItem>>("/leads/", {
      query: { page_size: 200 },
      cacheTtlMs: 0,
      forceFresh: true,
    })
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.results ?? []);
        setLeadOptions(items);
      })
      .catch((err) => {
        setAssignError(err instanceof Error ? err.message : "Failed to load leads.");
        setLeadOptions([]);
      })
      .finally(() => setLoadingLeads(false));
  };

  const closeAssignLeadModal = () => {
    if (savingAssignment) return;
    setAssigningEmployee(null);
    setLeadOptions([]);
    setSelectedLeadIds([]);
    setAssignError("");
    setLeadSearch("");
    setLoadingLeads(false);
  };

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeadIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
    );
  };

  const visibleLeadOptions = useMemo(() => {
    const currentUserId = Number(user?.id);
    if (!assigningEmployee) return [];
    return leadOptions.filter(
      (lead) =>
        lead.owner == null ||
        lead.owner === currentUserId ||
        lead.owner === assigningEmployee.id
    );
  }, [assigningEmployee, leadOptions, user?.id]);

  const assignedLeadOptions = useMemo(() => {
    if (!assigningEmployee) return [];
    return visibleLeadOptions.filter((lead) => lead.owner === assigningEmployee.id);
  }, [assigningEmployee, visibleLeadOptions]);

  const availableLeadOptions = useMemo(() => {
    if (!assigningEmployee) return [];
    return visibleLeadOptions.filter((lead) => lead.owner == null);
  }, [assigningEmployee, visibleLeadOptions]);

  const reassignLeadOptions = useMemo(() => {
    if (!assigningEmployee) return [];
    return leadOptions.filter(
      (lead) =>
        lead.owner != null &&
        lead.owner !== assigningEmployee.id
    );
  }, [assigningEmployee, leadOptions]);

  const matchesLeadSearch = (lead: LeadItem) => {
    const query = leadSearch.trim().toLowerCase();
    if (!query) return true;
    const leadName = `${lead.first_name} ${lead.last_name}`.trim().toLowerCase();
    const company = (lead.company || "").toLowerCase();
    const ownerName = (lead.owner_name || "").toLowerCase();
    return leadName.includes(query) || company.includes(query) || ownerName.includes(query);
  };

  const filteredAssignedLeadOptions = assignedLeadOptions.filter(matchesLeadSearch);
  const filteredAvailableLeadOptions = availableLeadOptions.filter(matchesLeadSearch);
  const filteredReassignLeadOptions = reassignLeadOptions.filter(matchesLeadSearch);
  const hasAnyLeadOptions =
    filteredAssignedLeadOptions.length > 0 ||
    filteredAvailableLeadOptions.length > 0 ||
    filteredReassignLeadOptions.length > 0;

  const handleAssignLeads = async () => {
    if (!assigningEmployee || selectedLeadIds.length === 0) return;
    setSavingAssignment(true);
    setAssignError("");
    try {
      await Promise.all(
        selectedLeadIds.map((leadId) =>
          apiRequest(`/leads/${leadId}/`, {
            method: "PATCH",
            body: JSON.stringify({ owner: assigningEmployee.id }),
          })
        )
      );
      const assignedEmployee = assigningEmployee;
      setLeadOptions((current) =>
        current.map((lead) =>
          selectedLeadIds.includes(lead.id)
            ? {
                ...lead,
                owner: assignedEmployee.id,
                owner_name: assignedEmployee.name || assignedEmployee.email,
              }
            : lead
        )
      );
      window.dispatchEvent(new Event(TEAM_UPDATED_EVENT));
      closeAssignLeadModal();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to assign leads.");
    } finally {
      setSavingAssignment(false);
    }
  };

  const selectableLeadIds = [
    ...filteredAvailableLeadOptions.map((lead) => lead.id),
    ...filteredReassignLeadOptions.map((lead) => lead.id),
  ];

  const allSelectableMarked =
    selectableLeadIds.length > 0 && selectableLeadIds.every((id) => selectedLeadIds.includes(id));

  const handleToggleMarkAll = () => {
    if (allSelectableMarked) {
      setSelectedLeadIds((current) => current.filter((id) => !selectableLeadIds.includes(id)));
      return;
    }

    setSelectedLeadIds((current) => [...new Set([...current, ...selectableLeadIds])]);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCog size={18} className="text-violet-600" />
            <h1 className="text-xl font-bold text-slate-900">My Team</h1>
          </div>
          <p className="text-sm text-slate-500">
            {members.length} employee{members.length !== 1 ? "s" : ""} reporting to you
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setProjectDeskOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              ProjectDesk
              <ChevronDown size={15} className={`transition ${projectDeskOpen ? "rotate-180" : ""}`} />
            </button>
            {projectDeskOpen && (
              <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    void openProjectTaskDesk();
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Assign Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void openProjectMeetingDesk();
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Schedule Meeting
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate("/team/users/create")}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
          >
            <Plus size={15} />
            Add Employee
          </button>

        </div>
      </div>

      {/* Stat card */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
            <Users size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{loading ? "..." : members.length}</p>
            <p className="text-xs font-medium text-slate-500">My Employees</p>
          </div>
        </div>
      </div>

      {/* Team list */}
      <h2 className="mb-3 text-sm font-semibold text-slate-600 uppercase tracking-wide">
        Team Members
      </h2>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="space-y-0">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center justify-between border-b border-slate-100 px-5 py-4 last:border-b-0">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Users size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No employees assigned to you yet.</p>
          <button
            type="button"
            onClick={() => navigate("/team/users/create")}
            className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Add First Employee
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {members.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => navigate(`/team/user/${emp.id}`)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 uppercase">
                    {emp.email[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 truncate max-w-[240px]">
                      {emp.email}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {emp.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openAssignLeadModal(emp);
                    }}
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                  >
                    Assign Leads
                  </button>
                  <RoleBadge role={emp.role} />
                  <ChevronRight size={15} className="text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {assigningEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Assign Leads</h2>
                <p className="text-sm text-slate-500">
                  Assign selected leads to {assigningEmployee.name || assigningEmployee.email}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAssignLeadModal}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close assign leads dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {assignError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {assignError}
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={leadSearch}
                    onChange={(event) => setLeadSearch(event.target.value)}
                    placeholder="Filter leads by name, company, or owner"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                  />
                  <button
                    type="button"
                    onClick={handleToggleMarkAll}
                    disabled={selectableLeadIds.length === 0}
                    className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {allSelectableMarked ? "Unmark All" : "Mark All"}
                  </button>
                </div>
              </div>

              {loadingLeads ? (
                <div className="py-8 text-center text-sm text-slate-500">Loading leads...</div>
              ) : !hasAnyLeadOptions ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No matching leads are available right now.
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assigned To This Employee
                    </div>
                    {filteredAssignedLeadOptions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                        No leads assigned yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredAssignedLeadOptions.map((lead) => {
                          const leadName = `${lead.first_name} ${lead.last_name}`.trim();
                          return (
                            <div
                              key={`assigned-${lead.id}`}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                            >
                              <p className="text-sm font-semibold text-slate-900">
                                {leadName || lead.email || `Lead #${lead.id}`}
                              </p>
                              <p className="text-sm text-slate-600">{lead.company || "No company"}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <p className="text-xs text-slate-400">
                                  Current owner: {lead.owner_name || assigningEmployee.email}
                                </p>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  Assigned
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Available To Assign
                    </div>
                    {filteredAvailableLeadOptions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                        No additional leads available.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredAvailableLeadOptions.map((lead) => {
                    const checked = selectedLeadIds.includes(lead.id);
                    const leadName = `${lead.first_name} ${lead.last_name}`.trim();
                    return (
                      <label
                        key={lead.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                          checked ? "border-violet-300 bg-violet-50" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLeadSelection(lead.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {leadName || lead.email || `Lead #${lead.id}`}
                          </p>
                          <p className="text-sm text-slate-600">{lead.company || "No company"}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <p className="text-xs text-slate-400">
                              Current owner: {lead.owner_name || "Unassigned"}
                            </p>
                            {!lead.owner && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                Unassigned lead
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reassign From Another Employee
                    </div>
                    {filteredReassignLeadOptions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                        No reassignment candidates available.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredReassignLeadOptions.map((lead) => {
                          const checked = selectedLeadIds.includes(lead.id);
                          const leadName = `${lead.first_name} ${lead.last_name}`.trim();
                          return (
                            <label
                              key={`reassign-${lead.id}`}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                                checked ? "border-violet-300 bg-violet-50" : "border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleLeadSelection(lead.id)}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">
                                  {leadName || lead.email || `Lead #${lead.id}`}
                                </p>
                                <p className="text-sm text-slate-600">{lead.company || "No company"}</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <p className="text-xs text-slate-400">
                                    Current owner: {lead.owner_name || "Assigned"}
                                  </p>
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                                    Reassign
                                  </span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              <p className="text-sm text-slate-500">
                {selectedLeadIds.length} lead{selectedLeadIds.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeAssignLeadModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleAssignLeads();
                  }}
                  disabled={savingAssignment || selectedLeadIds.length === 0}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAssignment ? "Assigning..." : "Assign Leads"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
