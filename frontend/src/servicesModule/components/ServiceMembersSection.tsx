import CRMSectionCard from "../../components/crm/CRMSectionCard";
import CRMModalBase from "../../components/crm/CRMModalBase";
import { useEffect, useMemo, useState } from "react";
import type { ServiceMember, TeamMember } from "../types";

type Props = {
  members: ServiceMember[];
  teamMembers?: TeamMember[];
  onSave?: (memberIds: string[], primaryMemberId?: string) => Promise<void>;
};

export default function ServiceMembersSection({ members, teamMembers = [], onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryMemberId, setPrimaryMemberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(members.map((member) => member.memberId));
    setPrimaryMemberId(members.find((member) => member.isPrimary)?.memberId || "");
  }, [members]);

  const selectedMembers = useMemo(
    () => teamMembers.filter((item) => selectedIds.includes(item.id)),
    [selectedIds, teamMembers]
  );

  const handleToggle = (memberId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = checked ? [...new Set([...current, memberId])] : current.filter((item) => item !== memberId);
      if (!next.includes(primaryMemberId)) {
        setPrimaryMemberId(next[0] || "");
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!onSave) {
      setOpen(false);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave(selectedIds, primaryMemberId || undefined);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save service members.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <CRMSectionCard
      title="Assigned Members"
      action={
        onSave ? (
          <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-green-600">
            Manage Members
          </button>
        ) : null
      }
    >
      <div className="space-y-2">
        {members.length ? (
          members.map((member) => {
            const teamMember = teamMembers.find((item) => item.id === member.memberId);
            return (
                <div key={member.id} className="rounded-lg border border-slate-200 p-3">
                <div className="break-all text-sm font-medium text-slate-800">{teamMember?.label || member.memberEmail}</div>
                <div className="mt-1 text-xs text-slate-500">{member.isPrimary ? "Primary Member" : "Service Member"}{teamMember?.teamLabel ? ` • ${teamMember.teamLabel}` : ""}</div>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-slate-500">No members assigned yet.</div>
        )}
      </div>
    </CRMSectionCard>
    <CRMModalBase
      open={open}
      title="Manage Service Members"
      footer={
        <>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Assign the active team members who can deliver this service, and choose a primary owner for scheduling defaults.
        </p>
        {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {teamMembers.length ? (
            teamMembers.map((member) => (
              <label key={member.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(member.id)}
                  onChange={(event) => handleToggle(member.id, event.target.checked)}
                />
                <span className="break-all">{member.label} <span className="text-xs text-slate-500">({member.teamLabel})</span></span>
              </label>
            ))
          ) : (
            <div className="text-sm text-slate-500">No active team members found.</div>
          )}
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-slate-600">Primary Member</span>
          <select
            value={primaryMemberId}
            onChange={(event) => setPrimaryMemberId(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            disabled={!selectedMembers.length}
          >
            <option value="">No primary member</option>
            {selectedMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </CRMModalBase>
    </>
  );
}
