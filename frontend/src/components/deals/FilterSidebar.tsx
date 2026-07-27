import React from "react";
import { dealOwners } from "../../lib/mock/dealOwners";
import { dealStages } from "../../lib/mock/dealStages";

interface FilterSidebarProps {
  filters: any;
  setFilters: (filters: any) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ filters, setFilters }) => {
  return (
    <aside className="w-64 p-4 border-r bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">Filters</h3>
      <input
        type="text"
        placeholder="Search Deals"
        className="border rounded px-2 py-1 mb-2 w-full"
        value={filters.search || ""}
        onChange={(e) => setFilters((f: any) => ({ ...f, search: e.target.value }))}
      />
      <div className="mb-2">
        <label>Deal Owner</label>
        <select
          className="border rounded px-2 py-1 w-full"
          value={filters.ownerId || ""}
          onChange={(e) => setFilters((f: any) => ({ ...f, ownerId: e.target.value }))}
        >
          <option value="">All</option>
          {dealOwners.map((owner) => (
            <option key={owner.id} value={owner.id}>{owner.name}</option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <label>Stage</label>
        <select
          className="border rounded px-2 py-1 w-full"
          value={filters.stage || ""}
          onChange={(e) => setFilters((f: any) => ({ ...f, stage: e.target.value }))}
        >
          <option value="">All</option>
          {dealStages.map((stage) => (
            <option key={stage} value={stage}>{stage}</option>
          ))}
        </select>
      </div>
      {/* Add more filters as needed */}
    </aside>
  );
};

export default FilterSidebar;
