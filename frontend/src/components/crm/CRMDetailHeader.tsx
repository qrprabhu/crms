import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

type CRMDetailHeaderProps = {
  title: string;
  subtitle: string;
  actions: string[];
  onAction?: (action: string) => void;
  onBack: () => void;
  onActionClick?: (action: string) => void;
};

export default function CRMDetailHeader({
  title,
  subtitle,
  actions,
  onAction,
  onBack,
  onActionClick,
}: CRMDetailHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const mainActions = actions.filter((action) => action !== "More");
  const hasMore = actions.includes("More");

  const handleAction = (action: string) => {
    onAction?.(action);
    onActionClick?.(action);
  };

  return (
    <header className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="break-all text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mainActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => handleAction(action)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-slate-50 ${
                action === "Convert"
                  ? "border-blue-300 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              {action}
            </button>
          ))}

          {hasMore && (
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((prev) => !prev)}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                More
                <ChevronDown size={14} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>

              {moreOpen && (
                <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg">
                  {["Clone", "Delete"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        handleAction(item);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                        item === "Delete" ? "text-red-600 hover:bg-red-50" : "text-slate-700"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
