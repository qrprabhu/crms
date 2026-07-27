import { useState } from "react";
import ModuleToolbar from "./ModuleToolbar";
import FilterSidebar from "./FilterSidebar";
import type { FilterSection } from "../../lib/shared/crmTypes";
import TasksKanbanBoard from "../../pages/activities/tasks/TasksKanbanBoard";
type Column = {
  key: string;
  label: string;
  minWidth?: string;
};

type ModulePageLayoutProps = {
  viewName: string;
  createButtonLabel: string;
  filterTitle: string;
  filterSections: FilterSection[];
  columns: Column[];
  data: Record<string, string>[];
  onCreateClick?: () => void;
};

export default function ModulePageLayout({
  viewName,
  createButtonLabel,
  filterTitle,
  filterSections,
  onCreateClick,
}: ModulePageLayoutProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  return (
    <div className="bg-[#f0fdf4]">
        <ModuleToolbar
          viewName={viewName}
          createButtonLabel={createButtonLabel}
          isFilterOpen={isFilterOpen}
          onToggleFilter={() => setIsFilterOpen((prev) => !prev)}
          onCreateClick={onCreateClick ?? (() => {})}
        />

      <div className="flex gap-3 p-3">
        {isFilterOpen && (
          <FilterSidebar title={filterTitle} sections={filterSections} />
        )}

        <div className="flex min-h-[520px] min-w-0 flex-1 items-center justify-center border border-slate-200 bg-white">
          <div className="flex-1">
            <TasksKanbanBoard />
          </div>
        </div>
      </div>
    </div>
  );
}
