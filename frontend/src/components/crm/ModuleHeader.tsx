type ModuleHeaderProps = {
  title: string;
};

export default function ModuleHeader({ title }: ModuleHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      <h2 className="text-[18px] font-medium text-slate-800">{title}</h2>
    </div>
  );
}