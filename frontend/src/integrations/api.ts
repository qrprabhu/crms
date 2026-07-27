import { apiRequest } from "../api/client";
import type {
  BCCDropboxSetting,
  CustomEmailFieldPreference,
  CRMEmailDetail,
  EmailAuthenticationDomain,
  EmailComposeSetting,
  EmailCredibilityMetric,
  EmailCredibilityReport,
  EmailInsightSetting,
  EmailParserInbox,
  EmailProviderFormValues,
  EmailProviderIntegration,
  EmailProviderSyncResult,
  EmailRelayFormValues,
  EmailRelayServer,
  EmailSharingPermission,
  EmailSyncLog,
  IntegrationFilters,
  IntegrationLeadSourceEvent,
  OrganizationEmailAddress,
  OrganizationEmailFormValues,
  PaginatedResponse,
  ParserGeneratePayload,
  ParserIngestPayload,
  SalesInboxFeedItem,
  SalesInboxSetting,
  SocialAccount,
  SocialBrand,
  SocialConnectPayload,
  SocialLeadAutomationRule,
  SocialMessage,
  SocialPermissionSetting,
  UnsubscribeLink,
  UnsubscribeLinkFormValues,
  VisitorLeadEvent,
  VisitorTrackingPortal,
  VisitorTrackingSetting,
} from "./types";

type ApiEnvelope<T> = {
  message: string;
  data: T;
};

