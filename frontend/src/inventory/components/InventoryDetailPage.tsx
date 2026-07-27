import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CRMDetailHeader from "../../components/crm/CRMDetailHeader";
import CRMEmptyState from "../../components/crm/CRMEmptyState";
import CRMRelatedList from "../../components/crm/CRMRelatedList";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import CRMTabs from "../../components/crm/CRMTabs";
import CRMTimeline from "../../components/crm/CRMTimeline";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { convertQuoteToSalesOrder, convertSalesOrderToInvoice, getInventoryDetail } from "../api";
import { getInventoryMeta } from "../config";
import { formatMoney } from "../utils";
import type { InventoryModuleKey } from "../types";

type InventoryDetailPageProps = {
  moduleKey: InventoryModuleKey;
};

function normalizeRelatedData(label: string, related: any) {
  const lower = label.toLowerCase();
  if (lower === "notes") return related.notes;
  if (lower === "attachments") return related.attachments;
  if (lower === "emails") return related.emails;
  if (lower === "connected records") return related.connectedRecords;
  if (lower === "open activities") return related.openActivities;
  if (lower === "closed activities") return related.closedActivities;
  if (lower === "services") return related.services || [];
  if (lower === "products") return related.products;
  if (lower === "vendors") return related.vendors || [];
  if (lower === "price books") return related.priceBooks;
  if (lower === "quotes") return related.quotes || [];
  if (lower === "sales orders") return related.salesOrders;
  if (lower === "purchase orders") return related.purchaseOrders;
  if (lower === "invoices") return related.invoices;
  if (lower === "contacts") return related.contacts || [];
  if (lower === "accounts") return related.accounts || [];
  if (lower === "deals") return related.deals || [];
  if (lower === "leads") return related.leads || [];
  if (lower === "cases") return related.cases || [];
  if (lower === "solutions") return related.solutions || [];
  if (lower === "links") return related.links || [];
  if (lower === "cadences") return related.cadences || [];
  return [];
}

