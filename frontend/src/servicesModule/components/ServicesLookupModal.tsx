import { useEffect, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { listLookupOptions } from "../api";
import type { LookupOption, ServicesLookupType } from "../types";

type Props = {
  open: boolean;
  type: ServicesLookupType;
  onClose: () => void;
  onSelect: (option: LookupOption) => void;
};

export default function ServicesLookupModal({ open, type, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || type === "other") return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setRows(await listLookupOptions(type as any, query));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load records.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [open, query, type]);

  return (
    <CRMModalBase
      open={open}
      title={`Choose ${type}`}
      footer={
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
          Close
        </button>
      }
      maxWidthClassName="max-w-3xl"
    >
      <div className="space-y-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm" />
        {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}
        {error ? <div className="text-sm text-rose-600">{error}</div> : null}
        <div className="max-h-[360px] space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                onSelect(row);
                onClose();
              }}
              className="block w-full rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
            >
              <div className="text-sm font-medium text-slate-800">{row.label}</div>
              {row.subtitle ? <div className="mt-1 text-xs text-slate-500">{row.subtitle}</div> : null}
            </button>
          ))}
          {!loading && !rows.length ? <div className="text-sm text-slate-500">No records found.</div> : null}
        </div>
      </div>
    </CRMModalBase>
  );
}
