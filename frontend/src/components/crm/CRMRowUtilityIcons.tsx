import { ChevronRight, ListTodo, NotebookPen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CRMRowUtilityIconsProps = {
  showNotes?: boolean;
  showActivity?: boolean;
  onOpenNotes?: () => void;
  onOpenActivityAction?: (actionKey: string) => void;
};

export default function CRMRowUtilityIcons({
  showNotes = true,
  showActivity = true,
  onOpenNotes,
  onOpenActivityAction,
}: CRMRowUtilityIconsProps) {
  const [open, setOpen] = useState(false);
  const [openCallSubmenu, setOpenCallSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
        setOpenCallSubmenu(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <>
      {showNotes ? (
        <button
          type="button"
          onClick={onOpenNotes}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
          aria-label="Open notes"
        >
          <NotebookPen size={15} />
        </button>
      ) : null}
      {showActivity ? (
        <div ref={menuRef} className="relative" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            aria-label="Open activity"
          >
            <ListTodo size={15} />
          </button>

          {open ? (
            <div className="absolute left-0 top-full z-[60] mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onOpenActivityAction?.("create-task");
                  setOpen(false);
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Create Task
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenActivityAction?.("create-meeting");
                  setOpen(false);
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Create Meeting
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenCallSubmenu((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>Create Call</span>
                  <ChevronRight size={14} className={openCallSubmenu ? "rotate-90" : ""} />
                </button>

                {openCallSubmenu ? (
                  <div className="absolute left-full top-0 z-[70] ml-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenActivityAction?.("schedule-call");
                        setOpen(false);
                        setOpenCallSubmenu(false);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Schedule a call
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenActivityAction?.("log-call");
                        setOpen(false);
                        setOpenCallSubmenu(false);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Log a call
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
