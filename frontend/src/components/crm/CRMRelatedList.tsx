type CRMRelatedListProps = {
  items: readonly string[];
  activeItem: string;
  onSelect: (item: string) => void;
};

export default function CRMRelatedList({ items, activeItem, onSelect }: CRMRelatedListProps) {
  return (
    <aside className="sticky top-4 rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Related List</h3>
      <nav className="space-y-1">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className={`w-full rounded-lg px-2 py-2 text-left text-sm ${
              activeItem === item ? "bg-green-50 text-green-700" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>
    </aside>
  );
}
