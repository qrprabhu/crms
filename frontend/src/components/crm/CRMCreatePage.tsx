import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layout/DashboardLayout";
import { ChevronDown } from "lucide-react";

type CountryModule = Awaited<typeof import("country-state-city/lib/country")>;
type StateModule = Awaited<typeof import("country-state-city/lib/state")>;

export type CRMCreateFieldType =
  | "text"
  | "email"
  | "number"
  | "textarea"
  | "checkbox"
  | "select"
  | "currency"
  | "country"
  | "state"
  | "owner"
  | "lookup"
  | "name-composite";

export type CRMCreateField = {
  name: string;
  label: string;
  type: CRMCreateFieldType;
  required?: boolean;
  options?: string[];
  secondaryName?: string;
  secondaryRequired?: boolean;
  sanitizeValue?: (value: string) => string;
  validateValue?: (value: string, formData: Record<string, unknown>) => string | null;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel" | "url" | "search";
  helperText?: string;
  secondarySanitizeValue?: (value: string) => string;
  secondaryValidateValue?: (value: string, formData: Record<string, unknown>) => string | null;
  secondaryMaxLength?: number;
  secondaryInputMode?: "text" | "numeric" | "decimal" | "email" | "tel" | "url" | "search";
  secondaryHelperText?: string;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
};

export type CRMCreateSection = {
  title: string;
  cardStyle?: "default" | "boxed";
  cardTitle?: string;
  widthClassName?: string;
  fields: CRMCreateField[];
};

type CRMCreatePageProps<T extends Record<string, unknown>> = {
  title: string;
  initialValues: T;
  sections: CRMCreateSection[];
  backPath: string;
  onSubmit: (values: T) => Promise<void | { redirectTo?: string; state?: unknown }>;
};

const inputClass =
  "h-[34px] w-full rounded-[4px] border border-[#cfd7e6] bg-white px-3 text-[14px] text-slate-700 outline-none transition focus:border-[#6d8dff]";

const selectClass =
  "h-[34px] w-full appearance-none rounded-[4px] border border-[#cfd7e6] bg-white px-3 pr-8 text-[14px] text-slate-700 outline-none transition focus:border-[#6d8dff]";

const labelClass =
  "pr-4 text-right text-[14px] font-normal text-[#4e6485]";

