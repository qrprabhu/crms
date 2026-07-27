import type { SupportImportOperation } from "../types";

type Props = {
  singular: string;
  operation: SupportImportOperation;
  duplicateCheckField: string;
  duplicateOptions: string[];
  onOperationChange: (value: SupportImportOperation) => void;
  onDuplicateChange: (value: string) => void;
};

export default function ImportOperationStep({
  singular,
  operation,
  duplicateCheckField,
  duplicateOptions,
  onOperationChange,
  onDuplicateChange,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        {[
          ["add", `Add as new ${singular}s`],
          ["update", `Update existing ${singular}s only`],
          ["both", "Both"],
        ].map(([value, label]) => (
          <label key={value} className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
            <input
              type="radio"
              checked={operation === value}
              onChange={() => onOperationChange(value as SupportImportOperation)}
            />
            <span className="text-sm text-slate-700">{label}</span>
          </label>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Duplicate Check By</label>
        <select
          value={duplicateCheckField}
          onChange={(e) => onDuplicateChange(e.target.value)}
          className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm md:w-[280px]"
        >
          {duplicateOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

