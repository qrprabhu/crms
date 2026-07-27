import CRMSectionCard from "../../components/crm/CRMSectionCard";

type ChecklistItem = {
  label: string;
  description: string;
  done: boolean;
};

type Props = {
  title: string;
  subtitle: string;
  items: ChecklistItem[];
};

export default function IntegrationSetupChecklist({ title, subtitle, items }: Props) {
  const completed = items.filter((item) => item.done).length;

  return (
    <CRMSectionCard title={title}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
            {completed} of {items.length} steps complete
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={item.label}
              className={`rounded-xl border p-4 ${
                item.done
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">
                  Step {index + 1}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {item.done ? "Done" : "Pending"}
                </span>
              </div>
              <div className="mt-3 text-sm font-medium text-slate-900">{item.label}</div>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </CRMSectionCard>
  );
}
