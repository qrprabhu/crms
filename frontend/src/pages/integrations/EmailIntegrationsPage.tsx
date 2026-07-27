import { useEffect, useMemo, useState } from "react";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { integrationsApi } from "../../integrations/api";
import IntegrationHeader from "../../integrations/components/IntegrationHeader";
import AddDomainModal from "../../integrations/components/AddDomainModal";
import BCCDropboxAddEmailModal from "../../integrations/components/BCCDropboxAddEmailModal";
import BCCDropboxCard from "../../integrations/components/BCCDropboxCard";
import BCCDropboxVerifyModal from "../../integrations/components/BCCDropboxVerifyModal";
import ComposeSettingsForm from "../../integrations/components/ComposeSettingsForm";
import CustomEmailFieldsToggle from "../../integrations/components/CustomEmailFieldsToggle";
import EmailAuthenticationTable from "../../integrations/components/EmailAuthenticationTable";
import EmailCredibilityDashboard from "../../integrations/components/EmailCredibilityDashboard";
import EmailInsightsPanel from "../../integrations/components/EmailInsightsPanel";
import EmailParserCard from "../../integrations/components/EmailParserCard";
import EmailProviderForm from "../../integrations/components/EmailProviderForm";
import EmailProvidersList from "../../integrations/components/EmailProvidersList";
import EmailRelayForm from "../../integrations/components/EmailRelayForm";
import EmailRelayTable from "../../integrations/components/EmailRelayTable";
import EmailSharingTable from "../../integrations/components/EmailSharingTable";
import OrganizationEmailForm from "../../integrations/components/OrganizationEmailForm";
import OrganizationEmailsTable from "../../integrations/components/OrganizationEmailsTable";
import IntegrationSetupChecklist from "../../integrations/components/IntegrationSetupChecklist";
import SalesInboxCard from "../../integrations/components/SalesInboxCard";
import SalesInboxFeed from "../../integrations/components/SalesInboxFeed";
import UnsubscribeLinkForm from "../../integrations/components/UnsubscribeLinkForm";
import UnsubscribeLinksTable from "../../integrations/components/UnsubscribeLinksTable";
import { deliverabilityTabs, integrationsNavTabs } from "../../integrations/config";
import type {
  BCCDropboxSetting,
  CRMEmailDetail,
  EmailAuthenticationDomain,
  EmailComposeSetting,
  EmailCredibilityMetric,
  EmailCredibilityReport,
  EmailInsightSetting,
  EmailParserInbox,
  EmailProviderFormValues,
  EmailProviderIntegration,
  EmailRelayServer,
  OrganizationEmailAddress,
  SalesInboxSetting,
  SalesInboxFeedItem,
  UnsubscribeLink,
} from "../../integrations/types";

type Notice = { tone: "success" | "error"; message: string } | null;
type ProviderFieldErrors = Partial<Record<"email_address" | "display_name" | "reply_to_address", string>>;
const EMAIL_AUTO_SYNC_INTERVAL_MS = 60_000;
const SALES_INBOX_PAGE_SIZE = 10;

function extractFieldErrors(error: unknown): ProviderFieldErrors {
  const payload = (error as { payload?: unknown } | undefined)?.payload;
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const result: ProviderFieldErrors = {};
  const record = payload as Record<string, unknown>;
  const mappings: Array<[keyof ProviderFieldErrors, string[]]> = [
    ["email_address", ["email_address", "email"]],
    ["display_name", ["display_name"]],
    ["reply_to_address", ["reply_to_address", "reply_to"]],
  ];

  for (const [field, keys] of mappings) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        result[field] = value;
        break;
      }
      if (Array.isArray(value) && typeof value[0] === "string") {
        result[field] = value[0];
        break;
      }
    }
  }

  return result;
}

