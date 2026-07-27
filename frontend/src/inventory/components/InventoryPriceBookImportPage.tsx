import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { schedulePriceBookImport, startPriceBookImport } from "../api";
import type { PriceBookImportState } from "../types";

const backendFields = ["name", "owner", "active", "pricing_model", "description"];

export default function InventoryPriceBookImportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<PriceBookImportState>({
    source: "file",
    file: null,
    operation: "add_new",
    duplicateHandling: "skip",
    fieldMapping: [
      { sourceField: "Price Book Name", targetField: "name" },
      { sourceField: "Owner", targetField: "owner" },
      { sourceField: "Active", targetField: "active" },
    ],
    scheduleAutomation: false,
  });

  const mappedCount = useMemo(() => state.fieldMapping.filter((item) => item.targetField).length, [state.fieldMapping]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Import Price Books</h1>
            <p className="text-sm text-slate-500">Frontend-ready staged flow connected to backend import placeholders.</p>
          </div>
          <button type="button" onClick={() => navigate("/price-books")} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Cancel
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Step 1: Source Selection</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { key: "file", label: "From File", desc: "Upload a spreadsheet or CSV file." },
                  { key: "other-crm", label: "From other CRMs", desc: "Prepare mapping for another CRM source." },
                ].map((item) => (
                  <button key={item.key} type="button" onClick={() => setState((prev) => ({ ...prev, source: item.key as PriceBookImportState["source"] }))} className={`rounded-xl border p-5 text-left ${state.source === item.key ? "border-green-500 bg-green-50" : "border-slate-200"}`}>
                    <div className="font-medium text-slate-900">{item.label}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Step 2: Upload File</h2>
              <label className="flex min-h-40 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                <input type="file" className="hidden" onChange={(e) => setState((prev) => ({ ...prev, file: e.target.files?.[0] || null }))} />
                <span className="text-sm text-slate-500">{state.file ? `Uploaded: ${state.file.name}` : "Choose a file to continue"}</span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Step 3: Choose Operation</h2>
              <div className="grid gap-3">
                {[
                  ["add_new", "Add as new Price Books"],
                  ["update_existing", "Update existing Price Books only"],
                  ["both", "Both"],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
                    <input type="radio" name="operation" checked={state.operation === value} onChange={() => setState((prev) => ({ ...prev, operation: value as PriceBookImportState["operation"] }))} />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Step 4: Field Mapping</h2>
                <div className="text-sm text-slate-500">{mappedCount} mapped / {backendFields.length} fields</div>
              </div>
              <div className="flex gap-2 text-sm">
                <button type="button" className="rounded-md bg-green-600 px-3 py-2 text-white">Fields Mapping</button>
                <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-slate-700">Assign Default Value</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 font-medium text-slate-600">Source Field</th>
                      <th className="px-3 py-2 font-medium text-slate-600">Target Field</th>
                      <th className="px-3 py-2 font-medium text-slate-600">Default Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.fieldMapping.map((mapping, index) => (
                      <tr key={index} className="border-t border-slate-100">
                        <td className="px-3 py-2">{mapping.sourceField}</td>
                        <td className="px-3 py-2">
                          <select className="h-[36px] w-full rounded-md border border-slate-300 px-3" value={mapping.targetField} onChange={(e) => {
                            const fieldMapping = [...state.fieldMapping];
                            fieldMapping[index] = { ...fieldMapping[index], targetField: e.target.value };
                            setState((prev) => ({ ...prev, fieldMapping }));
                          }}>
                            {backendFields.map((field) => <option key={field} value={field}>{field}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input className="h-[36px] w-full rounded-md border border-slate-300 px-3" value={mapping.defaultValue || ""} onChange={(e) => {
                            const fieldMapping = [...state.fieldMapping];
                            fieldMapping[index] = { ...fieldMapping[index], defaultValue: e.target.value };
                            setState((prev) => ({ ...prev, fieldMapping }));
                          }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Sample File Preview: Price Book Name | Owner | Active
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Create New Fields</button>
                <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Reset Field Mapping</button>
                <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Apply Auto Mapping</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Step 5: Final Options</h2>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
                <input type="checkbox" checked={state.scheduleAutomation} onChange={(e) => setState((prev) => ({ ...prev, scheduleAutomation: e.target.checked }))} />
                <span className="text-sm text-slate-700">Trigger Automation and Process Management</span>
              </label>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button type="button" onClick={() => step > 1 ? setStep((prev) => prev - 1) : navigate("/price-books")} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
              {step === 1 ? "Cancel" : "Previous"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (step === 4) {
                  await startPriceBookImport(state);
                }
                if (step < 5) {
                  setStep((prev) => prev + 1);
                  return;
                }
                try {
                  setSaving(true);
                  await schedulePriceBookImport(state);
                  setConfirmOpen(true);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={(step === 2 && !state.file) || saving}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {step < 5 ? "Next" : saving ? "Finishing..." : "Finish"}
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Import Scheduled</h2>
            <p className="mt-2 text-sm text-slate-500">Your Price Book import has been submitted successfully.</p>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => navigate("/price-books")} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
