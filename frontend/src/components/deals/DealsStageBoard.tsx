import React from "react";
import { dealStages } from "../../lib/mock/dealStages";
import DealsStageColumn from "./DealsStageColumn";

interface DealsStageBoardProps {
  groupedDeals: Record<string, any[]>;
  loading: boolean;
}

const DealsStageBoard: React.FC<DealsStageBoardProps> = ({ groupedDeals, loading }) => {
  return (
    <div className="flex overflow-x-auto p-4 gap-4 bg-gray-100 min-h-[70vh]">
      {dealStages.map((stage) => (
        <DealsStageColumn
          key={stage}
          stage={stage}
          deals={groupedDeals[stage] || []}
          loading={loading}
        />
      ))}
    </div>
  );
};

export default DealsStageBoard;
