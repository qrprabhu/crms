import { useEffect, useState } from "react";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { EmailComposeSetting, EmailProviderIntegration } from "../types";

type Props = {
  value?: EmailComposeSetting | null;
  providers: EmailProviderIntegration[];
  submitting?: boolean;
  onSubmit: (payload: Partial<EmailComposeSetting>) => void;
};

export default function ComposeSettingsForm({ value, providers, submitting = false, onSubmit }: Props) {
  const [form, setForm] = useState<Partial<EmailComposeSetting>>({});

  useEffect(() => {
    setForm(value || {});
  }, [value]);

  const setField = (key: keyof EmailComposeSetting, fieldValue: unknown) => {
    setForm((current) => ({ ...current, [key]: fieldValue }));
  };

  return (
    <CRMSectionCard
      title="Compose Settings"
      action={
        <button type="button" disabled={submitting} onClick={() => onSubmit(form)} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60">
          {submitting ? "Saving..." : "Save"}
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Default Font Family</span>
          <input value={form.default_font_family || ""} onChange={(event) => setField("default_font_family", event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Default Font Size</span>
          <input value={form.default_font_size || ""} onChange={(event) => setField("default_font_size", event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Default From Address</span>
          <select value={form.default_from_integration || ""} onChange={(event) => setField("default_from_integration", Number(event.target.value) || null)} className="w-full rounded-md border border-slate-300 px-3 py-2">
            <option value="">Select a provider</option>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.email_address}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Default Reply-To Address</span>
          <select value={form.default_reply_to_integration || ""} onChange={(event) => setField("default_reply_to_integration", Number(event.target.value) || null)} className="w-full rounded-md border border-slate-300 px-3 py-2">
            <option value="">Select a provider</option>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.email_address}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="text-slate-600">Signature Name</span>
          <input value={form.email_signature_name || ""} onChange={(event) => setField("email_signature_name", event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="text-slate-600">Signature HTML</span>
          <textarea value={form.email_signature_html || ""} onChange={(event) => setField("email_signature_html", event.target.value)} rows={5} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={Boolean(form.is_plain_text)} onChange={(event) => setField("is_plain_text", event.target.checked)} />
          Compose in plain text by default
        </label>
      </div>
    </CRMSectionCard>
  );
}

