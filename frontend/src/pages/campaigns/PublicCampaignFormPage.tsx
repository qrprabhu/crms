import { useState } from "react";
import { useParams } from "react-router-dom";
import { submitCampaignForm, type PublicFormPayload } from "../../lib/api/campaignsApi";
import { CheckCircle, Loader2 } from "lucide-react";

const inputClass =
  "h-[40px] w-full rounded-[6px] border border-[#cfd7e6] bg-white px-3 text-[14px] text-slate-700 outline-none transition focus:border-[#6d8dff] focus:ring-1 focus:ring-[#6d8dff]/20";

const labelClass = "mb-1 block text-[13px] font-medium text-[#4e6485]";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  notes: string;
};

const initial: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  website: "",
  notes: "",
};

export default function PublicCampaignFormPage() {
  const { campaignId } = useParams<{ campaignId: string }>();

  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    const value =
      name === "phone" && e.target instanceof HTMLInputElement
        ? e.target.value.replace(/\D/g, "").slice(0, 10)
        : e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setError(null);
  };

  const validate = () => {
    const errs: Partial<FormState> = {};
    if (!form.firstName.trim()) errs.firstName = "First name is required.";
    if (!form.lastName.trim()) errs.lastName = "Last name is required.";
    if (!form.email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Enter a valid email address.";
    }
    if (form.phone.trim() && !/^\d{10}$/.test(form.phone.trim())) {
      errs.phone = "Phone number must be exactly 10 digits.";
    }
    if (form.website.trim()) {
      try {
        const parsed = new URL(form.website.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) {
          errs.website = "Enter a valid URL.";
        }
      } catch {
        errs.website = "Enter a valid URL.";
      }
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    if (!campaignId) {
      setError("Invalid campaign link.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const payload: PublicFormPayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        website: form.website.trim(),
        notes: form.notes.trim(),
      };
      await submitCampaignForm(campaignId, payload);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0fdf4] p-4">
        <div className="w-full max-w-md rounded-[14px] border border-[#d9e1ef] bg-white p-8 text-center shadow-sm">
          <div className="mb-4 flex justify-center">
            <CheckCircle size={48} className="text-emerald-500" />
          </div>
          <h2 className="mb-2 text-[20px] font-semibold text-[#1f2d3d]">Thank You!</h2>
          <p className="text-sm text-slate-500">
            Your response has been recorded. Our team will be in touch with you soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0fdf4] p-4">
      <div className="w-full max-w-lg rounded-[14px] border border-[#d9e1ef] bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-[22px] font-semibold text-[#1f2d3d]">Get in Touch</h1>
          <p className="mt-1 text-sm text-slate-500">
            Fill out the form below and we'll get back to you shortly.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name *</label>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                className={inputClass}
                placeholder="John"
              />
              {fieldErrors.firstName && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.firstName}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Last Name *</label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                className={inputClass}
                placeholder="Doe"
              />
              {fieldErrors.lastName && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.lastName}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Email Address *</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className={inputClass}
              placeholder="john@example.com"
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Phone Number</label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className={inputClass}
              placeholder="Enter 10-digit phone number"
              inputMode="numeric"
              pattern="\d{10}"
              maxLength={10}
            />
            {fieldErrors.phone && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Company</label>
            <input
              name="company"
              value={form.company}
              onChange={handleChange}
              className={inputClass}
              placeholder="Your company name"
            />
          </div>

          <div>
            <label className={labelClass}>Website</label>
            <input
              name="website"
              type="url"
              value={form.website}
              onChange={handleChange}
              className={inputClass}
              placeholder="https://yourcompany.com"
            />
            <p className="mt-1 text-xs text-slate-400">Optional</p>
            {fieldErrors.website && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.website}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Message / Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Tell us more about what you're looking for..."
              className="w-full rounded-[6px] border border-[#cfd7e6] bg-white px-3 py-2 text-[14px] text-slate-700 outline-none transition focus:border-[#6d8dff] focus:ring-1 focus:ring-[#6d8dff]/20"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-gradient-to-b from-[#22c55e] to-[#16a34a] py-2.5 text-[15px] font-medium text-white disabled:opacity-70"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