export default function EmailIntegrationsPage() {
  const [providers, setProviders] = useState<EmailProviderIntegration[]>([]);
  const [composeSettings, setComposeSettings] = useState<EmailComposeSetting[]>([]);
  const [sharingRows, setSharingRows] = useState<any[]>([]);
  const [organizationEmails, setOrganizationEmails] = useState<OrganizationEmailAddress[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [salesInboxSettings, setSalesInboxSettings] = useState<SalesInboxSetting[]>([]);
  const [salesInboxFeed, setSalesInboxFeed] = useState<SalesInboxFeedItem[]>([]);
  const [salesInboxCount, setSalesInboxCount] = useState(0);
  const [salesInboxPage, setSalesInboxPage] = useState(1);
  const [selectedInboxEmailId, setSelectedInboxEmailId] = useState<number | null>(null);
  const [selectedInboxEmailDetail, setSelectedInboxEmailDetail] = useState<CRMEmailDetail | null>(null);
  const [loadingInboxEmailDetail, setLoadingInboxEmailDetail] = useState(false);
  const [parsers, setParsers] = useState<EmailParserInbox[]>([]);
  const [bccSettings, setBccSettings] = useState<BCCDropboxSetting[]>([]);
  const [domains, setDomains] = useState<EmailAuthenticationDomain[]>([]);
  const [relays, setRelays] = useState<EmailRelayServer[]>([]);
  const [credibilityMetrics, setCredibilityMetrics] = useState<EmailCredibilityMetric[]>([]);
  const [credibilityReport, setCredibilityReport] = useState<EmailCredibilityReport | null>(null);
  const [insights, setInsights] = useState<EmailInsightSetting[]>([]);
  const [unsubscribeLinks, setUnsubscribeLinks] = useState<UnsubscribeLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [activeDeliverabilityTab, setActiveDeliverabilityTab] = useState("authentication");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<EmailProviderIntegration | null>(null);
  const [presetProviderType, setPresetProviderType] = useState<EmailProviderIntegration["provider_type"] | undefined>();
  const [providerSubmitting, setProviderSubmitting] = useState(false);
  const [syncingProviderId, setSyncingProviderId] = useState<number | null>(null);
  const [togglingSyncProviderId, setTogglingSyncProviderId] = useState<number | null>(null);

  const [organizationModalOpen, setOrganizationModalOpen] = useState(false);
  const [editingOrganizationEmail, setEditingOrganizationEmail] = useState<OrganizationEmailAddress | null>(null);

  const [relayModalOpen, setRelayModalOpen] = useState(false);
  const [editingRelay, setEditingRelay] = useState<EmailRelayServer | null>(null);

  const [unsubscribeModalOpen, setUnsubscribeModalOpen] = useState(false);
  const [editingUnsubscribeLink, setEditingUnsubscribeLink] = useState<UnsubscribeLink | null>(null);

  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [bccAddOpen, setBccAddOpen] = useState(false);
  const [bccVerifyOpen, setBccVerifyOpen] = useState(false);

  const primaryComposeSetting = composeSettings[0] || null;
  const primaryCustomField = customFields[0] || null;
  const primarySalesInbox = salesInboxSettings[0] || null;
  const primaryParser = parsers[0] || null;
  const primaryBcc = bccSettings[0] || null;
  const primaryInsight = insights[0] || null;

  const loadSalesInboxFeed = async () => {
    const nextSalesInboxFeed = await integrationsApi
      .listSalesInboxFeedPaginated({ page: salesInboxPage, page_size: SALES_INBOX_PAGE_SIZE })
      .catch(() => ({ count: 0, next: null, previous: null, results: [] }));

    setSalesInboxFeed(nextSalesInboxFeed.results);
    setSalesInboxCount(nextSalesInboxFeed.count);
    setSelectedInboxEmailId((current) =>
      current && nextSalesInboxFeed.results.some((item) => item.id === current) ? current : null
    );
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const watchSyncLogUntilDone = async (providerId: number, logId: number) => {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await wait(5000);
      const log = await integrationsApi.getEmailSyncLog(logId).catch(() => null);
      if (!log) {
        continue;
      }
      if (log.status === "failed") {
        setError(new Error(log.error_message || "Provider sync failed."));
        return;
      }
      if (log.status === "success") {
        const lastSyncedAt = log.last_synced_at || new Date().toISOString();
        setProviders((current) =>
          current.map((item) =>
            item.id === providerId
              ? { ...item, last_synced_at: lastSyncedAt, updated_at: lastSyncedAt }
              : item
          )
        );
        const syncSource = String((log.metadata as Record<string, unknown> | undefined)?.sync_source || "");
        if (syncSource === "project_records") {
          setError(
            new Error(
              "Sync completed with fallback sample records. Configure mailbox credentials for this provider to fetch real subject/body from inbox."
            )
          );
        } else {
          setSuccess("Provider synced successfully.");
        }
        await loadSalesInboxFeed();
        return;
      }
    }
    setSuccess("Sync is still running in background. Please refresh in a moment.");
  };

  const load = async () => {
    try {
      setLoading(true);
      const [
        nextProviders,
        nextComposeSettings,
        nextSharingRows,
        nextOrganizationEmails,
        nextCustomFields,
        nextSalesInboxSettings,
        nextParsers,
        nextBccSettings,
        nextDomains,
        nextRelays,
        nextCredibilityMetrics,
        nextCredibilityReport,
        nextInsights,
        nextUnsubscribeLinks,
      ] = await Promise.all([
        integrationsApi.listEmailProviders().catch(() => []),
        integrationsApi.listComposeSettings().catch(() => []),
        integrationsApi.listEmailSharing().catch(() => []),
        integrationsApi.listOrganizationEmails().catch(() => []),
        integrationsApi.listCustomEmailFields().catch(() => []),
        integrationsApi.listSalesInboxSettings().catch(() => []),
        integrationsApi.listEmailParsers().catch(() => []),
        integrationsApi.listBCCDropboxSettings().catch(() => []),
        integrationsApi.listEmailDomains().catch(() => []),
        integrationsApi.listEmailRelays().catch(() => []),
        integrationsApi.listEmailCredibility().catch(() => []),
        integrationsApi.getEmailCredibilityReport().catch(() => null),
        integrationsApi.listEmailInsights().catch(() => []),
        integrationsApi.listUnsubscribeLinks().catch(() => []),
      ]);
      setProviders(nextProviders);
      setComposeSettings(nextComposeSettings);
      setSharingRows(nextSharingRows);
      setOrganizationEmails(nextOrganizationEmails);
      setCustomFields(nextCustomFields);
      setSalesInboxSettings(nextSalesInboxSettings);
      setParsers(nextParsers);
      setBccSettings(nextBccSettings);
      setDomains(nextDomains);
      setRelays(nextRelays);
      setCredibilityMetrics(nextCredibilityMetrics);
      setCredibilityReport(nextCredibilityReport);
      setInsights(nextInsights);
      setUnsubscribeLinks(nextUnsubscribeLinks);
      await loadSalesInboxFeed();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [salesInboxPage]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!selectedInboxEmailId) {
      setSelectedInboxEmailDetail(null);
      return;
    }

    let cancelled = false;

    const loadInboxEmailDetail = async () => {
      try {
        setLoadingInboxEmailDetail(true);
        let detail = await integrationsApi.getSyncedEmailMessage(selectedInboxEmailId);
        if (!detail.is_read) {
          detail = await integrationsApi.updateSyncedEmailMessage(selectedInboxEmailId, { is_read: true });
          setSalesInboxFeed((current) =>
            current.map((item) => (item.id === selectedInboxEmailId ? { ...item, is_read: true } : item))
          );
        }
        if (!cancelled) {
          setSelectedInboxEmailDetail(detail);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedInboxEmailDetail(null);
          setError(error);
        }
      } finally {
        if (!cancelled) {
          setLoadingInboxEmailDetail(false);
        }
      }
    };

    void loadInboxEmailDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedInboxEmailId]);

  const setSuccess = (message: string) => setNotice({ tone: "success", message });
  const setError = (error: unknown) => setNotice({ tone: "error", message: error instanceof Error ? error.message : "Action failed." });

  const runAction = async (action: () => Promise<unknown>, message: string, after?: () => void, reload = true) => {
    try {
      await action();
      setSuccess(message);
      after?.();
      if (reload) {
        await load();
      }
    } catch (error) {
      setError(error);
    }
  };

  const openCreateProvider = (providerType?: EmailProviderIntegration["provider_type"]) => {
    setEditingProvider(null);
    setPresetProviderType(providerType);
    setProviderModalOpen(true);
  };

  const providerSelectOptions = useMemo(() => providers.filter((provider) => provider.is_active), [providers]);
  const parserDefaultName = useMemo(() => {
    const defaultProvider = providers.find((provider) => provider.is_default_from) || providers[0];
    const display = defaultProvider?.display_name?.trim() || defaultProvider?.email_address?.split("@")[0] || "Email";
    return `${display} Parser`;
  }, [providers]);
  const activeProviders = useMemo(() => providers.filter((provider) => provider.is_active), [providers]);
  const autoSyncProviders = useMemo(
    () => providers.filter((provider) => provider.is_active && provider.sync_enabled && provider.sales_inbox_enabled),
    [providers]
  );
  const setupItems = useMemo(
    () => [
      {
        label: "Connect Provider",
        description: "Add at least one email provider so the CRM knows which mailbox to use.",
        done: activeProviders.length > 0,
      },
      {
        label: "Configure Sending",
        description: "Set your default sender, reply-to address, and compose defaults.",
        done: Boolean(primaryComposeSetting && primaryComposeSetting.default_from_integration),
      },
      {
        label: "Verify Inbox Flow",
        description: "Run sync and confirm that inbox messages are appearing in SalesInbox.",
        done: salesInboxFeed.length > 0,
      },
    ],
    [activeProviders.length, primaryComposeSetting, salesInboxFeed.length]
  );
  const latestInboxMessage = salesInboxFeed[0] || null;
  const latestInboxLabel = latestInboxMessage?.received_at
    ? new Date(latestInboxMessage.received_at).toLocaleString()
    : "No synced messages yet";

  useEffect(() => {
    if (autoSyncProviders.length === 0) {
      return;
    }

    let cancelled = false;
    let running = false;

    const syncProvidersSilently = async () => {
      if (running || document.visibilityState !== "visible") {
        return;
      }
      running = true;
      try {
        const results = await Promise.allSettled(
          autoSyncProviders.map((provider) => integrationsApi.syncEmailProvider(provider.id))
        );
        if (cancelled) {
          return;
        }

        const nowIso = new Date().toISOString();
        const lastSyncedByProviderId = new Map<number, string>();
        autoSyncProviders.forEach((provider, index) => {
          const result = results[index];
          if (result?.status === "fulfilled") {
            lastSyncedByProviderId.set(provider.id, result.value.log?.last_synced_at || nowIso);
          }
        });
        if (lastSyncedByProviderId.size > 0) {
          setProviders((current) =>
            current.map((provider) => {
              const lastSyncedAt = lastSyncedByProviderId.get(provider.id);
              return lastSyncedAt
                ? { ...provider, last_synced_at: lastSyncedAt, updated_at: lastSyncedAt }
                : provider;
            })
          );
        }
        await loadSalesInboxFeed();
      } catch (error) {
        console.error("Automatic email sync failed.", error);
      } finally {
        running = false;
      }
    };

    void syncProvidersSilently();
    const interval = window.setInterval(() => {
      void syncProvidersSilently();
    }, EMAIL_AUTO_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [autoSyncProviders]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <IntegrationHeader
          title="Email Integrations"
          subtitle="Configure mailbox providers, SalesInbox, parser, BCC Dropbox, deliverability, and unsubscribe settings."
          tabs={integrationsNavTabs}
          activePath="/integrations/email"
          action={<button type="button" onClick={() => openCreateProvider()} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">Add Provider</button>}
        />

        {notice ? (
          <div className="pointer-events-none fixed right-4 top-4 z-50">
            <div className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
              {notice.message}
            </div>
          </div>
        ) : null}

        {loading ? <div className="text-sm text-slate-500">Loading email integrations...</div> : null}

        <IntegrationSetupChecklist
          title="Setup Progress"
          subtitle="Use this order for email integrations: connect a mailbox, configure sending, then confirm synced inbox activity."
          items={setupItems}
        />

        <CRMSectionCard title="Step 1: Connect Mailbox">
          <p className="mb-4 text-sm text-slate-600">
            Start by connecting a provider. Once a mailbox is active, you can choose a default sender and begin syncing conversations into the CRM.
          </p>
          <EmailProvidersList
            providers={providers}
            syncingProviderId={syncingProviderId}
            togglingSyncProviderId={togglingSyncProviderId}
            onCreate={openCreateProvider}
            onEdit={(provider) => {
              setEditingProvider(provider);
              setPresetProviderType(undefined);
              setProviderModalOpen(true);
            }}
            onSync={(provider) => {
              void (async () => {
                try {
                  setSyncingProviderId(provider.id);
                  const result = await integrationsApi.syncEmailProvider(provider.id);
                  if (result.log?.status === "running") {
                    setSuccess(result.message || "Sync started. This may take a minute.");
                    setSyncingProviderId(null);
                    if (result.log?.id) {
                      void watchSyncLogUntilDone(provider.id, result.log.id);
                    }
                  } else {
                    const lastSyncedAt = result.log?.last_synced_at || new Date().toISOString();
                    setProviders((current) =>
                      current.map((item) =>
                        item.id === provider.id
                          ? { ...item, last_synced_at: lastSyncedAt, updated_at: lastSyncedAt }
                          : item
                      )
                    );
                    setSuccess(result.message || `Synced ${result.emails_synced} emails successfully.`);
                    await loadSalesInboxFeed();
                    setSyncingProviderId(null);
                  }
                } catch (error) {
                  setError(error);
                  setSyncingProviderId(null);
                }
              })();
            }}
            onToggleSync={(provider, enabled) => {
              void (async () => {
                try {
                  setTogglingSyncProviderId(provider.id);
                  await integrationsApi.updateEmailProvider(provider.id, { sync_enabled: enabled });
                  setProviders((current) =>
                    current.map((item) =>
                      item.id === provider.id
                        ? { ...item, sync_enabled: enabled, updated_at: new Date().toISOString() }
                        : item
                    )
                  );
                  setSuccess(enabled ? "Sync enabled successfully." : "Provider unsynced successfully.");
                } catch (error) {
                  setError(error);
                } finally {
                  setTogglingSyncProviderId(null);
                }
              })();
            }}
            onDelete={(provider) => {
              if (!window.confirm(`Delete provider ${provider.email_address}?`)) return;
              void runAction(
                () => integrationsApi.deleteEmailProvider(provider.id),
                "Provider deleted successfully.",
                () => {
                  setProviders((current) => current.filter((item) => item.id !== provider.id));
                },
                false
              );
            }}
          />
        </CRMSectionCard>

        <CRMSectionCard title="Step 2: Configure Sending">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Choose the mailbox used for sending and replying. Keep the basic sender setup here; advanced settings can stay below.
            </p>
            <ComposeSettingsForm
              value={primaryComposeSetting}
              providers={providerSelectOptions}
              onSubmit={(payload) =>
                void runAction(
                  () => primaryComposeSetting ? integrationsApi.updateComposeSetting(primaryComposeSetting.id, payload) : integrationsApi.createComposeSetting(payload),
                  "Compose settings saved successfully."
                )
              }
            />
            <OrganizationEmailsTable
              rows={organizationEmails}
              onCreate={() => {
                setEditingOrganizationEmail(null);
                setOrganizationModalOpen(true);
              }}
              onEdit={(row) => {
                setEditingOrganizationEmail(row);
                setOrganizationModalOpen(true);
              }}
              onConfirm={(row) => void runAction(() => integrationsApi.confirmOrganizationEmail(row.id), "Organization email confirmed successfully.")}
            />
          </div>
        </CRMSectionCard>

        <CRMSectionCard title="Step 3: Test Sync And Inbox">
          <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">Sync Status</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Active Providers</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">{activeProviders.length}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Inbox Messages</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">{salesInboxCount}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Latest Activity</div>
                    <div className="mt-1 text-sm font-medium text-slate-700">{latestInboxLabel}</div>
                  </div>
                </div>
              </div>
              <SalesInboxCard
                setting={primarySalesInbox}
                onSave={(payload) =>
                  void runAction(
                    () => primarySalesInbox ? integrationsApi.updateSalesInboxSetting(primarySalesInbox.id, payload) : integrationsApi.createSalesInboxSetting(payload),
                    "SalesInbox settings saved."
                  )
                }
              />
            </div>
            <SalesInboxFeed
              items={salesInboxFeed}
              selectedEmailId={selectedInboxEmailId}
              selectedEmailDetail={selectedInboxEmailDetail}
              loadingDetail={loadingInboxEmailDetail}
              onSelect={(item) => setSelectedInboxEmailId(item.id)}
              onClose={() => setSelectedInboxEmailId(null)}
            />
            <div className="flex items-center justify-between px-1 text-sm text-slate-600">
              <div>
                Showing {salesInboxFeed.length ? (salesInboxPage - 1) * SALES_INBOX_PAGE_SIZE + 1 : 0}
                {" "}-{" "}
                {Math.min(salesInboxPage * SALES_INBOX_PAGE_SIZE, salesInboxCount)} of {salesInboxCount}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSalesInboxPage((page) => Math.max(1, page - 1))}
                  disabled={salesInboxPage === 1}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setSalesInboxPage((page) => page + 1)}
                  disabled={salesInboxPage * SALES_INBOX_PAGE_SIZE >= salesInboxCount}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </CRMSectionCard>

        <CRMSectionCard
          title="Advanced Settings"
          action={
            <button
              type="button"
              onClick={() => setAdvancedOpen((previous) => !previous)}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
            >
              {advancedOpen ? "Hide Advanced" : "Show Advanced"}
            </button>
          }
        >
          <p className="mb-4 text-sm text-slate-600">
            Use these only after the basic mailbox and inbox workflow is working. They are helpful, but not required for day-one setup.
          </p>
          {advancedOpen ? (
            <div className="space-y-4">
              <EmailSharingTable rows={sharingRows} />

              <CustomEmailFieldsToggle
                value={primaryCustomField}
                onToggle={(next) =>
                  void runAction(
                    () => primaryCustomField ? integrationsApi.updateCustomEmailFields(primaryCustomField.id, { is_enabled: next }) : integrationsApi.createCustomEmailFields({ is_enabled: next }),
                    "Custom email field preference updated."
                  )
                }
              />

              <EmailParserCard
                parser={primaryParser}
                onGenerate={() => void runAction(() => integrationsApi.generateEmailParser({ parser_name: parserDefaultName, create_record_type: "lead" }), "Parser inbox generated successfully.")}
                onUpdate={(payload) => primaryParser ? void runAction(() => integrationsApi.updateEmailParser(primaryParser.id, payload), "Parser updated successfully.") : undefined}
                onIngestTest={() =>
                  primaryParser
                    ? void runAction(
                        () =>
                          integrationsApi.ingestEmailParser(primaryParser.id, {
                            from_email: "inbox.lead@example.com",
                            from_name: "Inbox Lead",
                            subject: "Parser inbox verification",
                            company: "Inbound Website Lead",
                          }),
                        "Parser test ingest completed."
                      )
                    : undefined
                }
              />

              <BCCDropboxCard
                setting={primaryBcc}
                onCreate={() => void runAction(() => integrationsApi.createBCCDropboxSetting({ exclude_domains: [], search_pattern_order: ["contacts", "leads", "create_new_lead_if_not_found"], is_active: true }), "BCC Dropbox created successfully.")}
                onUpdate={(payload) => primaryBcc ? void runAction(() => integrationsApi.updateBCCDropboxSetting(primaryBcc.id, payload), "BCC Dropbox updated successfully.") : undefined}
                onRegenerate={() => primaryBcc ? void runAction(() => integrationsApi.regenerateBCCDropbox(primaryBcc.id), "BCC Dropbox address regenerated.") : undefined}
                onAddEmail={() => setBccAddOpen(true)}
                onVerifyEmail={() => setBccVerifyOpen(true)}
              />

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {deliverabilityTabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveDeliverabilityTab(tab.value)}
                      className={`rounded-md px-3 py-2 text-sm font-medium ${activeDeliverabilityTab === tab.value ? "bg-green-600 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeDeliverabilityTab === "authentication" ? (
                  <EmailAuthenticationTable
                    rows={domains}
                    onAdd={() => setAddDomainOpen(true)}
                    onCheck={(row) => void runAction(() => integrationsApi.checkEmailDomainStatus(row.id), "Domain authentication status checked.")}
                  />
                ) : null}

                {activeDeliverabilityTab === "relay" ? (
                  <EmailRelayTable
                    rows={relays}
                    onAdd={() => {
                      setEditingRelay(null);
                      setRelayModalOpen(true);
                    }}
                    onEdit={(row) => {
                      setEditingRelay(row);
                      setRelayModalOpen(true);
                    }}
                    onDelete={(row) => {
                      if (!window.confirm(`Delete relay ${row.server_name}?`)) return;
                      void runAction(() => integrationsApi.deleteEmailRelay(row.id), "Relay deleted successfully.");
                    }}
                  />
                ) : null}

                {activeDeliverabilityTab === "credibility" ? (
                  <EmailCredibilityDashboard metrics={credibilityMetrics} report={credibilityReport} />
                ) : null}
              </div>

              <EmailInsightsPanel
                setting={primaryInsight}
                onSave={(payload) =>
                  void runAction(
                    () => primaryInsight ? integrationsApi.updateEmailInsight(primaryInsight.id, payload) : integrationsApi.createEmailInsight(payload),
                    "Email insight settings saved."
                  )
                }
              />

              <UnsubscribeLinksTable
                rows={unsubscribeLinks}
                onCreate={() => {
                  setEditingUnsubscribeLink(null);
                  setUnsubscribeModalOpen(true);
                }}
                onEdit={(row) => {
                  setEditingUnsubscribeLink(row);
                  setUnsubscribeModalOpen(true);
                }}
                onDelete={(row) => {
                  if (!window.confirm(`Delete unsubscribe link "${row.name}"?`)) return;
                  void runAction(() => integrationsApi.deleteUnsubscribeLink(row.id), "Unsubscribe link deleted.");
                }}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Advanced email tools like parser, BCC Dropbox, relay, credibility, and unsubscribe settings are hidden until you need them.
            </div>
          )}
        </CRMSectionCard>

        <EmailProviderForm
          open={providerModalOpen}
          initialValue={editingProvider}
          presetProviderType={presetProviderType}
          submitting={providerSubmitting}
          onClose={() => setProviderModalOpen(false)}
          onSubmit={async (values: EmailProviderFormValues) => {
            try {
              setProviderSubmitting(true);
              if (editingProvider) {
                await integrationsApi.updateEmailProvider(editingProvider.id, values);
                setSuccess("Email provider updated successfully");
              } else {
                await integrationsApi.createEmailProvider(values);
                setSuccess("Email provider added successfully");
              }
              setProviderModalOpen(false);
              await load();
              return { success: true };
            } catch (error) {
              const fieldErrors = extractFieldErrors(error);
              setError(error);
              return {
                success: false,
                fieldErrors,
                formError:
                  Object.keys(fieldErrors).length > 0
                    ? ""
                    : error instanceof Error
                      ? error.message
                      : "Unable to save email provider.",
              };
            } finally {
              setProviderSubmitting(false);
            }
          }}
        />

        <OrganizationEmailForm
          open={organizationModalOpen}
          initialValue={editingOrganizationEmail}
          onClose={() => setOrganizationModalOpen(false)}
          onSubmit={(values) =>
            void runAction(
              () => editingOrganizationEmail ? integrationsApi.updateOrganizationEmail(editingOrganizationEmail.id, values) : integrationsApi.createOrganizationEmail(values),
              editingOrganizationEmail ? "Organization email updated." : "Organization email added.",
              () => setOrganizationModalOpen(false)
            )
          }
        />

        <EmailRelayForm
          open={relayModalOpen}
          initialValue={editingRelay}
          onClose={() => setRelayModalOpen(false)}
          onSubmit={(values) =>
            void runAction(
              () => editingRelay ? integrationsApi.updateEmailRelay(editingRelay.id, values) : integrationsApi.createEmailRelay(values),
              editingRelay ? "Relay updated successfully." : "Relay created successfully.",
              () => setRelayModalOpen(false)
            )
          }
        />

        <UnsubscribeLinkForm
          open={unsubscribeModalOpen}
          initialValue={editingUnsubscribeLink}
          onClose={() => setUnsubscribeModalOpen(false)}
          onSubmit={(values) =>
            void runAction(
              () => editingUnsubscribeLink ? integrationsApi.updateUnsubscribeLink(editingUnsubscribeLink.id, values) : integrationsApi.createUnsubscribeLink(values),
              editingUnsubscribeLink ? "Unsubscribe link updated." : "Unsubscribe link created.",
              () => setUnsubscribeModalOpen(false)
            )
          }
        />

        <AddDomainModal
          open={addDomainOpen}
          onClose={() => setAddDomainOpen(false)}
          onSubmit={(domain) =>
            void runAction(
              () => integrationsApi.createEmailDomain({ domain_name: domain }),
              "Authentication domain added.",
              () => setAddDomainOpen(false)
            )
          }
        />

        <BCCDropboxAddEmailModal
          open={bccAddOpen}
          onClose={() => setBccAddOpen(false)}
          onSubmit={(email) => primaryBcc ? void runAction(() => integrationsApi.addBCCVerifiedEmail(primaryBcc.id, email), "Verified email added.", () => setBccAddOpen(false)) : undefined}
        />

        <BCCDropboxVerifyModal
          open={bccVerifyOpen}
          onClose={() => setBccVerifyOpen(false)}
          onSubmit={(payload) => primaryBcc ? void runAction(() => integrationsApi.verifyBCCEmail(primaryBcc.id, payload.email_address, payload.verification_code), "Email verified successfully.", () => setBccVerifyOpen(false)) : undefined}
        />
      </div>
    </DashboardLayout>
  );
}
