import React from "react";

interface DealsToolbarProps {
  setFilters: (filters: any) => void;
}

const DealsToolbar: React.FC<DealsToolbarProps> = ({ setFilters }) => {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-white">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">Deals</h2>
        <input
          type="text"
          placeholder="Search Deals"
          className="border rounded px-2 py-1"
          onChange={(e) => setFilters((f: any) => ({ ...f, search: e.target.value }))}
        />
        <select className="border rounded px-2 py-1">
          <option>Stage View</option>
          <option>List View</option>
        </select>
        <button className="border rounded px-2 py-1">Sort</button>
      </div>
      <button
        className="bg-green-600 text-white px-4 py-2 rounded"
        onClick={() => window.location.href = "/deals/create"}
      >
        Create Deal
      </button>
    </div>
  );
};

export default DealsToolbar;
