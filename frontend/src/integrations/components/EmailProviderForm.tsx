import { useEffect, useId, useMemo, useRef, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { protocolOptions, providerOptions } from "../config";
import type {
  EmailProviderFormValues,
  EmailProviderIntegration,
  IntegrationProviderType,
} from "../types";
import { isValidEmail } from "../utils";

type ProviderField =
  | "provider_type"
  | "protocol_type"
  | "email_address"
  | "display_name"
  | "reply_to_address";

type ProviderFieldErrors = Partial<Record<ProviderField, string>>;

type SubmitResult = {
  success: boolean;
  fieldErrors?: ProviderFieldErrors;
  formError?: string;
};

type Props = {
  open: boolean;
  initialValue?: EmailProviderIntegration | null;
  presetProviderType?: IntegrationProviderType;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: EmailProviderFormValues) => Promise<SubmitResult>;
};

const emptyValues: EmailProviderFormValues = {
  provider_type: "gmail",
  protocol_type: "imap_oauth",
  email_address: "",
  display_name: "",
  reply_to_address: "",
  is_active: true,
  is_default_from: false,
  sync_enabled: true,
  sales_inbox_enabled: false,
  instant_notification_enabled: false,
  crm_sync_enabled: true,
  access_token: "",
  refresh_token: "",
  token_expiry: "",
};

export default function EmailProviderForm({
  open,
  initialValue,
  presetProviderType,
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<EmailProviderFormValues>(emptyValues);
  const [errors, setErrors] = useState<ProviderFieldErrors>({});
  const [formError, setFormError] = useState<string>("");
  const formId = useId();
  const fieldRefs = useRef<Partial<Record<ProviderField, HTMLElement | null>>>({});

  useEffect(() => {
    if (initialValue) {
      setValues({
        provider_type: initialValue.provider_type,
        protocol_type: initialValue.protocol_type,
        email_address: initialValue.email_address,
        display_name: initialValue.display_name || "",
        reply_to_address: initialValue.reply_to_address || "",
        is_active: initialValue.is_active,
        is_default_from: initialValue.is_default_from,
        sync_enabled: initialValue.sync_enabled,
        sales_inbox_enabled: initialValue.sales_inbox_enabled,
        instant_notification_enabled: initialValue.instant_notification_enabled,
        crm_sync_enabled: initialValue.crm_sync_enabled,
        access_token: "",
        refresh_token: "",
        token_expiry: initialValue.token_expiry || "",
      });
    } else {
      setValues({
        ...emptyValues,
        provider_type: presetProviderType || emptyValues.provider_type,
      });
    }
    setErrors({});
    setFormError("");
  }, [initialValue, open, presetProviderType]);

  const setField = <K extends keyof EmailProviderFormValues>(
    key: K,
    value: EmailProviderFormValues[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in errors) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
    setFormError("");
  };

  const scrollToFirstError = (nextErrors: ProviderFieldErrors) => {
    const firstField = (Object.keys(nextErrors) as ProviderField[]).find(
      (field) => nextErrors[field]
    );
    if (!firstField) {
      return;
    }
    const element = fieldRefs.current[firstField];
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus();
  };

  const validate = useMemo(
    () => () => {
      const nextErrors: ProviderFieldErrors = {};

      if (!values.email_address.trim()) {
        nextErrors.email_address = "Email address is required";
      } else if (!isValidEmail(values.email_address)) {
        nextErrors.email_address = "Enter a valid email address";
      }

      if (!values.display_name.trim()) {
        nextErrors.display_name = "Display name is required";
      }

      const replyTo = values.reply_to_address.trim();
      if (replyTo && !isValidEmail(replyTo)) {
        nextErrors.reply_to_address = "Enter a valid email address";
      }

      return nextErrors;
    },
    [values]
  );

  const applyFieldErrors = (nextErrors: ProviderFieldErrors, nextFormError = "") => {
    setErrors(nextErrors);
    setFormError(nextFormError);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => scrollToFirstError(nextErrors));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      applyFieldErrors(nextErrors);
      return;
    }

    const result = await onSubmit({
      ...values,
      email_address: values.email_address.trim(),
      display_name: values.display_name.trim(),
      reply_to_address: values.reply_to_address.trim(),
    });

    if (!result.success) {
      applyFieldErrors(result.fieldErrors || {}, result.formError || "");
    }
  };

  const inputClassName = (field: ProviderField) =>
    `w-full rounded-md px-3 py-2 outline-none transition ${
      errors[field]
        ? "border border-rose-400 bg-rose-50 text-rose-900 focus:border-rose-500"
        : "border border-slate-300 focus:border-green-500"
    }`;

  const renderFieldError = (field: ProviderField) =>
    errors[field] ? <p className="text-xs text-rose-600">{errors[field]}</p> : null;

  return (
    <CRMModalBase
      open={open}
      title={initialValue ? "Edit Email Provider" : "Add Email Provider"}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={submitting}
            className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {formError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Provider Type</span>
            <select
              ref={(element) => {
                fieldRefs.current.provider_type = element;
              }}
              value={values.provider_type}
              onChange={(event) =>
                setField("provider_type", event.target.value as IntegrationProviderType)
              }
              className={inputClassName("provider_type")}
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Protocol Type</span>
            <select
              ref={(element) => {
                fieldRefs.current.protocol_type = element;
              }}
              value={values.protocol_type}
              onChange={(event) =>
                setField(
                  "protocol_type",
                  event.target.value as EmailProviderFormValues["protocol_type"]
                )
              }
              className={inputClassName("protocol_type")}
            >
              {protocolOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Email Address</span>
            <input
              ref={(element) => {
                fieldRefs.current.email_address = element;
              }}
              value={values.email_address}
              onChange={(event) => setField("email_address", event.target.value)}
              className={inputClassName("email_address")}
              placeholder="name@company.com"
            />
            {renderFieldError("email_address")}
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Display Name</span>
            <input
              ref={(element) => {
                fieldRefs.current.display_name = element;
              }}
              value={values.display_name}
              onChange={(event) => setField("display_name", event.target.value)}
              className={inputClassName("display_name")}
              placeholder="Lavanya"
            />
            {renderFieldError("display_name")}
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Reply-To Address</span>
            <input
              ref={(element) => {
                fieldRefs.current.reply_to_address = element;
              }}
              value={values.reply_to_address}
              onChange={(event) => setField("reply_to_address", event.target.value)}
              className={inputClassName("reply_to_address")}
              placeholder="support@sshconnect.com"
            />
            {renderFieldError("reply_to_address")}
          </label>

          {[ 
            ["is_active", "Active"],
            ["is_default_from", "Default From"],
            ["sync_enabled", "Enable Sync"],
            ["crm_sync_enabled", "Enable CRM Sync"],
            ["sales_inbox_enabled", "Enable SalesInbox"],
            ["instant_notification_enabled", "Enable Notifications"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(values[key as keyof EmailProviderFormValues])}
                onChange={(event) =>
                  setField(
                    key as keyof EmailProviderFormValues,
                    event.target.checked as never
                  )
                }
              />
              {label}
            </label>
          ))}

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-slate-600">App Password / Access Token</span>
            <input
              type="password"
              value={values.access_token || ""}
              onChange={(event) => setField("access_token", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-green-500"
              placeholder="Required for live inbox sync"
            />
          </label>

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-slate-600">Refresh Token (Optional)</span>
            <input
              type="password"
              value={values.refresh_token || ""}
              onChange={(event) => setField("refresh_token", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-green-500"
              placeholder="Optional"
            />
          </label>
        </div>
      </form>
    </CRMModalBase>
  );
}
