import type { SupportImportFieldMapping } from "../types";

type Props = {
  mapping: SupportImportFieldMapping[];
  fieldOptions: string[];
  onChange: (mapping: SupportImportFieldMapping[]) => void;
};

export default function ImportFieldMappingTable({ mapping, fieldOptions, onChange }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 font-medium text-slate-600">Source Field</th>
            <th className="px-3 py-2 font-medium text-slate-600">CRM Field</th>
            <th className="px-3 py-2 font-medium text-slate-600">Sample Data</th>
          </tr>
        </thead>
        <tbody>
          {mapping.map((item, index) => (
            <tr key={`${item.sourceField}-${index}`} className="border-t border-slate-100">
              <td className="px-3 py-2">{item.sourceField}</td>
              <td className="px-3 py-2">
                <select
                  className="h-[36px] w-full rounded-md border border-slate-300 px-3"
                  value={item.targetField}
                  onChange={(e) => {
                    const next = [...mapping];
                    next[index] = { ...next[index], targetField: e.target.value };
                    onChange(next);
                  }}
                >
                  <option value="">Not Mapped</option>
                  {fieldOptions.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-slate-500">{item.sampleValue || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

