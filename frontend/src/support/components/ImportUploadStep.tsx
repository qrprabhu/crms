import type { SupportImportSource } from "../types";

type Props = {
  source: SupportImportSource;
  file: File | null;
  onSourceChange: (source: SupportImportSource) => void;
  onFileChange: (file: File | null) => void;
};

export default function ImportUploadStep({ source, file, onSourceChange, onFileChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["file", "From File", "Upload a CSV, XLS, or XLSX file."],
          ["other-crm", "From other CRMs", "Prepare import from another CRM source."],
        ].map(([key, label, desc]) => (
          <button
            key={key}
            type="button"
            onClick={() => onSourceChange(key as SupportImportSource)}
            className={`rounded-xl border p-5 text-left ${
              source === key ? "border-green-500 bg-green-50" : "border-slate-200"
            }`}
          >
            <div className="font-medium text-slate-900">{label}</div>
            <div className="mt-1 text-sm text-slate-500">{desc}</div>
          </button>
        ))}
      </div>

      <label className="flex min-h-36 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
        <input type="file" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
        <span className="text-sm text-slate-500">{file ? `Uploaded: ${file.name}` : "Choose a file to continue"}</span>
      </label>
    </div>
  );
}

