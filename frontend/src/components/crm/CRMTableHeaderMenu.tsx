import { SlidersHorizontal } from "lucide-react";
import type { CRMColumn, CRMRecord } from "../../lib/shared/crmTypes";

type CRMTableHeaderMenuProps<T extends CRMRecord> = {
  column: CRMColumn<T>;
  open: boolean;
  filterValue: string;
  onOpen: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onPin: () => void;
  onHide: () => void;
  onToggleFilter: () => void;
  showFilter: boolean;
  onFilterChange: (value: string) => void;
};

export default function CRMTableHeaderMenu<T extends CRMRecord>({
  column,
  open,
  filterValue,
  onOpen,
  onSortAsc,
  onSortDesc,
  onPin,
  onHide,
  onToggleFilter,
  showFilter,
  onFilterChange,
}: CRMTableHeaderMenuProps<T>) {
  const numericSort = column.key.toLowerCase().includes("phone");

  return (
    <div className="relative flex items-center gap-1.5">
      <span>{column.label}</span>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <SlidersHorizontal size={12} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[70] mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 text-[12px] font-medium normal-case tracking-normal text-slate-700 shadow-lg">
          <button onClick={onSortAsc} className="block w-full px-3 py-1.5 text-left hover:bg-slate-50">{numericSort ? "0-9" : "Asc"}</button>
          <button onClick={onSortDesc} className="block w-full px-3 py-1.5 text-left hover:bg-slate-50">{numericSort ? "9-0" : "Desc"}</button>
          <button onClick={onPin} className="block w-full px-3 py-1.5 text-left hover:bg-slate-50">Pin Column</button>
          <button onClick={onToggleFilter} className="block w-full px-3 py-1.5 text-left hover:bg-slate-50">Filter by</button>
          <button onClick={onHide} className="block w-full px-3 py-1.5 text-left hover:bg-slate-50">Hide Column</button>

          {showFilter ? (
            <div className="border-t border-slate-200 px-2 py-2">
              <input
                value={filterValue}
                onChange={(event) => onFilterChange(event.target.value)}
                placeholder={`Filter ${column.label}`}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12px] text-slate-700 outline-none focus:border-green-500"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
