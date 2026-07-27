import { useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (domain: string) => void;
};

export default function AddDomainModal({ open, submitting = false, onClose, onSubmit }: Props) {
  const [domain, setDomain] = useState("");

  return (
    <CRMModalBase
      open={open}
      title="Add Authentication Domain"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => onSubmit(domain)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Add Domain</button>
        </>
      }
    >
      <label className="space-y-1 text-sm">
        <span className="text-slate-600">Domain Name</span>
        <input value={domain} onChange={(event) => setDomain(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="example.com" />
      </label>
    </CRMModalBase>
  );
}
