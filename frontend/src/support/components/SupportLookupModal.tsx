import { useEffect, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { fetchSupportLookup } from "../api";
import type { SupportLookupName, SupportLookupOption } from "../types";

type Props = {
  open: boolean;
  title: string;
  lookup: SupportLookupName;
  onClose: () => void;
  onSelect: (option: SupportLookupOption) => void;
};

export default function SupportLookupModal({
  open,
  title,
  lookup,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SupportLookupOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        setOptions(await fetchSupportLookup(lookup, query));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [lookup, open, query]);

  return (
    <CRMModalBase
      open={open}
      title={title}
      maxWidthClassName="max-w-3xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
        >
          Close
        </button>
      }
    >
      <div className="space-y-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="h-[40px] w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500"
        />

        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200">
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Searching...</div>
          ) : options.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No records found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onSelect(option);
                    onClose();
                  }}
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{option.label}</div>
                    <div className="mt-1 break-all text-xs text-slate-500">
                      {[option.email, option.phone, option.accountName, option.productCode]
                        .filter(Boolean)
                        .join(" | ") || "Select this record"}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-green-600">Choose</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </CRMModalBase>
  );
}
