import { Trash2 } from "lucide-react";
import type { InventoryLineItem } from "../types";
import { emptyLineItem, recalculateLineItem } from "../utils";
import InventoryLookupField from "./InventoryLookupField";

type InventoryDocumentItemsTableProps = {
  title: string;
  items: InventoryLineItem[];
  onChange: (items: InventoryLineItem[]) => void;
  showDescription?: boolean;
};

export default function InventoryDocumentItemsTable({
  title,
  items,
  onChange,
  showDescription = true,
}: InventoryDocumentItemsTableProps) {
  const updateItem = (index: number, next: Partial<InventoryLineItem>) => {
    const updated = [...items];
    updated[index] = recalculateLineItem({ ...updated[index], ...next });
    onChange(updated);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={() => onChange([...items, emptyLineItem()])}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
        >
          Add Row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["S.No", "Product Name", "Quantity", "List Price", "Amount", "Discount", "Tax", "Total", ""].map((label) => (
                <th key={label} className="px-3 py-2 font-medium text-slate-600">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-t border-slate-100 align-top">
                <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                <td className="px-3 py-3">
                  <InventoryLookupField
                    lookup="products"
                    value={item.product}
                    displayValue={item.productName || ""}
                    placeholder="Search product"
                    onInputChange={(productName) =>
                      updateItem(index, {
                        product: "",
                        productName,
                        productCode: "",
                      })
                    }
                    onChange={(option) =>
                      updateItem(index, {
                        product: option?.id || "",
                        productName: option?.name || "",
                        productCode: option?.productCode || "",
                        quantity: option ? Math.max(Number(item.quantity || 0), 1) : item.quantity,
                        listPrice: option?.unitPrice ?? item.listPrice,
                      })
                    }
                  />
                  {item.productName && !item.product && (
                    <p className="mt-2 text-xs text-rose-600">
                      Select the product from the dropdown so its ID is sent to the backend.
                    </p>
                  )}
                  {showDescription && (
                    <textarea
                      value={item.rowDescription || ""}
                      onChange={(event) => updateItem(index, { rowDescription: event.target.value })}
                      rows={2}
                      placeholder="Row description"
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                    />
                  )}
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                    className="h-[36px] w-24 rounded-md border border-slate-300 px-3 outline-none focus:border-green-500"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    value={item.listPrice}
                    onChange={(event) => updateItem(index, { listPrice: Number(event.target.value) })}
                    className="h-[36px] w-28 rounded-md border border-slate-300 px-3 outline-none focus:border-green-500"
                  />
                </td>
                <td className="px-3 py-3 text-slate-700">{item.amount.toFixed(2)}</td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    value={item.discount}
                    onChange={(event) => updateItem(index, { discount: Number(event.target.value) })}
                    className="h-[36px] w-24 rounded-md border border-slate-300 px-3 outline-none focus:border-green-500"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    value={item.tax}
                    onChange={(event) => updateItem(index, { tax: Number(event.target.value) })}
                    className="h-[36px] w-24 rounded-md border border-slate-300 px-3 outline-none focus:border-green-500"
                  />
                </td>
                <td className="px-3 py-3 font-medium text-slate-800">{item.total.toFixed(2)}</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onChange(items.filter((_, rowIndex) => rowIndex !== index))}
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
