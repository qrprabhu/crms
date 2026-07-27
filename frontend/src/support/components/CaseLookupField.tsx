import { useState } from "react";
import type { SupportLookupName, SupportLookupOption } from "../types";
import SupportLookupModal from "./SupportLookupModal";

type Props = {
  label: string;
  lookup: SupportLookupName;
  value: string;
  displayValue: string;
  onChange: (option: SupportLookupOption | null) => void;
};

export default function CaseLookupField({
  label,
  lookup,
  value,
  displayValue,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <input
          readOnly
          value={displayValue}
          placeholder={`Select ${label}`}
          className="h-[38px] flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-slate-300 px-3 text-sm text-slate-700"
        >
          Lookup
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md border border-slate-300 px-3 text-sm text-slate-700"
          >
            Clear
          </button>
        ) : null}
      </div>

      <SupportLookupModal
        open={open}
        lookup={lookup}
        title={`Choose ${label}`}
        onClose={() => setOpen(false)}
        onSelect={onChange}
      />
    </>
  );
}

