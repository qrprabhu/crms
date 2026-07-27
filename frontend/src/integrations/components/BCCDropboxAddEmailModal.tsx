import { useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
};

export default function BCCDropboxAddEmailModal({ open, submitting = false, onClose, onSubmit }: Props) {
  const [email, setEmail] = useState("");

  return (
    <CRMModalBase
      open={open}
      title="Add Verified Email"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => onSubmit(email)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Add Email</button>
        </>
      }
    >
      <label className="space-y-1 text-sm">
        <span className="text-slate-600">Email Address</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
    </CRMModalBase>
  );
}

