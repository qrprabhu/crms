import { formatMoney } from "../utils";

type InventoryTotalsPanelProps = {
  subtotal: number;
  discount: number;
  tax: number;
  adjustment: number;
  grandTotal: number;
};

export default function InventoryTotalsPanel({
  subtotal,
  discount,
  tax,
  adjustment,
  grandTotal,
}: InventoryTotalsPanelProps) {
  const rows = [
    { label: "Sub Total", value: subtotal },
    { label: "Discount", value: discount },
    { label: "Tax", value: tax },
    { label: "Adjustment", value: adjustment },
    { label: "Grand Total", value: grandTotal, strong: true },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Totals</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{row.label}</span>
            <span className={row.strong ? "font-semibold text-slate-900" : "text-slate-800"}>
              {formatMoney(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
