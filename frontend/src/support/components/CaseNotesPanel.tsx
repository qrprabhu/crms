import { useState } from "react";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import { addSupportNote } from "../api";
import type { SupportModuleKey } from "../types";

type Props = {
  moduleKey: SupportModuleKey;
  recordId: string;
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    createdBy: string;
  }>;
  onRefresh: () => void;
};

export default function CaseNotesPanel({ moduleKey, recordId, notes, onRefresh }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <CRMSectionCard title="Notes">
      <div className="space-y-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a note..."
          className="min-h-[100px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!value.trim() || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await addSupportNote(moduleKey, recordId, value);
                setValue("");
                onRefresh();
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
          >
            {saving ? "Saving..." : "Add Note"}
          </button>
        </div>

        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="rounded-md border border-slate-200 p-3">
              <div className="text-sm text-slate-800">{note.content}</div>
              <div className="mt-1 text-xs text-slate-500">
                {note.createdBy || "User"} | {note.createdAt}
              </div>
            </div>
          ))}
          {notes.length === 0 ? <div className="text-sm text-slate-500">No notes added yet.</div> : null}
        </div>
      </div>
    </CRMSectionCard>
  );
}