function toList<T>(payload: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

function query(filters?: IntegrationFilters) {
  if (!filters) return undefined;
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

async function getList<T>(path: string, filters?: IntegrationFilters) {
  const data = await apiRequest<T[] | PaginatedResponse<T>>(path, { query: query(filters) });
  return toList(data);
}

async function getPaginatedList<T>(path: string, filters?: IntegrationFilters) {
  return apiRequest<PaginatedResponse<T>>(path, { query: query(filters) });
}

function post<T>(path: string, payload?: unknown) {
  return apiRequest<T>(path, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

function patch<T>(path: string, payload?: unknown) {
  return apiRequest<T>(path, {
    method: "PATCH",
    body: JSON.stringify(payload ?? {}),
  });
}

function remove(path: string) {
  return apiRequest<void>(path, { method: "DELETE" });
}

export const integrationsApi = {
  listEmailProviders: (filters?: IntegrationFilters) => getList<EmailProviderIntegration>("/integrations/email/providers", filters),
  createEmailProvider: async (payload: EmailProviderFormValues) => {
    const response = await post<ApiEnvelope<EmailProviderIntegration>>("/integrations/email/providers", {
      provider_type: payload.provider_type,
      protocol_type: payload.protocol_type,
      email: payload.email_address,
      display_name: payload.display_name,
      reply_to: payload.reply_to_address || null,
      is_active: payload.is_active,
      is_default: payload.is_default_from,
      enable_sync: payload.sync_enabled,
      enable_crm_sync: payload.crm_sync_enabled,
      enable_sales_inbox: payload.sales_inbox_enabled,
      enable_notifications: payload.instant_notification_enabled,
      access_token: payload.access_token?.trim() || null,
      refresh_token: payload.refresh_token?.trim() || null,
      token_expiry: payload.token_expiry?.trim() || null,
    });
    return response.data;
  },
  updateEmailProvider: async (id: number, payload: Partial<EmailProviderFormValues>) => {
    const response = await patch<ApiEnvelope<EmailProviderIntegration>>(`/integrations/email/providers/${id}`, {
      ...(payload.provider_type !== undefined ? { provider_type: payload.provider_type } : {}),
      ...(payload.protocol_type !== undefined ? { protocol_type: payload.protocol_type } : {}),
      ...(payload.email_address !== undefined ? { email: payload.email_address } : {}),
      ...(payload.display_name !== undefined ? { display_name: payload.display_name } : {}),
      ...(payload.reply_to_address !== undefined ? { reply_to: payload.reply_to_address || null } : {}),
      ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
      ...(payload.is_default_from !== undefined ? { is_default: payload.is_default_from } : {}),
      ...(payload.sync_enabled !== undefined ? { enable_sync: payload.sync_enabled } : {}),
      ...(payload.crm_sync_enabled !== undefined ? { enable_crm_sync: payload.crm_sync_enabled } : {}),
      ...(payload.sales_inbox_enabled !== undefined ? { enable_sales_inbox: payload.sales_inbox_enabled } : {}),
      ...(payload.instant_notification_enabled !== undefined ? { enable_notifications: payload.instant_notification_enabled } : {}),
      ...(payload.access_token !== undefined ? { access_token: payload.access_token.trim() || null } : {}),
      ...(payload.refresh_token !== undefined ? { refresh_token: payload.refresh_token.trim() || null } : {}),
      ...(payload.token_expiry !== undefined ? { token_expiry: payload.token_expiry.trim() || null } : {}),
    });
    return response.data;
  },
  deleteEmailProvider: (id: number) => remove(`/integrations/email/providers/${id}`),
  syncEmailProvider: (id: number, sync_type = "incremental_sync") => post<EmailProviderSyncResult>(`/integrations/email/providers/${id}/sync`, { sync_type }),

  listComposeSettings: () => getList<EmailComposeSetting>("/integrations/email/compose-settings"),
  createComposeSetting: (payload: Partial<EmailComposeSetting>) => post<EmailComposeSetting>("/integrations/email/compose-settings", payload),
  updateComposeSetting: (id: number, payload: Partial<EmailComposeSetting>) => patch<EmailComposeSetting>(`/integrations/email/compose-settings/${id}`, payload),

  listEmailSharing: () => getList<EmailSharingPermission>("/integrations/email/sharing"),
  createEmailSharing: (payload: Partial<EmailSharingPermission>) => post<EmailSharingPermission>("/integrations/email/sharing", payload),
  updateEmailSharing: (id: number, payload: Partial<EmailSharingPermission>) => patch<EmailSharingPermission>(`/integrations/email/sharing/${id}`, payload),

  listOrganizationEmails: (filters?: IntegrationFilters) => getList<OrganizationEmailAddress>("/integrations/email/organization-emails", filters),
  createOrganizationEmail: (payload: OrganizationEmailFormValues) => post<OrganizationEmailAddress>("/integrations/email/organization-emails", payload),
  updateOrganizationEmail: (id: number, payload: Partial<OrganizationEmailFormValues>) => patch<OrganizationEmailAddress>(`/integrations/email/organization-emails/${id}`, payload),
  confirmOrganizationEmail: (id: number) => post<OrganizationEmailAddress>(`/integrations/email/organization-emails/${id}/confirm`),

  listCustomEmailFields: () => getList<CustomEmailFieldPreference>("/integrations/email/custom-email-fields"),
  createCustomEmailFields: (payload: Partial<CustomEmailFieldPreference>) => post<CustomEmailFieldPreference>("/integrations/email/custom-email-fields", payload),
  updateCustomEmailFields: (id: number, payload: Partial<CustomEmailFieldPreference>) => patch<CustomEmailFieldPreference>(`/integrations/email/custom-email-fields/${id}`, payload),

  listSalesInboxSettings: () => getList<SalesInboxSetting>("/integrations/email/sales-inbox"),
  createSalesInboxSetting: (payload: Partial<SalesInboxSetting>) => post<SalesInboxSetting>("/integrations/email/sales-inbox", payload),
  updateSalesInboxSetting: (id: number, payload: Partial<SalesInboxSetting>) => patch<SalesInboxSetting>(`/integrations/email/sales-inbox/${id}`, payload),
  listSalesInboxFeed: (filters?: IntegrationFilters) => getList<SalesInboxFeedItem>("/integrations/email/sales-inbox/feed", filters),
  listSalesInboxFeedPaginated: (filters?: IntegrationFilters) => getPaginatedList<SalesInboxFeedItem>("/integrations/email/sales-inbox/feed", filters),
  listSyncedEmailMessages: (filters?: IntegrationFilters) => getList<SalesInboxFeedItem>("/integrations/email/messages", filters),
  listLeadRecordEmails: (id: string | number) =>
    apiRequest<SalesInboxFeedItem[] | PaginatedResponse<SalesInboxFeedItem>>(`/integrations/leads/${id}/emails`, {
      forceFresh: true,
      cacheTtlMs: 0,
    }).then((data) => toList(data)),
  listContactRecordEmails: (id: string | number) =>
    apiRequest<SalesInboxFeedItem[] | PaginatedResponse<SalesInboxFeedItem>>(`/integrations/contacts/${id}/emails`, {
      forceFresh: true,
      cacheTtlMs: 0,
    }).then((data) => toList(data)),
  listAccountRecordEmails: (id: string | number) =>
    apiRequest<SalesInboxFeedItem[] | PaginatedResponse<SalesInboxFeedItem>>(`/integrations/accounts/${id}/emails`, {
      forceFresh: true,
      cacheTtlMs: 0,
    }).then((data) => toList(data)),
  listDealRecordEmails: (id: string | number) =>
    apiRequest<SalesInboxFeedItem[] | PaginatedResponse<SalesInboxFeedItem>>(`/integrations/deals/${id}/emails`, {
      forceFresh: true,
      cacheTtlMs: 0,
    }).then((data) => toList(data)),
  listCaseRecordEmails: (id: string | number) =>
    apiRequest<SalesInboxFeedItem[] | PaginatedResponse<SalesInboxFeedItem>>(`/integrations/cases/${id}/emails`, {
      forceFresh: true,
      cacheTtlMs: 0,
    }).then((data) => toList(data)),
  getSyncedEmailMessage: (id: number) => apiRequest<CRMEmailDetail>(`/email/${id}/`),
  updateSyncedEmailMessage: (id: number, payload: Partial<Pick<CRMEmailDetail, "is_read" | "is_starred">>) =>
    apiRequest<CRMEmailDetail>(`/email/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  listEmailParsers: () => getList<EmailParserInbox>("/integrations/email/parser"),
  generateEmailParser: (payload: ParserGeneratePayload) => post<EmailParserInbox>("/integrations/email/parser/generate", payload),
  updateEmailParser: (id: number, payload: Partial<EmailParserInbox>) => patch<EmailParserInbox>(`/integrations/email/parser/${id}`, payload),
  ingestEmailParser: (id: number, payload: ParserIngestPayload) => post<{ event_id: number; lead_id?: number | null; contact_id?: number | null; support_case_id?: number | null }>(`/integrations/email/parser/${id}/ingest`, payload),

  listBCCDropboxSettings: () => getList<BCCDropboxSetting>("/integrations/email/bcc-dropbox"),
  createBCCDropboxSetting: (payload: Partial<BCCDropboxSetting>) => post<BCCDropboxSetting>("/integrations/email/bcc-dropbox", payload),
  updateBCCDropboxSetting: (id: number, payload: Partial<BCCDropboxSetting>) => patch<BCCDropboxSetting>(`/integrations/email/bcc-dropbox/${id}`, payload),
  addBCCVerifiedEmail: (id: number, email_address: string) => post(`/integrations/email/bcc-dropbox/${id}/add-email`, { email_address }),
  verifyBCCEmail: (id: number, email_address: string, verification_code: string) => post(`/integrations/email/bcc-dropbox/${id}/verify-email`, { email_address, verification_code }),
  regenerateBCCDropbox: (id: number) => post<BCCDropboxSetting>(`/integrations/email/bcc-dropbox/${id}/regenerate`),

  listEmailDomains: (filters?: IntegrationFilters) => getList<EmailAuthenticationDomain>("/integrations/email/deliverability/domains", filters),
  createEmailDomain: (payload: Partial<EmailAuthenticationDomain>) => post<EmailAuthenticationDomain>("/integrations/email/deliverability/domains", payload),
  updateEmailDomain: (id: number, payload: Partial<EmailAuthenticationDomain>) => patch<EmailAuthenticationDomain>(`/integrations/email/deliverability/domains/${id}`, payload),
  checkEmailDomainStatus: (id: number) => post<EmailAuthenticationDomain>(`/integrations/email/deliverability/domains/${id}/check-status`),

  listEmailRelays: () => getList<EmailRelayServer>("/integrations/email/deliverability/relay"),
  createEmailRelay: (payload: EmailRelayFormValues) => post<EmailRelayServer>("/integrations/email/deliverability/relay", payload),
  updateEmailRelay: (id: number, payload: Partial<EmailRelayFormValues>) => patch<EmailRelayServer>(`/integrations/email/deliverability/relay/${id}`, payload),
  deleteEmailRelay: (id: number) => remove(`/integrations/email/deliverability/relay/${id}`),

  listEmailCredibility: () => getList<EmailCredibilityMetric>("/integrations/email/deliverability/credibility"),
  getEmailCredibilityReport: () => apiRequest<EmailCredibilityReport>("/integrations/email/deliverability/credibility/report"),

  listEmailInsights: () => getList<EmailInsightSetting>("/integrations/email/insights"),
  createEmailInsight: (payload: Partial<EmailInsightSetting>) => post<EmailInsightSetting>("/integrations/email/insights", payload),
  updateEmailInsight: (id: number, payload: Partial<EmailInsightSetting>) => patch<EmailInsightSetting>(`/integrations/email/insights/${id}`, payload),

  listUnsubscribeLinks: () => getList<UnsubscribeLink>("/integrations/email/unsubscribe-links"),
  createUnsubscribeLink: (payload: UnsubscribeLinkFormValues) => post<UnsubscribeLink>("/integrations/email/unsubscribe-links", payload),
  updateUnsubscribeLink: (id: number, payload: Partial<UnsubscribeLinkFormValues>) => patch<UnsubscribeLink>(`/integrations/email/unsubscribe-links/${id}`, payload),
  deleteUnsubscribeLink: (id: number) => remove(`/integrations/email/unsubscribe-links/${id}`),

  listSocialBrands: () => getList<SocialBrand>("/integrations/social/brands"),
  createSocialBrand: (payload: Partial<SocialBrand>) => post<SocialBrand>("/integrations/social/brands", payload),
  updateSocialBrand: (id: number, payload: Partial<SocialBrand>) => patch<SocialBrand>(`/integrations/social/brands/${id}`, payload),
  deleteSocialBrand: (id: number) => remove(`/integrations/social/brands/${id}`),

  listSocialAccounts: (filters?: IntegrationFilters) => getList<SocialAccount>("/integrations/social/accounts", filters),
  createSocialAccount: (payload: Partial<SocialAccount>) => post<SocialAccount>("/integrations/social/accounts", payload),
  updateSocialAccount: (id: number, payload: Partial<SocialAccount>) => patch<SocialAccount>(`/integrations/social/accounts/${id}`, payload),
  deleteSocialAccount: (id: number) => remove(`/integrations/social/accounts/${id}`),
  connectSocialAccount: (id: number, payload: SocialConnectPayload) => post<SocialAccount>(`/integrations/social/accounts/${id}/connect`, payload),
  disconnectSocialAccount: (id: number) => post<SocialAccount>(`/integrations/social/accounts/${id}/disconnect`),
  syncSocialAccount: (id: number) => post<{ message: string; messages_synced: number; last_synced_at: string | null }>(`/integrations/social/accounts/${id}/sync`),
  startFacebookSocialOAuth: (id: number) => post<{ auth_url: string }>(`/integrations/social/accounts/${id}/facebook/oauth/start`),

  listSocialAdminSettings: () => getList<SocialPermissionSetting>("/integrations/social/admin-settings"),
  createSocialAdminSetting: (payload: Partial<SocialPermissionSetting>) => post<SocialPermissionSetting>("/integrations/social/admin-settings", payload),
  updateSocialAdminSetting: (id: number, payload: Partial<SocialPermissionSetting>) => patch<SocialPermissionSetting>(`/integrations/social/admin-settings/${id}`, payload),

  listSocialAutomationRules: () => getList<SocialLeadAutomationRule>("/integrations/social/automation-rules"),
  createSocialAutomationRule: (payload: Partial<SocialLeadAutomationRule>) => post<SocialLeadAutomationRule>("/integrations/social/automation-rules", payload),
  updateSocialAutomationRule: (id: number, payload: Partial<SocialLeadAutomationRule>) => patch<SocialLeadAutomationRule>(`/integrations/social/automation-rules/${id}`, payload),
  deleteSocialAutomationRule: (id: number) => remove(`/integrations/social/automation-rules/${id}`),
  listSocialMessages: (filters?: IntegrationFilters) => getList<SocialMessage>("/integrations/social/messages", filters),
  createSocialMessage: (payload: Partial<SocialMessage>) => post<SocialMessage>("/integrations/social/messages", payload),

  listVisitorPortals: (filters?: IntegrationFilters) => getList<VisitorTrackingPortal>("/integrations/visitors/portals", filters),
  createVisitorPortal: (payload: Partial<VisitorTrackingPortal>) => post<VisitorTrackingPortal>("/integrations/visitors/portals", payload),
  updateVisitorPortal: (id: number, payload: Partial<VisitorTrackingPortal>) => patch<VisitorTrackingPortal>(`/integrations/visitors/portals/${id}`, payload),
  deactivateVisitorPortal: (id: number) => post<VisitorTrackingPortal>(`/integrations/visitors/portals/${id}/deactivate`),

  listVisitorSettings: () => getList<VisitorTrackingSetting>("/integrations/visitors/settings"),
  createVisitorSetting: (payload: Partial<VisitorTrackingSetting>) => post<VisitorTrackingSetting>("/integrations/visitors/settings", payload),
  updateVisitorSetting: (id: number, payload: Partial<VisitorTrackingSetting>) => patch<VisitorTrackingSetting>(`/integrations/visitors/settings/${id}`, payload),
  getVisitorTrackingCode: (id: number) => apiRequest<{ tracking_code: string }>(`/integrations/visitors/settings/${id}/tracking-code`),

  listVisitorEvents: (filters?: IntegrationFilters) => getList<VisitorLeadEvent>("/integrations/visitors/events", filters),
  createVisitorEvent: (payload: Partial<VisitorLeadEvent>) => post<VisitorLeadEvent>("/integrations/visitors/events", payload),
  convertVisitorEventToLead: (id: number) => post(`/integrations/visitors/events/${id}/convert-to-lead`),
  linkVisitorEventToLead: (id: number, lead_id?: number) => post(`/integrations/visitors/events/${id}/link-lead`, lead_id ? { lead_id } : {}),

  listLeadSourceEvents: (filters?: IntegrationFilters) => getList<IntegrationLeadSourceEvent>("/integrations/lead-source-events", filters),
  listEmailSyncLogs: () => getList<EmailSyncLog>("/integrations/email/sync-logs"),
  getEmailSyncLog: (id: number) => apiRequest<EmailSyncLog>(`/integrations/email/sync-logs/${id}`),
};
