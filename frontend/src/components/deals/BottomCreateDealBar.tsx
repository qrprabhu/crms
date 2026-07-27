import React, { useState, useEffect } from "react";

const BottomCreateDealBar: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerHeight - e.clientY < 80) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded shadow-lg z-50 transition-all">
      <button
        className="text-lg font-semibold"
        onClick={() => window.location.href = "/deals/create"}
      >
        + Create Deal
      </button>
    </div>
  );
};

export default BottomCreateDealBar;
