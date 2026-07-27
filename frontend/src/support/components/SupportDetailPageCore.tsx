import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CRMDetailHeader from "../../components/crm/CRMDetailHeader";
import CRMRelatedList from "../../components/crm/CRMRelatedList";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import CRMTabs from "../../components/crm/CRMTabs";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { addSupportComment, findExistingSolutionByCase, getCaseDetail, getSolutionDetail } from "../api";
import { supportModuleMeta } from "../config";
import type { SupportModuleKey } from "../types";
import CaseAttachmentsPanel from "./CaseAttachmentsPanel";
import CaseNotesPanel from "./CaseNotesPanel";
import CaseTimeline from "./CaseTimeline";

type Props = {
  moduleKey: SupportModuleKey;
};

export default function SupportDetailPageCore({ moduleKey }: Props) {
  const isLongTextLabel = (label: string) => {
    const normalized = label.toLowerCase();
    return (
      normalized.includes("email") ||
      normalized.includes("website") ||
      normalized.includes("address")
    );
  };

  const meta = supportModuleMeta[moduleKey];
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"overview" | "timeline">("overview");
  const [activeRelatedItem, setActiveRelatedItem] = useState(meta.relatedListItems[0]);
  const [payload, setPayload] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      setPayload(moduleKey === "cases" ? await getCaseDetail(id) : await getSolutionDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load record.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id, moduleKey]);

  const relatedSections = useMemo(
    () =>
      meta.relatedListItems.map((item) => ({
        id: item.toLowerCase().replace(/\s+/g, "-"),
        label: item,
      })),
    [meta.relatedListItems]
  );

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading {meta.singular.toLowerCase()}...</div>;
  if (error || !payload) return <div className="p-6 text-sm text-rose-600">{error || "Record not found."}</div>;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <CRMDetailHeader
          title={payload.subject || payload.solutionTitle}
          subtitle={payload.subtitle}
          actions={moduleKey === "cases" ? ["Convert to Solution", "Edit"] : ["Edit"]}
          onBack={() => navigate(meta.baseRoute)}
          onActionClick={async (action) => {
            if (action === "Edit") {
              navigate(`${meta.baseRoute}/${payload.id}/edit`);
              return;
            }
            if (action === "Convert to Solution" && moduleKey === "cases") {
              const existing = await findExistingSolutionByCase(String(payload.id)).catch(() => null);
              if (existing?.id) {
                navigate(`/support/solutions/${existing.id}`);
                return;
              }
              const query = new URLSearchParams({
                caseId: String(payload.id),
                caseNumber: String(payload.caseNumber || ""),
                productId: String(payload.productId || ""),
                productName: String(payload.productName || ""),
              });
              navigate(`/support/solutions/create?${query.toString()}`);
            }
          }}
        />

        <CRMTabs activeTab={activeTab} onChange={setActiveTab} />

        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <CRMRelatedList
            items={meta.relatedListItems}
            activeItem={activeRelatedItem}
            onSelect={(item) => {
              setActiveTab("overview");
              setActiveRelatedItem(item);
              window.setTimeout(() => {
                document.getElementById(item.toLowerCase().replace(/\s+/g, "-"))?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }, 0);
            }}
          />

          {activeTab === "timeline" ? (
            <CaseTimeline items={payload.timeline} />
          ) : (
            <div className="space-y-4">
              <CRMSectionCard title="Overview">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {payload.summary.map((item: any) => (
                    <div key={item.label} className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p
                        className={`mt-1 text-sm text-slate-800 ${
                          isLongTextLabel(item.label) ? "break-all whitespace-normal" : "break-words"
                        }`}
                      >
                        {item.value || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              </CRMSectionCard>

              <CRMSectionCard title={moduleKey === "cases" ? "Case Information" : "Solution Information"}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(moduleKey === "cases" ? payload.caseInformation : payload.solutionInformation).map((field: any) => (
                    <div key={field.label} className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-500">{field.label}</p>
                      <p
                        className={`mt-1 text-sm text-slate-800 ${
                          isLongTextLabel(field.label) ? "break-all whitespace-normal" : "break-words"
                        }`}
                      >
                        {field.value || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              </CRMSectionCard>

              <CRMSectionCard title="Description Information">
                <div className="grid gap-4 sm:grid-cols-2">
                  {payload.descriptionInformation.map((field: any) => (
                    <div key={field.label}>
                      <p className="text-xs uppercase tracking-wide text-slate-500">{field.label}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{field.value || "-"}</p>
                    </div>
                  ))}
                </div>
              </CRMSectionCard>

              <CRMSectionCard title="Comment Information">
                <div className="grid gap-4 sm:grid-cols-2">
                  {payload.commentInformation.map((field: any) => (
                    <div key={field.label} className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-500">{field.label}</p>
                      <p
                        className={`mt-1 text-sm text-slate-800 ${
                          isLongTextLabel(field.label) ? "break-all whitespace-normal" : "break-words"
                        }`}
                      >
                        {field.value || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              </CRMSectionCard>

              {moduleKey === "cases" ? (
                <CRMSectionCard title="Solution Information">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {payload.solutionInformation.map((field: any) => (
                      <div key={field.label} className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-slate-500">{field.label}</p>
                        <p
                          className={`mt-1 whitespace-pre-wrap text-sm text-slate-800 ${
                            isLongTextLabel(field.label) ? "break-all" : "break-words"
                          }`}
                        >
                          {field.value || "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                </CRMSectionCard>
              ) : null}

              {relatedSections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  {section.label === "Notes" ? <CaseNotesPanel moduleKey={moduleKey} recordId={payload.id} notes={payload.related.notes} onRefresh={() => void load()} /> : null}
                  {section.label === "Attachments" ? <CaseAttachmentsPanel moduleKey={moduleKey} recordId={payload.id} attachments={payload.related.attachments} onRefresh={() => void load()} /> : null}
                  {section.label === "Connected Records" ? (
                    <CRMSectionCard title="Connected Records">
                      <div className="space-y-2">
                        {payload.related.connectedRecords.length ? payload.related.connectedRecords.map((record: any) => (
                          <div key={record.id} className="rounded-md border border-slate-200 p-3 text-sm">
                            <div className="font-medium text-slate-800">{record.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{record.recordType} | {record.status || "Linked"}</div>
                          </div>
                        )) : <div className="text-sm text-slate-500">No connected records available.</div>}
                      </div>
                    </CRMSectionCard>
                  ) : null}
                  {section.label === "Comments" ? (
                    <CRMSectionCard title="Comments">
                      <div className="space-y-3">
                        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." className="min-h-[96px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!comment.trim()) return;
                              await addSupportComment(moduleKey, payload.id, comment);
                              setComment("");
                              await load();
                            }}
                            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
                          >
                            Add Comment
                          </button>
                        </div>
                        <div className="space-y-2">
                          {payload.related.comments.length ? payload.related.comments.map((item: any) => (
                            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                              <div className="text-slate-800">{item.content}</div>
                              <div className="mt-1 text-xs text-slate-500">{item.createdBy} | {item.createdAt}</div>
                            </div>
                          )) : <div className="text-sm text-slate-500">No comments yet.</div>}
                        </div>
                      </div>
                    </CRMSectionCard>
                  ) : null}
                  {section.label === "Open Activities" ? (
                    <CRMSectionCard title="Open Activities">
                      <div className="space-y-2">
                        {payload.related.openActivities.length ? payload.related.openActivities.map((item: any) => (
                          <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                            <div className="font-medium text-slate-800">{item.subject}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.status} | {item.dueAt}</div>
                          </div>
                        )) : <div className="text-sm text-slate-500">No open activities available.</div>}
                      </div>
                    </CRMSectionCard>
                  ) : null}
                  {section.label === "Closed Activities" ? (
                    <CRMSectionCard title="Closed Activities">
                      <div className="space-y-2">
                        {payload.related.closedActivities.length ? payload.related.closedActivities.map((item: any) => (
                          <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                            <div className="font-medium text-slate-800">{item.subject}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.status} | {item.dueAt}</div>
                          </div>
                        )) : <div className="text-sm text-slate-500">No closed activities available.</div>}
                      </div>
                    </CRMSectionCard>
                  ) : null}
                  {section.label === "Emails" ? (
                    <CRMSectionCard title="Emails">
                      <div className="space-y-2">
                        {payload.related.emails.length ? payload.related.emails.map((item: any) => (
                          <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                            <div className="font-medium text-slate-800">{item.subject}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.sentBy} | {item.status} | {item.sentAt}</div>
                            {item.bodyText || item.previewText ? (
                              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                                {item.bodyText || item.previewText}
                              </div>
                            ) : null}
                          </div>
                        )) : <div className="text-sm text-slate-500">No emails logged yet.</div>}
                      </div>
                    </CRMSectionCard>
                  ) : null}
                  {section.label === "Links" ? <CRMSectionCard title="Links"><div className="text-sm text-slate-500">No links available.</div></CRMSectionCard> : null}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
