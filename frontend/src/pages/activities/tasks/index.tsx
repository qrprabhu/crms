import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import ModuleToolbar from "../../../components/crm/ModuleToolbar";
import FilterSidebar from "../../../components/crm/FilterSidebar";
import TasksKanbanBoard, { type TasksKanbanBoardHandle } from "./TasksKanbanBoard";
import type { FilterSection } from "../../../lib/shared/crmTypes";

type FilterMap = Record<string, string>;

const TASK_FILTER_SECTIONS: FilterSection[] = [
  {
    title: "Status",
    items: [{ label: "Status contains", key: "status" }],
  },
  {
    title: "Priority",
    items: [{ label: "Priority contains", key: "priority" }],
  },
  {
    title: "Owner",
    items: [{ label: "Owner name", key: "owner" }],
  },
  {
    title: "Related",
    items: [
      { label: "Related contact / account", key: "related" },
      { label: "Company / Account", key: "company" },
    ],
  },
];

const GROUP_BY_OPTIONS = ["Tasks by Status", "Tasks by Priority", "Tasks by Owner", "Tasks by Due Date"];

export default function TasksPage() {
  const navigate = useNavigate();
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterMap>({});
  const [groupBy, setGroupBy] = useState("Tasks by Status");
  const [groupByOpen, setGroupByOpen] = useState(false);
  const boardRef = useRef<TasksKanbanBoardHandle>(null);

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col">
        {/* Page title */}
        <div className="border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-xl font-semibold text-slate-800">Tasks</h1>
        </div>

        {/* Toolbar */}
        <ModuleToolbar
          viewName="All Tasks"
          createButtonLabel="Create Task"
          showImportActions={false}
          isFilterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((prev) => !prev)}
          onCreateClick={() => navigate("/tasks/create")}
          onMassAction={(action) => {
            if (action === "mass-delete") boardRef.current?.triggerMassDelete();
            if (action === "mass-update") boardRef.current?.triggerMassUpdate();
          }}
        />

        {/* Group-by selector row */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setGroupByOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
            >
              <span>{groupBy}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {groupByOpen && (
              <div className="absolute left-0 top-[38px] z-50 min-w-[200px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {GROUP_BY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setGroupBy(opt); setGroupByOpen(false); }}
                    className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      groupBy === opt ? "font-semibold text-teal-700 bg-teal-50" : "text-slate-700"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>


        </div>

        {/* Board area */}
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden px-4 py-4">
          {filterOpen && (
            <FilterSidebar
              title="Filter Tasks by"
              sections={TASK_FILTER_SECTIONS}
              onApply={(activeFilters) => setFilters(activeFilters)}
              onClear={() => setFilters({})}
            />
          )}

          <div className="min-w-0 flex-1 overflow-auto">
            <TasksKanbanBoard ref={boardRef} filters={filters} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
