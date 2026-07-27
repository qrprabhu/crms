import CRMSectionCard from "../../components/crm/CRMSectionCard";
import { emailServiceCards } from "../config";
import type { EmailProviderIntegration, IntegrationProviderType } from "../types";
import { formatDateTime, getProtocolLabel, getProviderLabel } from "../utils";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  providers: EmailProviderIntegration[];
  syncingProviderId?: number | null;
  togglingSyncProviderId?: number | null;
  onCreate: (providerType?: IntegrationProviderType) => void;
  onEdit: (provider: EmailProviderIntegration) => void;
  onSync: (provider: EmailProviderIntegration) => void;
  onToggleSync: (provider: EmailProviderIntegration, enabled: boolean) => void;
  onDelete: (provider: EmailProviderIntegration) => void;
};

export default function EmailProvidersList({
  providers,
  syncingProviderId,
  togglingSyncProviderId,
  onCreate,
  onEdit,
  onSync,
  onToggleSync,
  onDelete,
}: Props) {
  return (
    <div className="space-y-4">
      <CRMSectionCard
        title="Email Providers"
        subtitle="Choose the mailbox provider you want to connect to the CRM."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {emailServiceCards.map((card) => (
            <div key={card.key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
                <button type="button" onClick={() => onCreate(card.key)} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">
                  {card.ctaLabel}
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-500">{card.description}</p>
            </div>
          ))}
        </div>
      </CRMSectionCard>

      <CRMSectionCard
        title="Connected Providers"
        subtitle="These providers are available for sync, sending defaults, and inbox visibility."
        action={
          <button type="button" onClick={() => onCreate()} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">
            Add Provider
          </button>
        }
      >
        {!providers.length ? (
          <p className="text-sm text-slate-500">No email providers connected yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {["Provider", "Protocol", "Email Address", "Display Name", "Status", "Features", "Updated", "Actions"].map((header) => (
                    <th key={header} className="px-3 py-2 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => {
                  const isSyncing = syncingProviderId === provider.id;
                  const isTogglingSync = togglingSyncProviderId === provider.id;
                  const syncLabel = isSyncing
                    ? "Syncing..."
                    : provider.last_synced_at
                      ? "Synced"
                      : "Sync Now";
                  const toggleSyncLabel = provider.sync_enabled ? "Unsync" : "Enable Sync";

                  return (
                  <tr key={provider.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3">{getProviderLabel(provider.provider_type)}</td>
                    <td className="px-3 py-3">{getProtocolLabel(provider.protocol_type)}</td>
                    <td className="px-3 py-3">{provider.email_address}</td>
                    <td className="px-3 py-3">{provider.display_name || "-"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <IntegrationStatusBadge label={provider.is_active ? "Active" : "Inactive"} value={provider.is_active} />
                        <IntegrationStatusBadge label={provider.sync_enabled ? "Sync On" : "Sync Off"} value={provider.sync_enabled} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      <div>CRM Sync: {provider.crm_sync_enabled ? "Yes" : "No"}</div>
                      <div>SalesInbox: {provider.sales_inbox_enabled ? "Yes" : "No"}</div>
                      <div>Notifications: {provider.instant_notification_enabled ? "Yes" : "No"}</div>
                    </td>
                    <td className="px-3 py-3">{formatDateTime(provider.updated_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onSync(provider)}
                          disabled={isSyncing || !provider.sync_enabled}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {syncLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleSync(provider, !provider.sync_enabled)}
                          disabled={isTogglingSync}
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isTogglingSync ? "Saving..." : toggleSyncLabel}
                        </button>
                        <button type="button" onClick={() => onEdit(provider)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700">Edit</button>
                        <button type="button" onClick={() => onDelete(provider)} className="rounded-md border border-rose-200 px-3 py-1.5 text-xs text-rose-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CRMSectionCard>
    </div>
  );
}
