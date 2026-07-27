import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/client";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { getLoggedInUser, getLoggedInUserName } from "../../lib/auth/currentUser";
import { createCase, createSolution, getCaseDetail, getCaseSnapshot, getSolutionDetail, updateCase, updateSolution } from "../api";
import {
  caseOriginOptions,
  casePriorityOptions,
  caseReasonOptions,
  caseStatusOptions,
  caseTypeOptions,
  solutionStatusOptions,
  supportModuleMeta,
} from "../config";
import type { CaseFormData, SolutionFormData, SupportLookupOption, SupportModuleKey } from "../types";
import CaseLookupField from "./CaseLookupField";
import QuickCreateProductModal from "./QuickCreateProductModal";

type Props = {
  moduleKey: SupportModuleKey;
};

const inputClass = "h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500";
const textareaClass = "min-h-[96px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500";

function Field({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}

const emptyCaseForm: CaseFormData = {
  caseNumber: "",
  subject: "",
  status: "Open",
  priority: "Medium",
  caseOrigin: "Web",
  caseReason: "Product Issue",
  type: "Complaint",
  description: "",
  internalComments: "",
  solutionText: "",
  reportedBy: "",
  email: "",
  company: "",
  country: "",
  phone: "",
  lead: "",
  leadLabel: "",
  leadName: "",
  leadSource: "",
  owner: "",
  ownerLabel: "",
  product: "",
  productLabel: "",
  relatedContact: "",
  relatedContactLabel: "",
  account: "",
  accountLabel: "",
  deal: "",
  dealLabel: "",
};

const emptySolutionForm: SolutionFormData = {
  solutionNumber: "",
  solutionTitle: "",
  status: "Draft",
  question: "",
  answer: "",
  resolutionSteps: "",
  owner: "",
  ownerLabel: "",
  sourceCase: "",
  sourceCaseNumber: "",
  product: "",
  productLabel: "",
};

export default function SupportFormPageCore({ moduleKey }: Props) {
  const meta = supportModuleMeta[moduleKey];
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const [caseForm, setCaseForm] = useState<CaseFormData>(emptyCaseForm);
  const [solutionForm, setSolutionForm] = useState<SolutionFormData>(emptySolutionForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const currentUser = getLoggedInUser();
  const currentUserName = getLoggedInUserName();

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        if (moduleKey === "cases") {
          const detail = await getCaseDetail(id);
          setCaseForm((prev) => ({ ...prev, caseNumber: detail.caseNumber, subject: detail.subject }));
        } else {
          const detail = await getSolutionDetail(id);
          setSolutionForm((prev) => ({
            ...prev,
            solutionNumber: detail.solutionNumber,
            solutionTitle: detail.solutionTitle,
            resolutionSteps: detail.descriptionInformation?.find((field: any) => field.label === "Steps to Resolve")?.value === "-"
              ? ""
              : detail.descriptionInformation?.find((field: any) => field.label === "Steps to Resolve")?.value || "",
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load record.");
      }
    };
    void load();
  }, [id, moduleKey]);

  useEffect(() => {
    if (isEdit) return;
    if (moduleKey === "cases") {
      setCaseForm((prev) => ({
        ...prev,
        owner: prev.owner || String(currentUser?.id || ""),
        ownerLabel: prev.ownerLabel || currentUserName,
      }));
      return;
    }
    setSolutionForm((prev) => ({
      ...prev,
      owner: prev.owner || String(currentUser?.id || ""),
      ownerLabel: prev.ownerLabel || currentUserName,
    }));
  }, [currentUser?.id, currentUserName, isEdit, moduleKey]);

  useEffect(() => {
    if (moduleKey !== "cases" || isEdit) return;
    const productId = searchParams.get("productId") || "";
    const productName = searchParams.get("productName") || "";
    const contactId = searchParams.get("contactId") || searchParams.get("relatedContactId") || "";
    const contactName = searchParams.get("contactName") || searchParams.get("relatedContactName") || "";
    const accountId = searchParams.get("accountId") || "";
    const accountName = searchParams.get("accountName") || "";
    const dealId = searchParams.get("dealId") || "";
    const dealName = searchParams.get("dealName") || "";
    const leadId = searchParams.get("leadId") || "";
    const leadName = searchParams.get("leadName") || "";

    if (!productId && !contactId && !accountId && !dealId && !leadId && !leadName) return;

    setCaseForm((prev) => ({
      ...prev,
      product: prev.product || productId,
      productLabel: prev.productLabel || productName,
      relatedContact: prev.relatedContact || contactId,
      relatedContactLabel: prev.relatedContactLabel || contactName,
      account: prev.account || accountId,
      accountLabel: prev.accountLabel || accountName,
      deal: prev.deal || dealId,
      dealLabel: prev.dealLabel || dealName,
      lead: prev.lead || leadId,
      leadLabel: prev.leadLabel || leadName,
      leadName: prev.leadName || leadName,
    }));
  }, [isEdit, moduleKey, searchParams]);

  useEffect(() => {
    if (moduleKey !== "solutions" || isEdit) return;
    const caseId = searchParams.get("caseId") || "";
    const caseNumber = searchParams.get("caseNumber") || "";
    const productId = searchParams.get("productId") || "";
    const productName = searchParams.get("productName") || "";

    if (!caseId && !productId) return;

    setSolutionForm((prev) => ({
      ...prev,
      sourceCase: prev.sourceCase || caseId,
      sourceCaseNumber: prev.sourceCaseNumber || caseNumber,
      product: prev.product || productId,
      productLabel: prev.productLabel || productName,
    }));
  }, [isEdit, moduleKey, searchParams]);

  useEffect(() => {
    if (moduleKey !== "solutions" || isEdit || !solutionForm.sourceCase) return;
    let cancelled = false;
    const loadCaseContext = async () => {
      try {
        const detail = await getCaseSnapshot(solutionForm.sourceCase);
        if (cancelled) return;
        setSolutionForm((prev) => ({
          ...prev,
          sourceCaseNumber: prev.sourceCaseNumber || String(detail.case_number || ""),
          product: prev.product || String(detail.product || ""),
          productLabel: prev.productLabel || String(detail.product_name || ""),
          question: prev.question || String(detail.subject || ""),
          answer: prev.answer || String(detail.solution_text || ""),
          solutionTitle:
            prev.solutionTitle ||
            (detail.subject
              ? `${String(detail.subject)} - Solution`
              : detail.product_name
                ? `${String(detail.product_name)} - Issue Resolution`
                : "Issue Resolution"),
        }));
      } catch {
        // Leave manual values unchanged if case prefill lookup fails.
      }
    };
    void loadCaseContext();
    return () => {
      cancelled = true;
    };
  }, [isEdit, moduleKey, solutionForm.sourceCase]);

  useEffect(() => {
    if (moduleKey !== "cases") return;
    setCaseForm((prev) => {
      const contactName = prev.relatedContactLabel.trim();
      const productLabel = prev.productLabel.trim();
      const nextSubject =
        productLabel && contactName
          ? `${productLabel} Issue - ${contactName}`
          : productLabel
            ? `${productLabel} Issue`
            : contactName
            ? `Support Issue - ${contactName}`
            : prev.subject;
      const nextReason = prev.caseReason || (prev.type === "Complaint" ? "Product Issue" : prev.type === "Question" ? "Product Usage" : "General Inquiry");
      if (!prev.subject && nextSubject) {
        return { ...prev, subject: nextSubject, caseReason: nextReason };
      }
      if (!prev.caseReason && nextReason) {
        return { ...prev, caseReason: nextReason };
      }
      return prev;
    });
  }, [caseForm.productLabel, caseForm.relatedContactLabel, caseForm.type, moduleKey]);

  useEffect(() => {
    if (moduleKey !== "solutions") return;
    setSolutionForm((prev) => {
      const nextTitle =
        prev.sourceCaseNumber && prev.question
          ? `${prev.question} - Solution`
          : prev.productLabel
            ? `${prev.productLabel} - Issue Resolution`
            : prev.solutionTitle;
      if (prev.solutionTitle || !nextTitle) {
        return prev;
      }
      return { ...prev, solutionTitle: nextTitle };
    });
  }, [moduleKey, solutionForm.productLabel, solutionForm.question, solutionForm.sourceCaseNumber]);

  const hydrateLeadContext = async (dealId?: string, fallbackLeadName?: string) => {
    if (!dealId && !fallbackLeadName) {
      return { leadName: "", leadSource: "", leadId: "" };
    }

    let leadName = fallbackLeadName || "";
    let leadSource = "";
    let leadId = "";

    if (dealId) {
      try {
        const detail = await apiRequest<any>(`/deals/${dealId}`);
        leadName = String(detail.lead_name || leadName || "");
        leadId = String(detail.lead || "");
      } catch {
        // Keep fallback values when deal enrichment fails.
      }
    }

    if (leadId) {
      try {
        const leadDetail = await apiRequest<any>(`/leads/${leadId}`);
        leadName = String(leadDetail.lead_name || leadName || "");
        leadSource = String(leadDetail.lead_source || "");
      } catch {
        // Leave lead source empty if lead fetch fails.
      }
    }

    if (!leadSource && leadName) {
      try {
        const payload = await apiRequest<any[] | { results?: any[] }>("/leads", {
          query: { search: leadName, page_size: "1" },
        });
        const firstLead = Array.isArray(payload) ? payload[0] : payload.results?.[0];
        if (firstLead) {
          leadSource = String(firstLead.lead_source || "");
          leadName = String(firstLead.lead_name || leadName || "");
          leadId = String(firstLead.id || leadId || "");
        }
      } catch {
        // Do not block case entry if search-based enrichment fails.
      }
    }

    return { leadName, leadSource, leadId };
  };

  const handleContactSelect = (option: SupportLookupOption | null) => {
    if (!option) {
      setCaseForm((prev) => ({
        ...prev,
        relatedContact: "",
        relatedContactLabel: "",
        lead: "",
        leadLabel: "",
        leadName: "",
        leadSource: "",
      }));
      return;
    }
    void (async () => {
      let linkedDealId = "";
      let linkedDealName = "";
      let linkedLeadName = "";
      try {
        const deals = await apiRequest<any[] | { results?: any[] }>("/deals", {
          query: { contact: option.id, page_size: "1" },
        });
        const firstDeal = Array.isArray(deals) ? deals[0] : deals.results?.[0];
        linkedDealId = firstDeal ? String(firstDeal.id || "") : "";
        linkedDealName = firstDeal ? String(firstDeal.deal_name || firstDeal.name || "") : "";
        linkedLeadName = firstDeal ? String(firstDeal.lead_name || "") : "";
      } catch {
        // Keep manual deal selection when linked-deal lookup fails.
      }

      const leadContext = await hydrateLeadContext(linkedDealId, linkedLeadName);

      setCaseForm((prev) => ({
        ...prev,
        relatedContact: option.id,
        relatedContactLabel: option.label,
        email: option.email || prev.email,
        phone: option.phone || prev.phone,
        account: option.accountId || prev.account,
        accountLabel: option.accountName || prev.accountLabel,
        deal: prev.deal || linkedDealId,
        dealLabel: prev.dealLabel || linkedDealName,
        reportedBy: prev.reportedBy || option.label,
        company: prev.company || option.accountName || prev.company,
        lead: prev.lead || leadContext.leadId,
        leadLabel: prev.leadLabel || leadContext.leadName,
        leadName: prev.leadName || leadContext.leadName,
        leadSource: prev.leadSource || leadContext.leadSource,
        subject: prev.subject || (prev.productLabel ? `${prev.productLabel} Issue - ${option.label}` : `Support Issue - ${option.label}`),
      }));
    })();
  };

  const handleDealSelect = (option: SupportLookupOption | null) => {
    if (!option) {
      setCaseForm((prev) => ({
        ...prev,
        deal: "",
        dealLabel: "",
        lead: "",
        leadLabel: "",
        leadName: "",
        leadSource: "",
      }));
      return;
    }

    void (async () => {
      const leadContext = await hydrateLeadContext(option.id, option.name || option.label);
      setCaseForm((prev) => ({
        ...prev,
        deal: option.id,
        dealLabel: option.label,
        lead: leadContext.leadId || prev.lead,
        leadLabel: leadContext.leadName || prev.leadLabel,
        leadName: leadContext.leadName || prev.leadName,
        leadSource: leadContext.leadSource || prev.leadSource,
        account: prev.account || option.accountId || prev.account,
        accountLabel: prev.accountLabel || option.accountName || prev.accountLabel,
      }));
    })();
  };

  const saveAndNavigate = async (createNew = false) => {
    try {
      setSaving(true);
      setError(null);

      if (moduleKey === "cases") {
        if (!caseForm.subject.trim()) {
          setError("Subject is required.");
          return;
        }
        const response = isEdit && id ? await updateCase(id, caseForm) : await createCase(caseForm);
        if (createNew) {
          setCaseForm(emptyCaseForm);
          navigate(meta.createRoute);
        } else {
          navigate(`${meta.baseRoute}/${response.id}`);
        }
      } else {
        if (!solutionForm.solutionTitle.trim()) {
          setError("Solution title is required.");
          return;
        }
        if (!solutionForm.question.trim()) {
          setError("Question is required.");
          return;
        }
        if (!solutionForm.answer.trim()) {
          setError("Answer is required.");
          return;
        }
        const response = isEdit && id ? await updateSolution(id, solutionForm) : await createSolution(solutionForm);
        if (createNew) {
          setSolutionForm(emptySolutionForm);
          navigate(meta.createRoute);
        } else {
          navigate(`${meta.baseRoute}/${response.id}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{isEdit ? `Edit ${meta.singular}` : meta.createLabel}</h1>
            <p className="text-sm text-slate-500">Connected to live Support APIs.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate(meta.baseRoute)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
            <button type="button" disabled={saving} onClick={() => void saveAndNavigate(true)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Save and New</button>
            <button type="button" disabled={saving} onClick={() => void saveAndNavigate(false)} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>

        {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        <div className="rounded-xl border border-green-100 bg-green-50/70 px-4 py-3 text-sm text-slate-700">
          <span className="font-medium text-slate-900">Quick tip:</span>{" "}
          {moduleKey === "cases"
            ? "Pick the contact, account, or deal first so the case can auto-fill customer context, lead details, and a cleaner subject line."
            : "Link the source case or product first so the solution title, answer context, and issue history stay connected."}
        </div>

        {moduleKey === "cases" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Case Number"><input className={`${inputClass} bg-slate-50`} readOnly value={caseForm.caseNumber || "Auto-generated"} /></Field>
                <Field label="Case Owner"><input className={`${inputClass} bg-slate-50`} readOnly value={caseForm.ownerLabel || currentUserName} /></Field>
                <Field label="Product Name"><CaseLookupField label="Product" lookup="products" value={caseForm.product} displayValue={caseForm.productLabel} onChange={(option) => setCaseForm({ ...caseForm, product: option?.id || "", productLabel: option?.label || "" })} /></Field>
                <Field label="Status"><select className={inputClass} value={caseForm.status} onChange={(e) => setCaseForm({ ...caseForm, status: e.target.value })}>{caseStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                <Field label="Type"><select className={inputClass} value={caseForm.type} onChange={(e) => setCaseForm({ ...caseForm, type: e.target.value })}>{caseTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                <Field label="Priority"><select className={inputClass} value={caseForm.priority} onChange={(e) => setCaseForm({ ...caseForm, priority: e.target.value })}>{casePriorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                <Field label="Case Origin"><select className={inputClass} value={caseForm.caseOrigin} onChange={(e) => setCaseForm({ ...caseForm, caseOrigin: e.target.value })}>{caseOriginOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                <Field label="Case Reason"><select className={inputClass} value={caseForm.caseReason} onChange={(e) => setCaseForm({ ...caseForm, caseReason: e.target.value })}><option value="">Select</option>{caseReasonOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                <Field label="Related To"><CaseLookupField label="Contact" lookup="contacts" value={caseForm.relatedContact} displayValue={caseForm.relatedContactLabel} onChange={handleContactSelect} /></Field>
                <Field label="Subject" required><input className={inputClass} value={caseForm.subject} onChange={(e) => setCaseForm({ ...caseForm, subject: e.target.value })} /></Field>
                <Field label="Account Name"><CaseLookupField label="Account" lookup="accounts" value={caseForm.account} displayValue={caseForm.accountLabel} onChange={(option) => setCaseForm({ ...caseForm, account: option?.id || "", accountLabel: option?.label || "" })} /></Field>
                <Field label="Reported By"><input className={inputClass} value={caseForm.reportedBy} onChange={(e) => setCaseForm({ ...caseForm, reportedBy: e.target.value })} /></Field>
                <Field label="Deal Name"><CaseLookupField label="Deal" lookup="deals" value={caseForm.deal} displayValue={caseForm.dealLabel} onChange={handleDealSelect} /></Field>
                <Field label="Email"><input className={inputClass} value={caseForm.email} onChange={(e) => setCaseForm({ ...caseForm, email: e.target.value })} /></Field>
                <Field label="Phone"><input className={inputClass} value={caseForm.phone} onChange={(e) => setCaseForm({ ...caseForm, phone: e.target.value })} /></Field>
                <Field label="Company"><input className={inputClass} value={caseForm.company} onChange={(e) => setCaseForm({ ...caseForm, company: e.target.value })} /></Field>
                <Field label="Lead">
                  <div className="space-y-1">
                    <CaseLookupField
                      label="Lead"
                      lookup="leads"
                      value={caseForm.lead}
                      displayValue={caseForm.leadLabel || caseForm.leadName}
                      onChange={(option) =>
                        setCaseForm((prev) => ({
                          ...prev,
                          lead: option?.id || "",
                          leadLabel: option?.label || "",
                          leadName: option?.label || prev.leadName,
                          leadSource: option?.source || prev.leadSource,
                          email: prev.email || option?.email || "",
                          phone: prev.phone || option?.phone || "",
                          company: prev.company || option?.accountName || prev.company,
                        }))
                      }
                    />
                    <p className="text-xs text-slate-500">Use lookup to attach a real lead record for reporting and linking.</p>
                  </div>
                </Field>
                <Field label="Country"><input className={inputClass} value={caseForm.country} onChange={(e) => setCaseForm({ ...caseForm, country: e.target.value })} /></Field>
                <div>
                  <Field label="Lead Source"><input className={inputClass} value={caseForm.leadSource} onChange={(e) => setCaseForm({ ...caseForm, leadSource: e.target.value })} /></Field>
                  <p className="mt-1 text-xs text-slate-500">Filled from the linked lead when the CRM can resolve it.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4">
                <Field label="Description"><textarea className={textareaClass} value={caseForm.description} onChange={(e) => setCaseForm({ ...caseForm, description: e.target.value })} /></Field>
                <Field label="Internal Comments"><textarea className={textareaClass} value={caseForm.internalComments} onChange={(e) => setCaseForm({ ...caseForm, internalComments: e.target.value })} /></Field>
                <Field label="Solution"><textarea className={textareaClass} value={caseForm.solutionText} onChange={(e) => setCaseForm({ ...caseForm, solutionText: e.target.value })} /></Field>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Solution Number"><input className={`${inputClass} bg-slate-50`} readOnly value={solutionForm.solutionNumber || "Auto-generated"} /></Field>
                <Field label="Status"><select className={inputClass} value={solutionForm.status} onChange={(e) => setSolutionForm({ ...solutionForm, status: e.target.value })}>{solutionStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                <Field label="Solution Title" required><input className={inputClass} value={solutionForm.solutionTitle} onChange={(e) => setSolutionForm({ ...solutionForm, solutionTitle: e.target.value })} /></Field>
                <Field label="Solution Owner"><input className={`${inputClass} bg-slate-50`} readOnly value={solutionForm.ownerLabel || currentUserName} /></Field>
                <Field label="Product Name">
                  <div className="space-y-2">
                    <CaseLookupField label="Product" lookup="products" value={solutionForm.product} displayValue={solutionForm.productLabel} onChange={(option) => setSolutionForm({ ...solutionForm, product: option?.id || "", productLabel: option?.label || "" })} />
                    <button type="button" className="text-sm font-medium text-green-600" onClick={() => setQuickCreateOpen(true)}>Quick Create Product</button>
                  </div>
                </Field>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4">
                <Field label="Question" required><textarea className={textareaClass} value={solutionForm.question} onChange={(e) => setSolutionForm({ ...solutionForm, question: e.target.value })} /></Field>
                <Field label="Solution Answer" required><textarea className={textareaClass} value={solutionForm.answer} onChange={(e) => setSolutionForm({ ...solutionForm, answer: e.target.value })} /></Field>
                <Field label="Steps to Resolve"><textarea className={textareaClass} value={solutionForm.resolutionSteps} onChange={(e) => setSolutionForm({ ...solutionForm, resolutionSteps: e.target.value })} placeholder="Step 1...\nStep 2...\nStep 3..." /></Field>
              </div>
            </div>
          </div>
        )}
      </div>

      <QuickCreateProductModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onSaved={(option) => setSolutionForm((prev) => ({ ...prev, product: option.id, productLabel: option.label }))}
      />
    </DashboardLayout>
  );
}
