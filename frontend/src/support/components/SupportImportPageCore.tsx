import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { executeSupportImport, inspectSupportImport, uploadSupportImport } from "../api";
import { supportImportSteps, supportModuleMeta } from "../config";
import type { SupportImportState, SupportModuleKey } from "../types";
import { detectDuplicateMappings } from "../utils";
import ImportDefaultValuesPanel from "./ImportDefaultValuesPanel";
import ImportFieldMappingTable from "./ImportFieldMappingTable";
import ImportFinishStep from "./ImportFinishStep";
import ImportOperationStep from "./ImportOperationStep";
import ImportUploadStep from "./ImportUploadStep";

type Props = {
  moduleKey: SupportModuleKey;
};

export default function SupportImportPageCore({ moduleKey }: Props) {
  const meta = supportModuleMeta[moduleKey];
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<SupportImportState>({
    module: moduleKey,
    source: "file",
    file: null,
    operation: "add",
    duplicateCheckField: meta.importDuplicateOptions[0],
    fieldMapping: [],
    defaultValues: {},
    automationEnabled: false,
    warnings: [],
    headers: [],
    sampleRows: [],
  });

  const duplicateMappedFields = useMemo(() => detectDuplicateMappings(state.fieldMapping), [state.fieldMapping]);

  const nextStep = async () => {
    setError(null);
    try {
      if (step === 1) {
        if (!state.file) {
          setError("Please upload a file to continue.");
          return;
        }
        setSaving(true);
        const job = await uploadSupportImport(moduleKey, state.file, state.operation, state.duplicateCheckField);
        setState((prev) => ({ ...prev, jobId: job.id }));
      }

      if (step === 2 && state.jobId) {
        setSaving(true);
        const inspection = await inspectSupportImport(moduleKey, state.jobId);
        const sampleRow = inspection.sample_rows?.[0] || {};
        const fieldMapping = (inspection.headers || []).map((header: string) => ({
          sourceField: header,
          targetField: inspection.suggested_mapping?.[header] || "",
          sampleValue: sampleRow?.[header] ? String(sampleRow[header]) : "",
        }));
        setState((prev) => ({
          ...prev,
          fieldMapping,
          headers: inspection.headers || [],
          sampleRows: inspection.sample_rows || [],
          warnings: inspection.warnings || [],
        }));
      }

      if (step === 3) {
        const mappedFields = state.fieldMapping.map((item) => item.targetField).filter(Boolean);
        const missingRequired = meta.importRequiredFields.filter(
          (field) => !mappedFields.includes(field) && !state.defaultValues[field]
        );
        if (missingRequired.length) {
          setError(`Mandatory field mapping missing: ${missingRequired.join(", ")}`);
          return;
        }
      }

      if (step < supportImportSteps.length) {
        setStep((prev) => prev + 1);
        return;
      }

      if (!state.jobId) {
        setError("Import job not found.");
        return;
      }

      setSaving(true);
      await executeSupportImport(moduleKey, {
        jobId: state.jobId,
        operation: state.operation,
        duplicateCheckField: state.duplicateCheckField,
        fieldMapping: Object.fromEntries(state.fieldMapping.map((item) => [item.sourceField, item.targetField])),
        defaultValues: state.defaultValues,
        automationEnabled: state.automationEnabled,
      });
      setConfirmOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{meta.importLabel}</h1>
            <p className="text-sm text-slate-500">Upload, map, validate, and schedule your support data import.</p>
          </div>
          <button type="button" onClick={() => navigate(meta.baseRoute)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex flex-wrap gap-2">
            {supportImportSteps.map((item, index) => (
              <div key={item} className={`rounded-full px-3 py-1 text-sm ${step === index + 1 ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                {index + 1}. {item}
              </div>
            ))}
          </div>

          {step === 1 ? (
            <ImportUploadStep
              source={state.source}
              file={state.file}
              onSourceChange={(source) => setState((prev) => ({ ...prev, source }))}
              onFileChange={(file) => setState((prev) => ({ ...prev, file }))}
            />
          ) : null}

          {step === 2 ? (
            <ImportOperationStep
              singular={meta.singular}
              operation={state.operation}
              duplicateCheckField={state.duplicateCheckField}
              duplicateOptions={meta.importDuplicateOptions}
              onOperationChange={(operation) => setState((prev) => ({ ...prev, operation }))}
              onDuplicateChange={(duplicateCheckField) => setState((prev) => ({ ...prev, duplicateCheckField }))}
            />
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="flex gap-2 text-sm">
                <button type="button" className="rounded-md bg-green-600 px-3 py-2 text-white">Fields Mapping</button>
                <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-slate-700">Assign Default Value</button>
              </div>
              <ImportFieldMappingTable mapping={state.fieldMapping} fieldOptions={meta.importFieldOptions} onChange={(fieldMapping) => setState((prev) => ({ ...prev, fieldMapping }))} />
              {duplicateMappedFields.length ? <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Duplicate mapping warning: {duplicateMappedFields.join(", ")}</div> : null}
              {state.warnings.length ? <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{state.warnings.join(" | ")}</div> : null}
            </div>
          ) : null}

          {step === 4 ? (
            <ImportDefaultValuesPanel fields={meta.importRequiredFields} values={state.defaultValues} onChange={(defaultValues) => setState((prev) => ({ ...prev, defaultValues }))} />
          ) : null}

          {step === 5 ? (
            <ImportFinishStep moduleTitle={meta.title} automationEnabled={state.automationEnabled} onAutomationChange={(automationEnabled) => setState((prev) => ({ ...prev, automationEnabled }))} />
          ) : null}

          {error ? <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <div className="mt-8 flex items-center justify-between">
            <button type="button" onClick={() => (step > 1 ? setStep((prev) => prev - 1) : navigate(meta.baseRoute))} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
              {step === 1 ? "Cancel" : "Previous"}
            </button>
            <button type="button" disabled={saving} onClick={() => void nextStep()} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">
              {step < supportImportSteps.length ? (saving ? "Working..." : "Next") : saving ? "Finishing..." : "Finish"}
            </button>
          </div>
        </div>
      </div>

      <CRMModalBase
        open={confirmOpen}
        title={`${meta.title} Import has been scheduled.`}
        footer={<button type="button" onClick={() => navigate(meta.baseRoute)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">OK</button>}
      >
        <p className="text-sm text-slate-600">It will take a few minutes to complete the import.</p>
      </CRMModalBase>
    </DashboardLayout>
  );
}

