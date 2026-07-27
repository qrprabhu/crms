import type { ReactNode } from "react";

type CRMModalBaseProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  maxWidthClassName?: string;
  bodyClassName?: string;
  contentClassName?: string;
};

export default function CRMModalBase({
  open,
  title,
  children,
  footer,
  maxWidthClassName = "max-w-2xl",
  bodyClassName = "",
  contentClassName = "",
}: CRMModalBaseProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3 sm:p-4">
      <div
        className={`flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:max-h-[calc(100vh-3rem)] ${maxWidthClassName} ${contentClassName}`}
      >
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 ${bodyClassName}`}>{children}</div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</div>
      </div>
    </div>
  );
}
