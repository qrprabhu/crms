import React from "react";
import { Routes, Route } from "react-router-dom";
import DealsPage from "./DealsPage";
import CreateDealPage from "./CreateDealPage";
import DealDetailPage from "./DealDetailPage";

const DealsRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<DealsPage />} />
    <Route path="create" element={<CreateDealPage />} />
    <Route path=":id" element={<DealDetailPage />} />
  </Routes>
);

export default DealsRoutes;
