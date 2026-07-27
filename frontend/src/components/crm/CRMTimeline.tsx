import type { TimelineItem } from "../../lib/shared/crmTypes";

type CRMTimelineProps = {
  items: TimelineItem[];
};

export default function CRMTimeline({ items }: CRMTimelineProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Timeline</h2>
      <p className="mt-1 text-sm text-slate-500">Full record flow including updates, linked records, tasks, calls, meetings and emails.</p>

      <div className="mt-6 space-y-4">
        {!items.length ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No timeline activity yet.
          </div>
        ) : null}
        {items.map((item, index) => (
          <div key={item.id} className="relative pl-7">
            <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-green-600" />
            {index < items.length - 1 ? <span className="absolute left-[5px] top-4 h-12 w-px bg-slate-200" /> : null}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.type}: {item.title}</p>
                <span className="text-xs text-slate-500">{new Date(item.at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{item.detail}</p>
              <p className="mt-1 text-xs text-slate-500">By {item.by}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
