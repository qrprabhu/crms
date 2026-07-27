import React from "react";
import type { DealRecord } from "../../lib/types/dealTypes";
import { stageProbabilities } from "../../lib/mock/dealStages";
import type { DealStage } from "../../lib/mock/dealStages";
import DealCard from "./DealCard";
import { formatCurrency } from "../../lib/helpers/dealHelpers";

interface DealsStageColumnProps {
  stage: DealStage;
  deals: DealRecord[];
  loading: boolean;
}

const DealsStageColumn: React.FC<DealsStageColumnProps> = ({ stage, deals, loading }) => {
  const totalAmount = deals.reduce((acc, deal) => acc + deal.amount, 0);
  return (
    <div className="bg-white rounded shadow min-w-[320px] flex flex-col">
      <div className="p-3 border-b flex flex-col gap-1">
        <span className="font-semibold text-green-700">{stage}</span>
        <span className="text-xs text-gray-500">{deals.length} deals</span>
        <span className="text-xs text-gray-500">Probability: {stageProbabilities[stage]}%</span>
        <span className="text-xs text-gray-700">Total: {formatCurrency(totalAmount)}</span>
      </div>
      <div className="flex-1 p-2 overflow-y-auto">
        {loading ? <div>Loading...</div> : deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
};

export default DealsStageColumn;
