import type { InventoryLineItem } from "./types";

export function emptyLineItem(): InventoryLineItem {
  return {
    product: "",
    quantity: 0,
    listPrice: 0,
    amount: 0,
    discount: 0,
    tax: 0,
    total: 0,
    rowDescription: "",
  };
}

export function recalculateLineItem(item: InventoryLineItem): InventoryLineItem {
  const amount = Number(item.quantity || 0) * Number(item.listPrice || 0);
  const total = amount - Number(item.discount || 0) + Number(item.tax || 0);
  return {
    ...item,
    amount,
    total,
  };
}

export function recalculateDocument(items: InventoryLineItem[], adjustment = 0) {
  const normalized = items.map(recalculateLineItem);
  const subtotal = normalized.reduce((sum, item) => sum + item.amount, 0);
  const discount = normalized.reduce((sum, item) => sum + Number(item.discount || 0), 0);
  const tax = normalized.reduce((sum, item) => sum + Number(item.tax || 0), 0);
  const grandTotal = subtotal - discount + tax + Number(adjustment || 0);
  return {
    items: normalized,
    subtotal,
    discount,
    tax,
    adjustment: Number(adjustment || 0),
    grandTotal,
  };
}

export function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
