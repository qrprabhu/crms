type CRMPageHeaderProps = {
  title: string;
  subtitle: string;
  primaryActionLabel: string;
  filterOpen?: boolean;
  onToggleFilter?: () => void;
};

export default function CRMPageHeader({ title, subtitle, primaryActionLabel, filterOpen, onToggleFilter }: CRMPageHeaderProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onToggleFilter && (
            <button
              onClick={onToggleFilter}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                filterOpen
                  ? "border-blue-600 bg-green-50 text-green-700"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Filter
            </button>
          )}
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Sort</button>
          <button className="rounded-lg border border-blue-600 bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">{primaryActionLabel}</button>
        </div>
      </div>
    </section>
  );
}
