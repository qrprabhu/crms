type Props = {
  fields: string[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
};

export default function ImportDefaultValuesPanel({ fields, values, onChange }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) => (
        <div key={field}>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{field}</label>
          <input
            value={values[field] || ""}
            onChange={(e) => onChange({ ...values, [field]: e.target.value })}
            className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>
      ))}
    </div>
  );
}

