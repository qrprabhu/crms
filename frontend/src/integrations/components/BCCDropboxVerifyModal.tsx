import { useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { email_address: string; verification_code: string }) => void;
};

export default function BCCDropboxVerifyModal({ open, submitting = false, onClose, onSubmit }: Props) {
  const [emailAddress, setEmailAddress] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  return (
    <CRMModalBase
      open={open}
      title="Verify Email Address"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => onSubmit({ email_address: emailAddress, verification_code: verificationCode })} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Verify</button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Email Address</span>
          <input value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Verification Code</span>
          <input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
      </div>
    </CRMModalBase>
  );
}

