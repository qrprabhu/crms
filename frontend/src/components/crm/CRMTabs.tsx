import type { CRMTabKey } from "../../lib/shared/crmTypes";

type CRMTabsProps = {
  activeTab: CRMTabKey;
  onChange: (tab: CRMTabKey) => void;
};

export default function CRMTabs({ activeTab, onChange }: CRMTabsProps) {
  const tabs: Array<{ key: CRMTabKey; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "timeline", label: "Timeline" },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === tab.key ? "bg-green-600 text-white" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
