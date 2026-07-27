import { useState } from "react";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import { addSupportAttachment } from "../api";
import type { SupportModuleKey } from "../types";

type Props = {
  moduleKey: SupportModuleKey;
  recordId: string;
  attachments: Array<{
    id: string;
    fileName: string;
    fileType: string;
    uploadedAt: string;
    uploadedBy: string;
  }>;
  onRefresh: () => void;
};

export default function CaseAttachmentsPanel({
  moduleKey,
  recordId,
  attachments,
  onRefresh,
}: Props) {
  const [uploading, setUploading] = useState(false);

  return (
    <CRMSectionCard title="Attachments">
      <div className="space-y-3">
        <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
          <input
            type="file"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                await addSupportAttachment(moduleKey, recordId, file);
                onRefresh();
              } finally {
                setUploading(false);
              }
            }}
          />
          {uploading ? "Uploading..." : "Upload Attachment"}
        </label>

        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="rounded-md border border-slate-200 p-3">
              <div className="text-sm font-medium text-slate-800">{attachment.fileName}</div>
              <div className="mt-1 text-xs text-slate-500">
                {attachment.fileType || "file"} | {attachment.uploadedBy || "User"} | {attachment.uploadedAt}
              </div>
            </div>
          ))}
          {attachments.length === 0 ? <div className="text-sm text-slate-500">No attachments uploaded yet.</div> : null}
        </div>
      </div>
    </CRMSectionCard>
  );
}

