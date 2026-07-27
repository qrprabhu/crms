import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CRMDetailHeader from "../../components/crm/CRMDetailHeader";
import CRMEmptyState from "../../components/crm/CRMEmptyState";
import CRMInfoGrid from "../../components/crm/CRMInfoGrid";
import CRMRelatedList from "../../components/crm/CRMRelatedList";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import CRMTabs from "../../components/crm/CRMTabs";
import CRMTimeline from "../../components/crm/CRMTimeline";
import DashboardLayout from "../../components/layout/DashboardLayout";
import DocumentsSection from "../documents/DocumentsSection";
import type {
  Activity,
  Attachment,
  Case,
  ConnectedRecord,
  CRMModuleConfig,
  CRMRecord,
  Deal,
  EmailRecord,
  Invoice,
  Meeting,
  Note,
  Product,
  PurchaseOrder,
  Quote,
  SalesOrder,
  Solution,
  TimelineItem,
} from "../../lib/shared/crmTypes";
import type { RelatedModule } from "../../lib/api/documentsApi";

type CRMDetailData = {
  notes: Note[];
  deals: Deal[];
  openActivities: Activity[];
  closedActivities: Activity[];
  meetings: Meeting[];
  products: Product[];
  emails: EmailRecord[];
  attachments: Attachment[];
  connectedRecords: ConnectedRecord[];
  cases: Case[];
  solutions: Solution[];
  contacts?: Array<{ id: string; name: string; email?: string; phone?: string }>;
  accounts?: Array<{ id: string; name: string; industry?: string; phone?: string }>;
  quotes: Quote[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  timeline: TimelineItem[];
};

type CRMModuleDetailPageProps<T extends CRMRecord> = {
  config: CRMModuleConfig<T>;
  rows: T[];
  data: CRMDetailData;
  sectionActions?: Record<string, ReactNode | undefined>;
  onAction?: (action: string) => void;
  onNavigate?: (type: "deal" | "contact" | "account" | "lead", id: string) => void;
};

export default function CRMModuleDetailPage<T extends CRMRecord>({
  config,
  rows,
  data,
  sectionActions = {},
  onAction,
  onNavigate,
}: CRMModuleDetailPageProps<T>) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "timeline">("overview");
  const [activeRelatedItem, setActiveRelatedItem] = useState(config.relatedListItems[0] || "");

  const renderPrimarySecondary = (primary: string, secondary?: string) => {
    const cleanPrimary = String(primary || "").trim() || "Unnamed";
    const cleanSecondary = String(secondary || "").trim();
    return cleanSecondary ? `${cleanPrimary} • ${cleanSecondary}` : cleanPrimary;
  };

  const record = useMemo(() => rows.find((row) => row.id === id) ?? rows[0], [id, rows]);
  const documentModule = useMemo<RelatedModule>(
    () => (config.module === "leads" ? "lead" : ""),
    [config.module]
  );
  const hasDocumentsSection = documentModule !== "";
  const relatedListItems = useMemo(
    () =>
      hasDocumentsSection && !config.relatedListItems.includes("Documents")
        ? [...config.relatedListItems, "Documents"]
        : config.relatedListItems,
    [config.relatedListItems, hasDocumentsSection]
  );

  const sectionIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    relatedListItems.forEach((item) => {
      map[item] = `${item.toLowerCase().replace(/\s+/g, "-")}-section`;
    });
    return map;
  }, [relatedListItems]);

  useEffect(() => {
    if (activeTab !== "overview") return;

    const observed = relatedListItems
      .map((item) => ({ item, element: document.getElementById(sectionIdMap[item]) }))
      .filter((entry): entry is { item: string; element: HTMLElement } => !!entry.element);

    if (observed.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          const found = observed.find((item) => item.element.id === visible[0].target.id);
          if (found) setActiveRelatedItem(found.item);
        }
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: [0.1, 0.3, 0.6] }
    );

    observed.forEach((entry) => observer.observe(entry.element));
    return () => observer.disconnect();
  }, [activeTab, relatedListItems, sectionIdMap]);

  const isLongTextField = (fieldKey: string) => {
    const normalized = fieldKey.toLowerCase();
    return normalized.includes("email") || normalized.includes("website") || normalized.includes("address");
  };

  const renderSectionByType = (type: string) => {
    const socialRecords = data.connectedRecords.filter((item) => {
      const recordType = item.recordType.toLowerCase();
      return recordType.includes("social") || recordType.includes("facebook") || recordType.includes("x message");
    });
    const serviceRecords = data.connectedRecords.filter((item) =>
      item.recordType.toLowerCase().includes("service")
    );

    if (type === "attachments") {
      return data.attachments.length ? (
        <div className="space-y-2">
          {data.attachments.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {item.fileName} • {item.fileType}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No attachments available." />
      );
    }

    if (type === "deals") {
      return data.deals.length ? (
        <div className="space-y-2">
          {data.deals.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm">
              <div>
                <button
                  type="button"
                  onClick={() => onNavigate?.("deal", item.id)}
                  className="font-medium text-green-600 hover:underline"
                >
                  {item.dealName}
                </button>
                <p className="text-xs text-slate-500">
                  {item.stage} • {item.closingDate ? new Date(item.closingDate).toLocaleDateString("en-GB") : "—"}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-700">${item.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No deals available." />
      );
    }

    if (type === "activities-open") {
      return data.openActivities.length ? (
        <div className="space-y-2">
          {data.openActivities.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {item.type}: {item.subject} • {item.status}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No open activities." />
      );
    }

    if (type === "activities-closed") {
      return data.closedActivities.length ? (
        <div className="space-y-2">
          {data.closedActivities.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {item.type}: {item.subject} • {item.status}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No closed activities." />
      );
    }

    if (type === "meetings") {
      return data.meetings.length ? (
        <div className="space-y-2">
          {data.meetings.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {item.title} • {item.status}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No invited meetings." />
      );
    }

    if (type === "products") {
      return data.products.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Product", "Quantity", "Price", "Discount", "Total"].map((header) => (
                  <th key={header} className="px-3 py-2 font-medium text-slate-600">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.products.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 text-slate-700">
                  <td className="px-3 py-2">{item.productName}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{item.unitPrice ?? item.amount}</td>
                  <td className="px-3 py-2">{item.discount ?? 0}</td>
                  <td className="px-3 py-2 font-medium">{item.total ?? item.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <CRMEmptyState message="No products added to this record yet." />
      );
    }

    if (type === "emails") {
      const isLeadsModule = config.module === "leads";
      return data.emails.length ? (
        <div className="space-y-2">
          {data.emails.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-800">{item.subject}</div>
              {item.bodyText || item.previewText ? (
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                  {item.bodyText || item.previewText}
                </div>
              ) : null}
              {!isLeadsModule ? (
                <div className="mt-1 text-xs text-slate-500">
                  {[item.sentBy, item.status, item.sentAt].filter(Boolean).join(" | ")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No emails available." />
      );
    }

    if (type === "notes") {
      return data.notes.length ? (
        <div className="space-y-2">
          {data.notes.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {item.title}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No notes available." />
      );
    }

    if (type === "connected-records") {
      return data.connectedRecords.length ? (
        <div className="space-y-2">
          {data.connectedRecords.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.recordType}</p>
                <button
                  type="button"
                  onClick={() => {
                    const typeMap: Record<string, "deal" | "contact" | "account" | "lead"> = {
                      Contact: "contact",
                      Account: "account",
                      Deal: "deal",
                      Lead: "lead",
                    };
                    const navType = typeMap[item.recordType];
                    if (navType) onNavigate?.(navType, item.id);
                  }}
                  className="font-medium text-green-600 hover:underline"
                >
                  {item.name}
                </button>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.status === "Active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No connected records." />
      );
    }

    if (type === "social") {
      return socialRecords.length ? (
        <div className="space-y-2">
          {socialRecords.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {item.recordType}: {item.name}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No social activity available." />
      );
    }

    if (type === "services") {
      return serviceRecords.length ? (
        <div className="space-y-2">
          {serviceRecords.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (item.route) navigate(item.route);
                  }}
                  className="text-left text-green-600 hover:underline"
                >
                  {item.recordType}: {item.name}
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {[item.owner, item.status].filter(Boolean).join(" | ") || "Linked service record"}
              </div>
              {item.meta ? <div className="mt-1 text-xs text-slate-400">{item.meta}</div> : null}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No services linked yet." />
      );
    }

    if (type === "cases") {
      return data.cases.length ? (
        <div className="space-y-2">
          {data.cases.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {item.caseNumber} • {item.subject}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No cases available." />
      );
    }

    if (type === "solutions") {
      return data.solutions.length ? (
        <div className="space-y-2">
          {data.solutions.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {item.solutionNumber} • {item.solutionTitle}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No solutions available." />
      );
    }

    if (type === "contacts") {
      return (data.contacts || []).length ? (
        <div className="space-y-2">
          {(data.contacts || []).map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {item.name}
              {item.email ? ` • ${item.email}` : item.phone ? ` • ${item.phone}` : ""}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No contacts available." />
      );
    }

    if (type === "accounts") {
      return (data.accounts || []).length ? (
        <div className="space-y-2">
          {(data.accounts || []).map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {item.name}
              {item.industry ? ` • ${item.industry}` : item.phone ? ` • ${item.phone}` : ""}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No accounts available." />
      );
    }

    if (type === "quotes") {
      return data.quotes.length ? (
        <div className="space-y-2">
          {data.quotes.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {renderPrimarySecondary(item.quoteName, item.status)}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No quotes available." />
      );
    }

    if (type === "sales-orders") {
      return data.salesOrders.length ? (
        <div className="space-y-2">
          {data.salesOrders.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {renderPrimarySecondary(item.orderNumber, item.status)}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No sales orders available." />
      );
    }

    if (type === "purchase-orders") {
      return data.purchaseOrders.length ? (
        <div className="space-y-2">
          {data.purchaseOrders.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {renderPrimarySecondary(item.poNumber, item.status)}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No purchase orders available." />
      );
    }

    if (type === "invoices") {
      return data.invoices.length ? (
        <div className="space-y-2">
          {data.invoices.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              {renderPrimarySecondary(item.invoiceNumber, item.status)}
            </div>
          ))}
        </div>
      ) : (
        <CRMEmptyState message="No invoices available." />
      );
    }

    return <CRMEmptyState message="No records available." />;
  };

  if (!record) return null;

  const formatFieldValue = (fieldKey: string, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return fieldKey.toLowerCase().includes("owner") ? "Assigned to you" : "Not provided";
    }
    return String(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <CRMDetailHeader
          title={String(record[config.nameKey] || "")}
          subtitle={String(record[config.subtitleKey] || "")}
          actions={config.headerActions}
          onAction={onAction}
          onBack={() => navigate(config.baseRoute)}
        />

        <CRMTabs activeTab={activeTab} onChange={setActiveTab} />

        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <CRMRelatedList
            items={relatedListItems}
            activeItem={activeRelatedItem}
            onSelect={(item) => {
              setActiveTab("overview");
              setActiveRelatedItem(item);
              window.setTimeout(() => {
                const targetId = sectionIdMap[item];
                const element = document.getElementById(targetId);
                element?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 0);
            }}
          />

          {activeTab === "timeline" ? (
            <CRMTimeline items={data.timeline.filter((item) => item.parentId === record.id)} />
          ) : (
            <div className="space-y-4">
              <section id="top-summary-block-section" className="scroll-mt-24">
                <CRMSectionCard title="Top Summary Block">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {config.summaryFields.map((field) => (
                      <div key={field.key} className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-slate-500">{field.label}</p>
                        <p
                          className={`mt-1 text-sm text-slate-800 ${
                            isLongTextField(field.key) ? "break-all whitespace-normal" : "break-words"
                          }`}
                        >
                          {formatFieldValue(field.key, record[field.key])}
                        </p>
                      </div>
                    ))}
                  </div>
                </CRMSectionCard>
              </section>

              {config.detailSections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <CRMSectionCard title={section.title} action={sectionActions[section.id]}>
                    {section.type === "info" && section.fields ? (
                      <CRMInfoGrid record={record} fields={section.fields as never} />
                    ) : (
                      renderSectionByType(section.type)
                    )}
                  </CRMSectionCard>
                </section>
              ))}

              {hasDocumentsSection ? (
                <section id={sectionIdMap.Documents} className="scroll-mt-24">
                  <CRMSectionCard title="Documents">
                    <DocumentsSection module={documentModule} relatedId={record.id} />
                  </CRMSectionCard>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
