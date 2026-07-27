import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { integrationsApi } from "../../integrations/api";
import IntegrationHeader from "../../integrations/components/IntegrationHeader";
import IntegrationStatusBadge from "../../integrations/components/IntegrationStatusBadge";
import { integrationsNavTabs } from "../../integrations/config";
import type { EmailSyncLog, IntegrationLeadSourceEvent } from "../../integrations/types";
import { formatDateTime, getSourceTypeLabel } from "../../integrations/utils";

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<IntegrationLeadSourceEvent[]>([]);
  const [logs, setLogs] = useState<EmailSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [sourceEvents, syncLogs] = await Promise.all([
          integrationsApi.listLeadSourceEvents().catch(() => []),
          integrationsApi.listEmailSyncLogs().catch(() => []),
        ]);
        setEvents(sourceEvents);
        setLogs(syncLogs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load integrations.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <IntegrationHeader
          title="Integrations"
          subtitle="Manage email, social, and visitor tracking workflows that feed your CRM."
          tabs={integrationsNavTabs}
          action={
            <>
              <button
                type="button"
                onClick={() => navigate("/integrations/email")}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
              >
                Open Email
              </button>
              <button
                type="button"
                onClick={() => navigate("/integrations/social")}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Open Social
              </button>
              <button
                type="button"
                onClick={() => navigate("/integrations/visitors")}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Open Visitors
              </button>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {[
            [
              "Email Integrations",
              "Connect mailbox providers, configure SalesInbox, parser, BCC Dropbox, and deliverability controls.",
              "/integrations/email",
            ],
            [
              "Social Integrations",
              "Manage brands, connect Facebook and X accounts, and automate social lead generation.",
              "/integrations/social",
            ],
            [
              "Visitor Tracking",
              "Configure portals, tracking code, and website-to-lead capture flows.",
              "/integrations/visitors",
            ],
          ].map(([title, description, path]) => (
            <button
              key={title}
              type="button"
              onClick={() => navigate(path)}
              className="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300 hover:shadow-sm"
            >
              <div className="text-lg font-semibold text-slate-900">{title}</div>
              <p className="mt-2 text-sm text-slate-500">{description}</p>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading integrations overview...</div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <CRMSectionCard title="Lead Source Events">
            {!events.length ? (
              <p className="text-sm text-slate-500">
                No integration lead-source events recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {events.slice(0, 8).map((event) => (
                  <div key={event.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {getSourceTypeLabel(event.source_type)} - {event.source_reference}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Lead: {event.lead_name || "-"} | Contact:{" "}
                          {event.contact_name || "-"} | Deal: {event.deal_name || "-"}
                        </div>
                      </div>
                      <IntegrationStatusBadge label={event.status} value={event.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CRMSectionCard>

          <CRMSectionCard title="Recent Sync Logs">
            {!logs.length ? (
              <p className="text-sm text-slate-500">No sync logs available yet.</p>
            ) : (
              <div className="space-y-3">
                {logs.slice(0, 8).map((log) => (
                  <div key={log.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {log.provider_email || `Provider #${log.provider_integration}`}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {log.sync_type.replace("_", " ")} -{" "}
                          {formatDateTime(log.last_synced_at || log.created_at)}
                        </div>
                        {log.error_message ? (
                          <div className="mt-1 text-xs text-rose-600">
                            {log.error_message}
                          </div>
                        ) : null}
                      </div>
                      <IntegrationStatusBadge label={log.status} value={log.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CRMSectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
