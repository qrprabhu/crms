type Props = {
  moduleTitle: string;
  automationEnabled: boolean;
  onAutomationChange: (value: boolean) => void;
};

export default function ImportFinishStep({
  moduleTitle,
  automationEnabled,
  onAutomationChange,
}: Props) {
  return (
    <div className="space-y-6">
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
        <input
          type="checkbox"
          checked={automationEnabled}
          onChange={(e) => onAutomationChange(e.target.checked)}
        />
        <span className="text-sm text-slate-700">
          Trigger configured automations and processes for new and updated {moduleTitle.toLowerCase()}.
        </span>
      </label>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        The import will be scheduled and may take a few minutes to complete.
      </div>
    </div>
  );
}
