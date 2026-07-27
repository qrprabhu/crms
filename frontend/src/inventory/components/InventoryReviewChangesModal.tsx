import { formatMoney } from "../utils";

type ReviewItem = {
  product: string;
  quantity: number;
  listPrice: number;
  amount: number;
  discount: number;
  tax: number;
  total: number;
};

type InventoryReviewChangesModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: {
    items: ReviewItem[];
    subtotal: number;
    discount: number;
    tax: number;
    adjustment: number;
    grandTotal: number;
  } | null;
};

export default function InventoryReviewChangesModal({
  open,
  onClose,
  onConfirm,
  data,
}: InventoryReviewChangesModalProps) {
  if (!open || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">Review Changes</h2>
        <p className="mt-1 text-sm text-slate-500">Latest backend-calculated invoice values before final save.</p>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Product", "Qty", "List Price", "Amount", "Discount", "Tax", "Total"].map((label) => (
                  <th key={label} className="px-3 py-2 font-medium text-slate-600">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={`${item.product}-${index}`} className="border-t border-slate-100">
                  <td className="px-3 py-2">{item.product}</td>
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

        <div className="mt-5 ml-auto w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          {[
            ["Sub Total", data.subtotal],
            ["Discount", data.discount],
            ["Tax", data.tax],
            ["Adjustment", data.adjustment],
            ["Grand Total", data.grandTotal],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-slate-600">{label}</span>
              <span className="font-medium text-slate-900">{formatMoney(Number(value))}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">
            Save with latest changes
          </button>
        </div>
      </div>
    </div>
  );
}
