import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import type { SelectOption } from "../types";

type Props = {
  title: string;
  subtitle: string;
  tabs?: SelectOption[];
  activePath?: string;
  action?: ReactNode;
};

export default function IntegrationHeader({ title, subtitle, tabs = [], activePath, action }: Props) {
  const navigate = useNavigate();

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      </div>

      {tabs.length ? (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => navigate(tab.value)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activePath === tab.value
                  ? "bg-green-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

