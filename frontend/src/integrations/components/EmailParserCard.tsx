import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { EmailParserInbox } from "../types";

type Props = {
  parser?: EmailParserInbox | null;
  onGenerate: () => void;
  onUpdate: (payload: Partial<EmailParserInbox>) => void;
  onIngestTest: () => void;
};

export default function EmailParserCard({ parser, onGenerate, onUpdate, onIngestTest }: Props) {
  return (
    <CRMSectionCard
      title="Email Parser"
      subtitle="Use a parser inbox only when you want structured inbound emails to create CRM records automatically."
      action={
        <div className="flex gap-2">
          {!parser ? (
            <button type="button" onClick={onGenerate} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">Generate Parser Inbox</button>
          ) : (
            <button type="button" onClick={onIngestTest} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">Test Ingest</button>
          )}
        </div>
      }
    >
      {!parser ? (
        <p className="text-sm text-slate-500">Generate a parser inbox to create leads, contacts, or cases from structured emails.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-slate-700">
            <div><span className="font-medium">Parser Name:</span> {parser.parser_name}</div>
            <div><span className="font-medium">Parser Inbox:</span> {parser.parser_email_address}</div>
            <div><span className="font-medium">Create Records As:</span> {parser.create_record_type}</div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={parser.is_active} onChange={(event) => onUpdate({ is_active: event.target.checked })} />
              Parser active
            </label>
            <p className="text-xs text-slate-500">Send formatted lead or case emails to this inbox to push them into CRM records automatically.</p>
          </div>
        </div>
      )}
    </CRMSectionCard>
  );
}
