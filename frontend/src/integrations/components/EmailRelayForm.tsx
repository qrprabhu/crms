import { useEffect, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { secureConnectionOptions } from "../config";
import type { EmailRelayFormValues, EmailRelayServer } from "../types";

type Props = {
  open: boolean;
  initialValue?: EmailRelayServer | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: EmailRelayFormValues) => void;
};

const emptyForm: EmailRelayFormValues = {
  server_name: "",
  port: 587,
  secure_connection: "tls",
  daily_mail_limit: 1000,
  domain_name: "",
  email_type: "",
  dkim_authentication_enabled: false,
  bounce_management_enabled: false,
  authentication_required: true,
  username: "",
  password: "",
  is_active: true,
};

export default function EmailRelayForm({ open, initialValue, submitting = false, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<EmailRelayFormValues>(emptyForm);

  useEffect(() => {
    if (initialValue) {
      setValues({
        server_name: initialValue.server_name,
        port: initialValue.port,
        secure_connection: initialValue.secure_connection,
        daily_mail_limit: initialValue.daily_mail_limit,
        domain_name: initialValue.domain_name,
        email_type: initialValue.email_type || "",
        dkim_authentication_enabled: initialValue.dkim_authentication_enabled,
        bounce_management_enabled: initialValue.bounce_management_enabled,
        authentication_required: initialValue.authentication_required,
        username: initialValue.username || "",
        password: "",
        is_active: initialValue.is_active,
      });
      return;
    }
    setValues(emptyForm);
  }, [initialValue, open]);

  const setField = <K extends keyof EmailRelayFormValues>(key: K, value: EmailRelayFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  return (
    <CRMModalBase
      open={open}
      title={initialValue ? "Edit Relay Server" : "Add Relay Server"}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => onSubmit(values)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Save</button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="text-slate-600">Server Name</span><input value={values.server_name} onChange={(e) => setField("server_name", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-600">Port</span><input type="number" value={values.port} onChange={(e) => setField("port", Number(e.target.value))} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Secure Connection</span>
          <select value={values.secure_connection} onChange={(e) => setField("secure_connection", e.target.value as EmailRelayFormValues["secure_connection"])} className="w-full rounded-md border border-slate-300 px-3 py-2">
            {secureConnectionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm"><span className="text-slate-600">Daily Mail Limit</span><input type="number" value={values.daily_mail_limit} onChange={(e) => setField("daily_mail_limit", Number(e.target.value))} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-600">Domain</span><input value={values.domain_name} onChange={(e) => setField("domain_name", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-600">Email Type</span><input value={values.email_type} onChange={(e) => setField("email_type", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-600">Username</span><input value={values.username} onChange={(e) => setField("username", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-600">Password</span><input type="password" value={values.password} onChange={(e) => setField("password", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.authentication_required} onChange={(e) => setField("authentication_required", e.target.checked)} /> Authentication required</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.dkim_authentication_enabled} onChange={(e) => setField("dkim_authentication_enabled", e.target.checked)} /> Enable DKIM authentication</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.bounce_management_enabled} onChange={(e) => setField("bounce_management_enabled", e.target.checked)} /> Enable bounce management</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.is_active} onChange={(e) => setField("is_active", e.target.checked)} /> Relay active</label>
      </div>
    </CRMModalBase>
  );
}

