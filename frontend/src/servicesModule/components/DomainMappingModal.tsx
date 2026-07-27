import { useEffect, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { createDomainMapping, verifyDomainMapping } from "../api";
import { domainMappingSteps } from "../config";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function DomainMappingModal({ open, onClose, onSaved }: Props) {
  const [step, setStep] = useState(0);
  const [accountType, setAccountType] = useState<"crm" | "sandbox" | "portals">("crm");
  const [domain, setDomain] = useState("");
  const [mappingId, setMappingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setAccountType("crm");
      setDomain("");
      setMappingId("");
      setError(null);
    }
  }, [open]);

  const handleNext = async () => {
    try {
      setSaving(true);
      setError(null);
      if (step === 1) {
        if (!domain.trim()) {
          setError("Domain is required.");
          return;
        }
        const created = await createDomainMapping(accountType, domain);
        setMappingId(created.id);
      }
      if (step === 2) {
        await verifyDomainMapping(mappingId);
        onSaved();
        onClose();
        return;
      }
      setStep((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue domain mapping.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMModalBase
      open={open}
      title="Map Domain"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Cancel
          </button>
          {step > 0 ? (
            <button type="button" onClick={() => setStep((prev) => prev - 1)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
              Back
            </button>
          ) : null}
          <button type="button" disabled={saving} onClick={() => void handleNext()} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">
            {saving ? "Working..." : step === 2 ? "Link and Verify" : "Next"}
          </button>
        </>
      }
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          {domainMappingSteps.map((item, index) => (
            <div key={item} className={`rounded-full px-3 py-1 text-xs font-medium ${index === step ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              {index + 1}. {item}
            </div>
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-3">
            {[
              { label: "CRM", value: "crm" },
              { label: "Sandbox", value: "sandbox" },
              { label: "Portals", value: "portals" },
            ].map((item) => (
              <label key={item.value} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                <input type="radio" checked={accountType === item.value} onChange={() => setAccountType(item.value as any)} />
                {item.label}
              </label>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Domain / URL</label>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="support.yourcompany.com" />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <p>Prerequisite: create a CNAME record for your chosen domain.</p>
              <p className="mt-2 font-medium text-slate-900">Point to: crm.cs.zohohost.in</p>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Account: <span className="font-medium text-slate-900">{accountType.toUpperCase()}</span></p>
            <p>Domain: <span className="font-medium text-slate-900">{domain}</span></p>
            <p>CNAME Target: <span className="font-medium text-slate-900">crm.cs.zohohost.in</span></p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              Use the final step to persist the domain mapping and verify it.
            </div>
          </div>
        ) : null}

        {error ? <div className="text-sm text-rose-600">{error}</div> : null}
      </div>
    </CRMModalBase>
  );
}

