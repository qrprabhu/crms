import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { FilterSection, FilterSectionItem } from "../../lib/shared/crmTypes";

function getLabel(item: FilterSectionItem): string {
  return typeof item === "string" ? item : item.label;
}

function getKey(item: FilterSectionItem): string | null {
  return typeof item === "string" ? null : item.key;
}

function getFixedValue(item: FilterSectionItem): string | null {
  if (typeof item === "string") return null;
  return (item.value ?? "").trim() || null;
}

type FilterSidebarProps = {
  title: string;
  sections: FilterSection[];
  onApply?: (filters: Record<string, string>) => void;
  onClear?: () => void;
};

export default function FilterSidebar({
  title,
  sections,
  onApply,
  onClear,
}: FilterSidebarProps) {
  const [search, setSearch] = useState("");

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(sections.map((section) => [section.title, true]))
  );

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setOpenSections((prev) => {
      const next: Record<string, boolean> = {};
      sections.forEach((section) => {
        next[section.title] = prev[section.title] ?? true;
      });
      return next;
    });
  }, [sections]);

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sections;

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          getLabel(item).toLowerCase().includes(query)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [search, sections]);

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  const toggleItem = (label: string) => {
    setChecked((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const handleApply = () => {
    const filters: Record<string, string> = {};

    sections.forEach((section) => {
      section.items.forEach((item) => {
        const label = getLabel(item);
        const key = getKey(item);
        const fixedValue = getFixedValue(item);

        if (key && checked[label]) {
          const value = fixedValue ?? (fieldValues[label] ?? "").trim();
          if (value) {
            filters[key] = value;
          }
        }
      });
    });

    onApply?.(filters);
  };

  const handleClear = () => {
    setChecked({});
    setFieldValues({});
    setSearch("");
    onClear?.();
  };

  const hasAnyChecked = Object.values(checked).some(Boolean);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <h3 className="mb-3 text-[15px] font-semibold text-slate-800">{title}</h3>

        <div className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-[6px]">
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            type="text"
            placeholder="Search filters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-slate-400"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}>
              <X size={13} className="text-slate-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {filteredSections.map((section) => {
          const isOpen = openSections[section.title] ?? true;

          return (
            <div key={section.title}>
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                className="flex w-full items-center justify-between text-left text-[13px] font-semibold text-slate-700"
              >
                <span>{section.title}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="mt-2 space-y-1">
                  {section.items.map((item) => {
                    const label = getLabel(item);
                    const key = getKey(item);
                    const fixedValue = getFixedValue(item);
                    const isChecked = checked[label] ?? false;

                    return (
                      <div key={label}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-[3px] text-[13px] text-slate-700 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(label)}
                            className="h-[14px] w-[14px] shrink-0 rounded border-slate-300 accent-[#22c55e]"
                          />
                          <span>{label}</span>
                        </label>

                        {key && !fixedValue && isChecked && (
                          <div className="mb-1 ml-5 mt-1">
                            <input
                              type="text"
                              placeholder={`Filter by ${label}...`}
                              value={fieldValues[label] ?? ""}
                              onChange={(e) =>
                                setFieldValues((prev) => ({
                                  ...prev,
                                  [label]: e.target.value,
                                }))
                              }
                              className="h-[28px] w-full rounded-[4px] border border-[#cfd7e6] bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-[#6d8dff]"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={handleApply}
          disabled={!hasAnyChecked}
          className="h-[32px] flex-1 rounded-[6px] bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply Filter
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="h-[32px] rounded-[6px] border border-[#cfd7e6] bg-white px-3 text-[13px] text-slate-600 hover:bg-slate-50"
        >
          Clear
        </button>
      </div>
    </aside>
  );
}