function renderRelatedRecord(record: any, navigate: ReturnType<typeof useNavigate>) {
  const label = record.label || record.title || record.subject || record.name || record.fileName || record.recordType || record.content;
  return (
    <div key={record.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
      <div className="break-words">
        {record.route ? (
          <button
            type="button"
            onClick={() => navigate(record.route)}
            className="text-left font-medium text-green-600 hover:underline"
          >
            {label}
          </button>
        ) : (
          label
        )}
      </div>
      {(record.meta || record.status || record.createdAt || record.sentAt) && (
        <div className="mt-1 break-all text-xs text-slate-500">
          {record.meta || record.status || record.createdAt || record.sentAt}
        </div>
      )}
    </div>
  );
}

export default function InventoryDetailPage({ moduleKey }: InventoryDetailPageProps) {
  const isLongTextLabel = (label: string) => {
    const normalized = label.toLowerCase();
    return (
      normalized.includes("email") ||
      normalized.includes("website") ||
      normalized.includes("address")
    );
  };

  const meta = getInventoryMeta(moduleKey);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "timeline">("overview");
  const [activeRelatedItem, setActiveRelatedItem] = useState(meta.relatedListItems[0] || "Notes");
  const [payload, setPayload] = useState<any | null>(null);

  const headerActions = useMemo(() => {
    if (moduleKey === "quotes") return ["Convert to Sales Order", "Edit"];
    if (moduleKey === "sales-orders") return ["Create Invoice", "Create Project", "Schedule Service", "Edit"];
    if (moduleKey === "invoices") return ["Create Project", "Schedule Service", "Edit"];
    if (moduleKey === "vendors") return ["Send Email", "Edit", "Assign", "New", "Attach"];
    return ["Edit"];
  }, [moduleKey]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setPayload(await getInventoryDetail(moduleKey, id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load record.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, moduleKey]);

  const relatedSections = useMemo(
    () =>
      meta.relatedListItems.map((item) => ({
        id: item.toLowerCase().replace(/\s+/g, "-"),
        label: item,
        records: normalizeRelatedData(item, payload?.related || {}),
      })),
    [meta.relatedListItems, payload]
  );

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading {meta.singular.toLowerCase()}...</div>;
  if (error || !payload) return <div className="p-6 text-sm text-rose-600">{error || "Record not found."}</div>;

  const { detail } = payload;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <CRMDetailHeader
          title={detail.name}
          subtitle={detail.subtitle}
          actions={headerActions}
          onBack={() => navigate(meta.baseRoute)}
          onAction={async (action) => {
            if (action === "Edit" && id) {
              navigate(`${meta.baseRoute}/${id}/edit`);
              return;
            }

            if (!id) return;

            if (action === "Convert to Sales Order" && moduleKey === "quotes") {
              const response = await convertQuoteToSalesOrder(id);
              navigate(`/sales-orders/${response.id}`);
              return;
            }

            if (action === "Create Invoice" && moduleKey === "sales-orders") {
              const response = await convertSalesOrderToInvoice(id);
              navigate(`/invoices/${response.id}`);
              return;
            }

            if (action === "Create Project" && (moduleKey === "sales-orders" || moduleKey === "invoices")) {
              const fieldMap = Object.fromEntries((detail.fields || []).map((field: any) => [String(field.label), String(field.value || "")]));
              const owner = detail.summary?.find((item: any) => String(item.label) === "Owner")?.value || "";
              const params = new URLSearchParams({
                sourceModule: moduleKey,
                sourceId: id,
                sourceLabel: detail.name || detail.subtitle || meta.singular,
                name: detail.name || meta.singular,
                accountName: fieldMap["Account Name"] || "",
                contactName: fieldMap["Contact Name"] || "",
                dealName: fieldMap["Deal Name"] || "",
                owner,
                dueDate: fieldMap["Due Date"] || "",
              });
              navigate(`/projects/create?${params.toString()}`);
              return;
            }

            if (action === "Schedule Service" && moduleKey === "sales-orders") {
              navigate(`/services/appointments/create?salesOrder=${encodeURIComponent(id)}`);
              return;
            }

            if (action === "Schedule Service" && moduleKey === "invoices") {
              navigate(`/services/appointments/create?invoice=${encodeURIComponent(id)}`);
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
            <CRMTimeline items={detail.timeline} />
          ) : (
            <div className="space-y-4">
              <CRMSectionCard title="Overview">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {detail.summary.map((item: any) => (
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

              <CRMSectionCard title={`${meta.singular} Information`}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {detail.fields.map((field: any) => (
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

              {(detail.billingStreet || detail.shippingStreet) && (
                <CRMSectionCard title="Address Information">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Billing Address</h4>
                      <p className="mt-2 break-words text-sm text-slate-600">
                        {[detail.billingStreet, detail.billingCity, detail.billingState, detail.billingCountry, detail.billingZipCode]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Shipping Address</h4>
                      <p className="mt-2 break-words text-sm text-slate-600">
                        {[detail.shippingStreet, detail.shippingCity, detail.shippingState, detail.shippingCountry, detail.shippingZipCode]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </p>
                    </div>
                  </div>
                </CRMSectionCard>
              )}

              {detail.items && detail.items.length > 0 && (
                <CRMSectionCard title="Line Items">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Product", "Qty", "List Price", "Amount", "Discount", "Tax", "Total"].map((header) => (
                            <th key={header} className="px-3 py-2 font-medium text-slate-600">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((item: any, index: number) => (
                          <tr key={`${item.product}-${index}`} className="border-t border-slate-100">
                            <td className="px-3 py-2">{item.productName || item.product}</td>
                            <td className="px-3 py-2">{item.quantity}</td>
                            <td className="px-3 py-2">{formatMoney(item.listPrice)}</td>
                            <td className="px-3 py-2">{formatMoney(item.amount)}</td>
                            <td className="px-3 py-2">{formatMoney(item.discount)}</td>
                            <td className="px-3 py-2">{formatMoney(item.tax)}</td>
                            <td className="px-3 py-2 font-medium">{formatMoney(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CRMSectionCard>
              )}

              {detail.description && (
                <CRMSectionCard title="Description">
                  <p className="text-sm leading-6 text-slate-700">{detail.description}</p>
                </CRMSectionCard>
              )}

              {detail.termsAndConditions && (
                <CRMSectionCard title="Terms and Conditions">
                  <p className="text-sm leading-6 text-slate-700">{detail.termsAndConditions}</p>
                </CRMSectionCard>
              )}

              {relatedSections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <CRMSectionCard title={section.label}>
                    {section.records.length ? (
                      section.label === "Services" ? (
                        <div className="space-y-4">
                          {[
                            { title: "Appointments", items: section.records.filter((record: any) => record.kind === "appointment") },
                            { title: "Job Sheets", items: section.records.filter((record: any) => record.kind === "job-sheet") },
                          ]
                            .filter((group) => group.items.length)
                            .map((group) => (
                              <div key={group.title}>
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</div>
                                <div className="space-y-2">
                                  {group.items.map((record: any) => renderRelatedRecord(record, navigate))}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {section.records.map((record: any) => renderRelatedRecord(record, navigate))}
                        </div>
                      )
                    ) : (
                      <CRMEmptyState message={`No ${section.label.toLowerCase()} available.`} />
                    )}
                  </CRMSectionCard>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
