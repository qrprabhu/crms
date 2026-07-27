import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Filter } from "lucide-react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import FilterSidebar from "../../../components/crm/FilterSidebar";
import { apiRequest } from "../../../api/client";
import type { FilterSection } from "../../../lib/shared/crmTypes";

type FilterMap = Record<string, string>;

const MEETING_FILTER_SECTIONS: FilterSection[] = [
  {
    title: "Status",
    items: [{ label: "Status contains", key: "status" }],
  },
  {
    title: "Organizer",
    items: [{ label: "Organizer name", key: "organizer" }],
  },
  {
    title: "Related",
    items: [
      { label: "Related contact/account", key: "related" },
      { label: "Company / Account", key: "company" },
    ],
  },
];

interface Meeting {
  id: string | number;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  organizer?: { id?: number; name?: string; email?: string };
  contact_name?: string;
  account_name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

function formatDate(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-US", { 
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setFilters] = useState<FilterMap>({});

  useEffect(() => {
    let isMounted = true;
    if (!id) {
      setError("Invalid meeting identifier.");
      setLoading(false);
      return;
    }

    const fetchMeeting = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await apiRequest<Meeting>(`/meetings/${id}/`);
        if (isMounted) {
          setMeeting(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load meeting.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchMeeting();
    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <DashboardLayout>
      <div className="px-6 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate("/meetings")}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Back to meetings
          </button>
          <div className="flex items-center gap-3">
            {id && (
              <button
                type="button"
                onClick={() => navigate(`/meetings/${id}/edit`)}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Edit Meeting
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterOpen((prev) => !prev)}
              className={`flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition duration-150 hover:bg-slate-50 ${
                filterOpen ? "bg-slate-100 shadow-sm" : "bg-white"
              }`}
            >
              <Filter size={16} />
              <span>Filters</span>
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          {filterOpen && (
            <FilterSidebar
              title="Filter Meetings by"
              sections={MEETING_FILTER_SECTIONS}
              onApply={(activeFilters) => setFilters(activeFilters)}
              onClear={() => setFilters({})}
            />
          )}

          <div className="flex-1">
            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-3 text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Loading meeting...</span>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : (
              meeting && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h1 className="mb-6 text-2xl font-semibold text-slate-900">{meeting.title}</h1>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1 text-sm text-slate-600">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Start Date
                        </p>
                        <p className="text-base font-medium text-slate-900">{formatDate(meeting.start_date)}</p>
                      </div>

                      <div className="space-y-1 text-sm text-slate-600">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          End Date
                        </p>
                        <p className="text-base font-medium text-slate-900">{formatDate(meeting.end_date)}</p>
                      </div>

                      <div className="space-y-1 text-sm text-slate-600">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Location
                        </p>
                        <p className="text-base font-medium text-slate-900">{meeting.location || "N/A"}</p>
                      </div>

                      <div className="space-y-1 text-sm text-slate-600">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Status
                        </p>
                        <p className="text-base font-medium text-slate-900">{meeting.status || "Scheduled"}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Organizer
                        </p>
                        <p className="text-base font-medium text-slate-900">
                          {meeting.organizer?.name ?? "Unassigned"}
                        </p>
                        {meeting.organizer?.email && (
                          <p className="text-xs text-slate-500">{meeting.organizer.email}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Contact
                        </p>
                        <p className="text-base font-medium text-slate-900">
                          {meeting.contact_name || "None"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                          Account
                        </p>
                        <p className="text-base font-medium text-slate-900">
                          {meeting.account_name || "None"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                        Description
                      </p>
                      <p className="text-sm text-slate-700">{meeting.description || "No description provided."}</p>
                    </div>

                    <div className="mt-6 flex gap-2 border-t border-slate-200 pt-6">
                      <p className="text-xs text-slate-500">
                        Created: {formatDate(meeting.created_at)} | Updated: {formatDate(meeting.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