function SelectField({
  name,
  value,
  onChange,
  onBlur,
  options,
}: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select name={name} value={value} onChange={onChange} onBlur={onBlur} className={selectClass}>
        {options.map((option) => (
          <option key={option} value={option === "-None-" ? "" : option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
      />
    </div>
  );
}

export default function CRMCreatePage<T extends Record<string, unknown>>({
  title,
  initialValues,
  sections,
  backPath,
  onSubmit,
}: CRMCreatePageProps<T>) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<T>(initialValues);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countryModule, setCountryModule] = useState<CountryModule | null>(null);
  const [stateModule, setStateModule] = useState<StateModule | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const lastInitialValuesRef = useRef(initialValues);

  const needsGeoData = useMemo(
    () => sections.some((section) => section.fields.some((field) => field.type === "country" || field.type === "state")),
    [sections]
  );

  useEffect(() => {
    const previousInitialValues = lastInitialValuesRef.current;
    lastInitialValuesRef.current = initialValues;

    if (previousInitialValues === initialValues) return;
    if (isDirty) return;

    setFormData(initialValues);
  }, [initialValues, isDirty]);

  useEffect(() => {
    if (!needsGeoData || (countryModule && stateModule)) return;
    let active = true;
    void Promise.all([
      import("country-state-city/lib/country"),
      import("country-state-city/lib/state"),
    ])
      .then(([nextCountryModule, nextStateModule]) => {
        if (!active) return;
        setCountryModule(nextCountryModule);
        setStateModule(nextStateModule);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [countryModule, needsGeoData, stateModule]);

  const normalizeOptions = (options?: string[], fallback?: string[]) =>
    options && options.length > 0 ? options : fallback ?? ["-None-"];

  const optionsWithValue = (options: string[], value: string) => {
    if (!value || options.includes(value)) {
      return options;
    }

    if (options[0] === "-None-") {
      return ["-None-", value, ...options.slice(1)];
    }

    return [value, ...options];
  };

  const findFieldByInputName = (name: string): { field: CRMCreateField | undefined; isSecondary: boolean } => {
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.name === name) return { field, isSecondary: false };
        if (field.secondaryName === name) return { field, isSecondary: true };
      }
    }
    return { field: undefined, isSecondary: false };
  };

  const validateFieldValue = ({
    field,
    isSecondary,
    value,
    sourceName,
  }: {
    field: CRMCreateField;
    isSecondary: boolean;
    value: string;
    sourceName: string;
  }): string | null => {
    if (isSecondary) {
      if (field.secondaryValidateValue) {
        return field.secondaryValidateValue(value, formData);
      }
      if (field.secondaryRequired && !value.trim()) {
        return `${field.label} is required.`;
      }
      return null;
    }

    if (field.validateValue) {
      return field.validateValue(value, formData);
    }
    if (field.required && !value.trim()) {
      return `${field.label} is required.`;
    }
    if (field.type === "name-composite" && sourceName === field.name && field.secondaryRequired) {
      const secondaryValue = String(formData[field.secondaryName ?? ""] ?? "");
      if (!secondaryValue.trim()) {
        return `${field.label} is required.`;
      }
    }
    return null;
  };

  const handleFieldBlur = (name: string) => {
    const { field, isSecondary } = findFieldByInputName(name);
    if (!field) return;
    const value = String(formData[name] ?? "");
    const message = validateFieldValue({
      field,
      isSecondary,
      value,
      sourceName: name,
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) {
        next[name] = message;
      } else {
        delete next[name];
      }
      return next;
    });
  };

  const getFieldMessage = (fieldName: string) => {
    const error = fieldErrors[fieldName];
    if (error) {
      return <p className="mt-1 text-[11px] text-red-600">{error}</p>;
    }
    return null;
  };

  const countryList = useMemo(() => {
    if (!countryModule) {
      return ["-None-"];
    }

    const countries = countryModule.default.getAllCountries()
      .map((country) => country.name)
      .sort((a, b) => a.localeCompare(b));

    return ["-None-", ...countries];
  }, [countryModule]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked =
      e.target instanceof HTMLInputElement ? e.target.checked : false;
    const { field, isSecondary } = findFieldByInputName(name);
    const sanitizeValue = isSecondary ? field?.secondarySanitizeValue : field?.sanitizeValue;
    const maxLength = isSecondary ? field?.secondaryMaxLength : field?.maxLength;
    let nextValue = value;

    if (type !== "checkbox") {
      if (sanitizeValue) {
        nextValue = sanitizeValue(nextValue);
      }
      if (typeof maxLength === "number") {
        nextValue = nextValue.slice(0, maxLength);
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : nextValue,
    }));
    setIsDirty(true);
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (errorMsg) {
      setErrorMsg(null);
    }
  };

  const resetForm = () => {
    setFormData(initialValues);
    setIsDirty(false);
    setErrorMsg(null);
    setFieldErrors({});
  };

  const handleSave = async (goToNew = false) => {
    try {
      setSaving(true);
      setErrorMsg(null);
      const validationErrors: Record<string, string> = {};

      sections.forEach((section) => {
        section.fields.forEach((field) => {
          const primaryMessage = validateFieldValue({
            field,
            isSecondary: false,
            value: String(formData[field.name] ?? ""),
            sourceName: field.name,
          });
          if (primaryMessage) {
            validationErrors[field.name] = primaryMessage;
          }
          if (field.secondaryName) {
            const secondaryMessage = validateFieldValue({
              field,
              isSecondary: true,
              value: String(formData[field.secondaryName] ?? ""),
              sourceName: field.secondaryName,
            });
            if (secondaryMessage) {
              validationErrors[field.secondaryName] = secondaryMessage;
            }
          }
        });
      });

      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
        setErrorMsg("Please fill all mandatory fields and fix the highlighted inputs.");
        return;
      }

      const result = await onSubmit(formData);
      setIsDirty(false);
      setFieldErrors({});

      if (goToNew) {
        resetForm();
        return;
      }

      if (result && typeof result === "object" && "redirectTo" in result && result.redirectTo) {
        navigate(result.redirectTo, { state: result.state });
        return;
      }

      navigate(backPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to save. Please try again.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: CRMCreateField) => {
    const value = String(formData[field.name] ?? "");

    if (field.type === "textarea") {
      return (
        <div>
          <textarea
            name={field.name}
            value={value}
            onChange={handleChange}
            onBlur={() => handleFieldBlur(field.name)}
            rows={field.rows ?? 4}
            placeholder={field.placeholder ?? ""}
            maxLength={field.maxLength}
            className="min-h-[34px] w-full rounded-[4px] border border-[#cfd7e6] bg-white px-3 py-2 text-[14px] text-slate-700 outline-none focus:border-[#6d8dff]"
          />
          {getFieldMessage(field.name)}
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            name={field.name}
            checked={Boolean(formData[field.name])}
            onChange={handleChange}
            onBlur={() => handleFieldBlur(field.name)}
            className="h-4 w-4 rounded border-[#cfd7e6]"
          />
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div>
          <SelectField
            name={field.name}
            value={value}
            onChange={handleChange}
            onBlur={() => handleFieldBlur(field.name)}
            options={field.options ?? ["-None-"]}
          />
          {getFieldMessage(field.name)}
        </div>
      );
    }

    if (field.type === "country") {
      const baseOptions = field.options ?? countryList;
      const options = optionsWithValue(
        normalizeOptions(baseOptions),
        value
      );
      return (
        <div>
          <SelectField
            name={field.name}
            value={value}
            onChange={(e) => {
              const country = e.target.value;
              setFormData((prev) => ({
                ...prev,
                country,
                state: "",
              }));
              setIsDirty(true);
              if (errorMsg) {
                setErrorMsg(null);
              }
            }}
            onBlur={() => handleFieldBlur(field.name)}
            options={options}
          />
          {getFieldMessage(field.name)}
        </div>
      );
    }

    if (field.type === "state") {
      const selectedCountry = String(formData.country ?? "");
      const baseOptions =
        field.options ??
        (() => {
          if (!countryModule || !stateModule) {
            return ["-None-"];
          }

          const country = countryModule.default.getAllCountries().find(
            (item) => item.name === selectedCountry
          );
          if (!country) {
            return ["-None-"];
          }
          const states = stateModule.default.getStatesOfCountry(country.isoCode)
            .map((state) => state.name)
            .sort((a, b) => a.localeCompare(b));
          return ["-None-", ...states];
        })();
      const options = optionsWithValue(normalizeOptions(baseOptions), value);
      return (
        <div>
          <SelectField
            name={field.name}
            value={value}
            onChange={handleChange}
            onBlur={() => handleFieldBlur(field.name)}
            options={options}
          />
          {getFieldMessage(field.name)}
        </div>
      );
    }

    if (field.type === "owner") {
      return (
        <div>
          <input
            name={field.name}
            value={value}
            onChange={handleChange}
            onBlur={() => handleFieldBlur(field.name)}
            className={inputClass}
            placeholder={field.placeholder ?? ""}
            readOnly={field.readOnly}
            maxLength={field.maxLength}
            inputMode={field.inputMode}
          />
          {getFieldMessage(field.name)}
        </div>
      );
    }

    if (field.type === "lookup") {
      const listId = `${field.name}-lookup-options`;
      return (
        <div>
          <input
            name={field.name}
            value={value}
            onChange={handleChange}
            onBlur={() => handleFieldBlur(field.name)}
            className={inputClass}
            placeholder={field.placeholder ?? ""}
            list={listId}
            readOnly={field.readOnly}
            maxLength={field.maxLength}
            inputMode={field.inputMode}
          />
          <datalist id={listId}>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {getFieldMessage(field.name)}
        </div>
      );
    }

    if (field.type === "name-composite") {
      return (
        <div>
          <div className="grid grid-cols-[94px_minmax(0,1fr)]">
            <SelectField
              name={field.name}
              value={value}
              onChange={handleChange}
              onBlur={() => handleFieldBlur(field.name)}
              options={field.options ?? ["-None-"]}
            />
            <input
              name={field.secondaryName!}
              value={String(formData[field.secondaryName!] ?? "")}
              onChange={handleChange}
              onBlur={() => handleFieldBlur(field.secondaryName!)}
              className="h-[34px] w-full rounded-r-[4px] border border-l-0 border-[#cfd7e6] bg-white px-3 text-[14px] text-slate-700 outline-none"
              placeholder={field.placeholder ?? ""}
              maxLength={field.secondaryMaxLength}
              inputMode={field.secondaryInputMode}
            />
          </div>
          {getFieldMessage(field.secondaryName ?? "")}
        </div>
      );
    }

    if (field.type === "currency") {
      return (
        <div className="relative">
          <input
            name={field.name}
            value={value}
            onChange={handleChange}
            onBlur={() => handleFieldBlur(field.name)}
            className={`${inputClass} pr-4 pl-11`}
            placeholder={field.placeholder ?? ""}
            maxLength={field.maxLength}
            inputMode={field.inputMode}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-600">
            Rs.
          </span>
          {getFieldMessage(field.name)}
        </div>
      );
    }

    return (
      <div>
        <input
          type={field.type === "email" ? "email" : field.type === "number" ? "number" : "text"}
          name={field.name}
          value={value}
          onChange={handleChange}
          onBlur={() => handleFieldBlur(field.name)}
          placeholder={field.placeholder ?? ""}
          className={inputClass}
          readOnly={field.readOnly}
          maxLength={field.maxLength}
          inputMode={field.inputMode}
        />
        {getFieldMessage(field.name)}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="h-full overflow-hidden bg-[#f3f5f9]">
        <div className="border-b border-[#d9e1ef] bg-[#f0fdf4] px-7 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-[16px] font-semibold text-[#1f2d3d]">{title}</h1>
              
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(backPath)}
                disabled={saving}
                className="h-[32px] w-[130px] rounded-[6px] border border-[#cfd7e6] bg-white px-4 text-[14px] text-[#334155] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave(true)}
                disabled={saving}
                className="h-[32px] w-[130px] rounded-[6px] border border-[#cfd7e6] bg-white px-4 text-[14px] text-[#334155] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save and New"}
              </button>
              <button
                type="button"
                onClick={() => void handleSave(false)}
                disabled={saving}
                className="h-[32px] w-[130px] rounded-[6px] bg-gradient-to-b from-[#22c55e] to-[#16a34a] px-4 text-[14px] font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>

        <div className="h-[calc(100%-57px)] overflow-y-auto px-3 py-3">
          {errorMsg && (
            <div className="mb-3 rounded-[6px] border border-red-300 bg-red-50 px-4 py-2 text-[13px] text-red-700">
              {errorMsg}
            </div>
          )}
          <div className="bg-white">
            <div className="px-3 pt-4">
              {sections.map((section) => (
                <div key={section.title} className="mb-8">
                  <div className="mb-5 text-[13px] font-semibold text-[#1f2d3d]">
                    {section.title}
                  </div>

                  {section.cardStyle === "boxed" ? (
                    <div
                      className={`${section.widthClassName ?? "w-[48%]"} rounded-[10px] border border-[#cfd7e6] px-4 pb-4 pt-2`}
                    >
                      {section.cardTitle && (
                        <div className="mb-4 text-[13px] text-[#4e6485]">
                          {section.cardTitle}
                        </div>
                      )}

                      <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-y-5">
                        {section.fields.map((field) => (
                          <div key={field.name} className="contents">
                            <label className={labelClass}>
                              {field.label}
                              {(field.required || field.secondaryRequired) && (
                                <span className="ml-1 text-red-600">*</span>
                              )}
                            </label>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-16 gap-y-5">
                      <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-y-5">
                        {section.fields
                          .filter((_, index) => index % 2 === 0)
                          .map((field) => (
                            <div key={field.name} className="contents">
                              <label className={labelClass}>
                                {field.label}
                                {(field.required || field.secondaryRequired) && (
                                  <span className="ml-1 text-red-600">*</span>
                                )}
                              </label>
                              {renderField(field)}
                            </div>
                          ))}
                      </div>

                      <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-y-5">
                        {section.fields
                          .filter((_, index) => index % 2 === 1)
                          .map((field) => (
                            <div key={field.name} className="contents">
                              <label className={labelClass}>
                                {field.label}
                                {(field.required || field.secondaryRequired) && (
                                  <span className="ml-1 text-red-600">*</span>
                                )}
                              </label>
                              {renderField(field)}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
