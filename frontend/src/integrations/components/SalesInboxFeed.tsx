import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { CRMEmailDetail, SalesInboxFeedItem } from "../types";
import { formatDateTime } from "../utils";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  items: SalesInboxFeedItem[];
  selectedEmailId: number | null;
  selectedEmailDetail: CRMEmailDetail | null;
  loadingDetail: boolean;
  onSelect: (item: SalesInboxFeedItem) => void;
  onClose: () => void;
};

function renderRecipients(label: string, values?: string[] | null) {
  const safeValues = values ?? [];
  if (!safeValues.length) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-all text-sm text-slate-700">{safeValues.join(", ")}</div>
    </div>
  );
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function SalesInboxFeed({
  items,
  selectedEmailId,
  selectedEmailDetail,
  loadingDetail,
  onSelect,
  onClose,
}: Props) {
  return (
    <CRMSectionCard
      title="SalesInbox Feed"
      subtitle="Review synced conversations and click any email to open and read the full message."
    >
      {!items.length ? (
        <p className="text-sm text-slate-500">No synced email messages available.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isActive = item.id === selectedEmailId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  isActive
                    ? "border-green-500 bg-green-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-blue-300"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{item.subject}</h3>
                      {!item.is_read ? <IntegrationStatusBadge label="Unread" value="pending" /> : null}
                      {item.has_attachments ? <IntegrationStatusBadge label="Attachment" value="active" /> : null}
                    </div>
                    <p className="mt-1 break-all text-sm text-slate-600">{item.from_email}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Lead: {item.lead_name || "-"} | Contact: {item.contact_name || "-"} | Deal: {item.deal_name || "-"} | Account: {item.account_name || "-"} | Case: {item.support_case_name || "-"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{formatDateTime(item.received_at || item.sent_at)}</div>
                    <div className="mt-1">{item.status}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {(loadingDetail || selectedEmailDetail) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {loadingDetail ? "Loading message..." : selectedEmailDetail?.subject}
                  </h3>
                  {!loadingDetail && selectedEmailDetail && !selectedEmailDetail.is_read ? (
                    <IntegrationStatusBadge label="Unread" value="pending" />
                  ) : null}
                  {!loadingDetail && selectedEmailDetail ? (
                    <IntegrationStatusBadge
                      label={selectedEmailDetail.direction}
                      value={selectedEmailDetail.direction === "incoming" ? "pending" : "active"}
                    />
                  ) : null}
                </div>
                {!loadingDetail && selectedEmailDetail ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDateTime(selectedEmailDetail.received_at || selectedEmailDetail.sent_at)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {loadingDetail ? (
                <div className="text-sm text-slate-500">Loading full email content...</div>
              ) : selectedEmailDetail ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">From</div>
                      <div className="mt-1 break-all text-sm text-slate-700">{selectedEmailDetail.from_email}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Provider</div>
                      <div className="mt-1 break-all text-sm text-slate-700">{selectedEmailDetail.provider_email || "-"}</div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {renderRecipients("To", selectedEmailDetail.to_emails)}
                    {renderRecipients("Cc", selectedEmailDetail.cc_emails)}
                    {renderRecipients("Bcc", selectedEmailDetail.bcc_emails)}
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Linked Records</div>
                    <div className="mt-1 text-sm text-slate-700">
                      Lead: {selectedEmailDetail.record_link?.lead_name || selectedEmailDetail.lead_name || "-"} | Contact: {selectedEmailDetail.record_link?.contact_name || selectedEmailDetail.contact_name || "-"} | Deal: {selectedEmailDetail.record_link?.deal_name || selectedEmailDetail.deal_name || "-"} | Account: {selectedEmailDetail.record_link?.account_name || selectedEmailDetail.account_name || "-"} | Case: {selectedEmailDetail.record_link?.support_case_name || selectedEmailDetail.support_case_name || "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Message</div>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="whitespace-pre-wrap break-words text-sm text-slate-800">
                        {selectedEmailDetail.body_text?.trim()
                          || (selectedEmailDetail.body_html ? stripHtml(selectedEmailDetail.body_html) : "")
                          || "No message content available."}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Attachments</div>
                    <div className="mt-2 space-y-2">
                      {(selectedEmailDetail.attachments ?? []).length ? (
                        (selectedEmailDetail.attachments ?? []).map((attachment) => (
                          <div key={attachment.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            {attachment.file_name} {attachment.file_type ? `(${attachment.file_type})` : ""}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500">No attachments.</div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </CRMSectionCard>
  );
}
