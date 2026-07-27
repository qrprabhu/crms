import React from "react";
import type { DealRecord } from "../../lib/types/dealTypes";
import { formatCurrency, formatDate } from "../../lib/helpers/dealHelpers";

interface DealCardProps {
  deal: DealRecord;
}

const DealCard: React.FC<DealCardProps> = ({ deal }) => {
  return (
    <div
      className="bg-gray-50 rounded p-3 mb-2 shadow cursor-pointer hover:bg-green-50"
      onClick={() => window.location.href = `/deals/${deal.id}`}
    >
      <div className="font-semibold text-lg">{deal.dealName}</div>
      <div className="text-sm text-gray-700">Account: {deal.accountName}</div>
      <div className="text-sm text-gray-700">Contact: {deal.contactName}</div>
      <div className="text-sm text-gray-700">Owner: {deal.ownerName}</div>
      <div className="text-sm text-green-700">Amount: {formatCurrency(deal.amount)}</div>
      <div className="text-xs text-gray-500">Closing: {formatDate(deal.closingDate)}</div>
      <div className="text-xs text-gray-500">Stage: {deal.stage}</div>
    </div>
  );
};

export default DealCard;
