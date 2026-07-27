import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { dealModuleConfig } from "../../components/modules/deals/dealsConfig";
import InventoryLookupField from "../../inventory/components/InventoryLookupField";
import type { LookupOption } from "../../inventory/types";
import { addDealProduct, getDealById } from "../../lib/api/dealsApi";
import { invalidateLinkedDataCache, loadDealLinkedData } from "../../lib/api/linkedRecordsApi";
import type { Deal as CRMDeal } from "../../lib/shared/crmTypes";
import CRMModuleDetailPage from "../crm/CRMModuleDetailPage";

type ProductFormState = {
  option: LookupOption | null;
  query: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};

function normalizeDeal(data: CRMDeal): CRMDeal {
  return {
    id: data.id,
    dealId: data.contactId || data.leadId || data.id,
    parentId: data.parentId || data.id,
    dealName: data.dealName,
    amount: data.amount,
    stage: data.stage,
    probability: data.probability,
    closingDate: data.closingDate,
    type: data.type || "",
    accountName: data.accountName,
    accountId: data.accountId,
    contactName: data.contactName,
    contactId: data.contactId,
    leadName: data.leadName,
    leadId: data.leadId,
    dealOwner: data.dealOwner,
    ownerEmail: data.ownerEmail,
    value: data.value,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

const emptyProductForm: ProductFormState = {
  option: null,
  query: "",
  quantity: "1",
  unitPrice: "",
  discount: "0",
};

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [deal, setDeal] = useState<CRMDeal | null>((location.state as { record?: CRMDeal } | null)?.record ?? null);
  const [linkedData, setLinkedData] = useState<any | null>(null);
  const [loading, setLoading] = useState(!((location.state as { record?: CRMDeal } | null)?.record));
  const [error, setError] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setError("Deal id is missing.");
        return;
      }
      try {
        setLoading(true);
        const data = await getDealById(id);
        if (!data) {
          setError("Deal not found.");
          setLoading(false);
          return;
        }
        const normalized = normalizeDeal(data);
        setDeal(normalized);
        setError(null);
        setLoading(false);

        const related = await loadDealLinkedData(normalized, { forceRefresh: true }).catch(() => null);
        setLinkedData(related);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load deal.");
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const reloadDeal = async () => {
    if (!id) return;
    const data = await getDealById(id);
    if (!data) return;
    const normalized = normalizeDeal(data);
    invalidateLinkedDataCache(`deal:${id}`);
    const related = await loadDealLinkedData(normalized, { forceRefresh: true });
    setDeal(normalized);
    setLinkedData(related);
  };

  const handleAddProduct = async () => {
    if (!id) return;
    if (!productForm.option?.id) {
      setProductError("Please select a product.");
      return;
    }

    try {
      setSavingProduct(true);
      setProductError(null);
      await addDealProduct(id, {
        productId: productForm.option.id,
        quantity: Number(productForm.quantity || 0),
        unitPrice: Number(productForm.unitPrice || 0),
        discount: Number(productForm.discount || 0),
      });
      await reloadDeal();
      setProductForm(emptyProductForm);
      setProductModalOpen(false);
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Failed to add product.");
    } finally {
      setSavingProduct(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading deal...</div>;
  }

  if (error) {
    return <div className="p-6 text-rose-600">{error}</div>;
  }

  const liveTotal =
    Number(productForm.quantity || 0) * Number(productForm.unitPrice || 0) - Number(productForm.discount || 0);

  return (
    <>
      <CRMModuleDetailPage
        config={dealModuleConfig}
        rows={deal ? [deal] : []}
        data={{
          notes: linkedData?.notes || [],
          deals: linkedData?.deals || [],
          openActivities: linkedData?.openActivities || [],
          closedActivities: linkedData?.closedActivities || [],
          meetings: linkedData?.meetings || [],
          products: linkedData?.products || [],
          emails: linkedData?.emails || [],
          attachments: linkedData?.attachments || [],
          connectedRecords: linkedData?.connectedRecords || [],
          cases: linkedData?.cases || [],
          solutions: linkedData?.solutions || [],
          contacts: linkedData?.contacts || [],
          accounts: linkedData?.accounts || [],
          quotes: linkedData?.quotes || [],
          salesOrders: linkedData?.salesOrders || [],
          purchaseOrders: linkedData?.purchaseOrders || [],
          invoices: linkedData?.invoices || [],
          timeline: linkedData?.timeline || [],
        }}
        sectionActions={{
          "products-section": (
            <button
              type="button"
              onClick={() => setProductModalOpen(true)}
              className="rounded-md bg-[#16a34a] px-3 py-1.5 text-sm font-medium text-white"
            >
              Add Product
            </button>
          ),
        }}
      />

      <CRMModalBase
        open={productModalOpen}
        title="Add Product / Line Item"
        maxWidthClassName="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setProductModalOpen(false);
                setProductForm(emptyProductForm);
                setProductError(null);
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleAddProduct()}
              disabled={savingProduct}
              className="rounded-md bg-[#16a34a] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {savingProduct ? "Saving..." : "Add Product"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {productError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {productError}
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Product</label>
            <InventoryLookupField
              lookup="products"
              value={productForm.option?.id || ""}
              displayValue={productForm.query}
              placeholder="Search products"
              onInputChange={(value) => setProductForm((prev) => ({ ...prev, query: value }))}
              onChange={(option) =>
                setProductForm((prev) => ({
                  ...prev,
                  option,
                  query: option?.label || "",
                  unitPrice: option?.unitPrice != null ? String(option.unitPrice) : prev.unitPrice,
                }))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Quantity</label>
              <input
                type="number"
                min="1"
                value={productForm.quantity}
                onChange={(event) => setProductForm((prev) => ({ ...prev, quantity: event.target.value }))}
                className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Unit Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={productForm.unitPrice}
                onChange={(event) => setProductForm((prev) => ({ ...prev, unitPrice: event.target.value }))}
                className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Discount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={productForm.discount}
                onChange={(event) => setProductForm((prev) => ({ ...prev, discount: event.target.value }))}
                className="h-[38px] w-full rounded-md border border-slate-300 px-3 text-sm outline-none"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-600">Calculated Total</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              Rs. {liveTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </CRMModalBase>
    </>
  );
}
