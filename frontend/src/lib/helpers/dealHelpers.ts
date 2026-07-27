import type { DealRecord } from "../types/dealTypes";
import { dealStages } from "../mock/dealStages";
import type { DealStage } from "../mock/dealStages";

export function filterDeals(deals: DealRecord[], filters: any): DealRecord[] {
  // Implement filtering logic based on filters object
  return deals.filter((deal) => {
    if (filters.search && !deal.dealName.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.ownerId && deal.ownerId !== filters.ownerId) return false;
    if (filters.stage && deal.stage !== filters.stage) return false;
    if (filters.accountName && deal.accountName !== filters.accountName) return false;
    if (filters.amountMin && deal.amount < filters.amountMin) return false;
    if (filters.amountMax && deal.amount > filters.amountMax) return false;
    if (filters.closingDate && deal.closingDate !== filters.closingDate) return false;
    if (filters.leadSource && deal.leadSource !== filters.leadSource) return false;
    if (filters.type && deal.type !== filters.type) return false;
    if (filters.probability && deal.probability !== filters.probability) return false;
    return true;
  });
}

export function groupDealsByStage(deals: DealRecord[]): Record<DealStage, DealRecord[]> {
  const grouped: Record<DealStage, DealRecord[]> = {} as any;
  dealStages.forEach((stage) => {
    grouped[stage] = deals.filter((deal) => deal.stage === stage);
  });
  return grouped;
}

export function countDealsPerStage(deals: DealRecord[]): Record<DealStage, number> {
  const grouped = groupDealsByStage(deals);
  const counts: Record<DealStage, number> = {} as any;
  dealStages.forEach((stage) => {
    counts[stage] = grouped[stage].length;
  });
  return counts;
}

export function sumAmountPerStage(deals: DealRecord[]): Record<DealStage, number> {
  const grouped = groupDealsByStage(deals);
  const sums: Record<DealStage, number> = {} as any;
  dealStages.forEach((stage) => {
    sums[stage] = grouped[stage].reduce((acc, deal) => acc + deal.amount, 0);
  });
  return sums;
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
