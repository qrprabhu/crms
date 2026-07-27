import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { fetchLookupOptions } from "../api";
import type { LookupOption } from "../types";

type InventoryLookupFieldProps = {
  lookup:
    | "products"
    | "vendors"
    | "accounts"
    | "contacts"
    | "deals"
    | "price-books"
    | "quotes"
    | "sales-orders"
    | "purchase-orders";
  label?: string;
  value: string;
  displayValue: string;
  placeholder?: string;
  extraQuery?: Record<string, string | undefined>;
  onChange: (option: LookupOption | null) => void;
  onInputChange?: (value: string) => void;
};

export default function InventoryLookupField({
  lookup,
  value,
  displayValue,
  placeholder,
  extraQuery,
  onChange,
  onInputChange,
}: InventoryLookupFieldProps) {
  const [query, setQuery] = useState(displayValue);
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(displayValue);
  }, [displayValue]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const data = await fetchLookupOptions(lookup, query, extraQuery);
        setOptions(data);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [extraQuery, lookup, open, query]);

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex items-center rounded-[4px] border border-[#cfd7e6] bg-white px-3">
        <Search size={14} className="shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            setOpen(true);
            onInputChange?.(nextValue);
            if (value) {
              onChange(null);
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || "Search..."}
          className="h-[34px] w-full bg-transparent px-2 text-[14px] text-slate-700 outline-none"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[38px] z-40 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-500">Loading options...</div>
          ) : options.length ? (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setQuery(option.label);
                  onInputChange?.(option.label);
                  onChange(option);
                  setOpen(false);
                }}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <div>{option.label}</div>
                {(option.email || option.productCode) && (
                  <div className="break-all text-xs text-slate-500">{option.email || option.productCode}</div>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">No matches found.</div>
          )}
        </div>
      )}
    </div>
  );
}
