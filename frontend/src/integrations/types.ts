export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type IntegrationProviderType = "zoho_mail" | "gmail" | "yahoo" | "office365" | "outlook" | "other";
export type IntegrationProtocolType = "imap_oauth" | "imap" | "smtp" | "relay";
export type SharingMode = "private" | "public" | "shared" | "role_based";
export type UsageScope = "standard" | "all_users" | "selected_profiles";
export type ConfirmationStatus = "pending" | "confirmed";
export type AuthenticationStatus = "not_applicable" | "available" | "pending" | "authenticated" | "failed";
export type CreateRecordType = "lead" | "contact" | "case" | "custom";
export type SecureConnection = "ssl" | "tls" | "never";
export type UnsubscribeLocationType = "standard_page" | "custom_page";
export type UnsubscribeActionType = "display_message" | "redirect_url";
export type SocialPlatform = "facebook" | "x";
export type SocialTriggerType = "mention" | "comment" | "like" | "retweet" | "message";
export type SourceType = "email" | "social" | "website" | "parser" | "bcc_dropbox" | "salesiq";
export type SyncType = "full_sync" | "incremental_sync" | "webhook_sync" | "parser_ingest";
export type SyncStatus = "pending" | "running" | "success" | "failed";
export type MessageDirection = "incoming" | "outgoing";
export type MessageStatus = "draft" | "sent" | "received" | "failed" | "scheduled";
export type PushVisitorsAs = "lead" | "contact";

export type SelectOption = {
  value: string;
  label: string;
};

export type UserSummary = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

export type IntegrationProviderCard = {
  key: IntegrationProviderType;
  title: string;
  description: string;
  ctaLabel: string;
};

export type EmailProviderIntegration = {
  id: number;
  provider_type: IntegrationProviderType;
  protocol_type: IntegrationProtocolType;
  email_address: string;
  display_name: string | null;
  reply_to_address: string | null;
  is_active: boolean;
  is_default_from: boolean;
  sync_enabled: boolean;
  sales_inbox_enabled: boolean;
  instant_notification_enabled: boolean;
  crm_sync_enabled: boolean;
  created_by: number | null;
  created_by_email?: string | null;
  token_expiry?: string | null;
  has_access_token?: boolean;
  has_refresh_token?: boolean;
  created_at: string;
  updated_at: string;
  last_synced_at?: string | null;
};

export type EmailProviderFormValues = {
  provider_type: IntegrationProviderType;
  protocol_type: IntegrationProtocolType;
  email_address: string;
  display_name: string;
  reply_to_address: string;
  is_active: boolean;
  is_default_from: boolean;
  sync_enabled: boolean;
  sales_inbox_enabled: boolean;
  instant_notification_enabled: boolean;
  crm_sync_enabled: boolean;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: string;
};

export type EmailComposeSetting = {
  id: number;
  user: number | null;
  default_font_family: string;
  default_font_size: string;
  default_from_integration: number | null;
  default_from_integration_label?: string | null;
  default_reply_to_integration: number | null;
  default_reply_to_integration_label?: string | null;
  email_signature_name: string | null;
  email_signature_html: string | null;
  is_plain_text: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailSharingPermission = {
  id: number;
  user: number;
  user_email?: string | null;
  configuration_type: string;
  sharing_mode: SharingMode;
  shared_with_profiles: string[];
  excluded_domains: string[];
  preferences: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationEmailAddress = {
  id: number;
  display_name: string;
  email_address: string;
  usage_scope: UsageScope;
  confirmation_status: ConfirmationStatus;
  authentication_status: AuthenticationStatus;
  is_verified: boolean;
  verified_at: string | null;
  created_by: number | null;
  created_by_email?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationEmailFormValues = {
  display_name: string;
  email_address: string;
  usage_scope: UsageScope;
  is_active?: boolean;
};

export type CustomEmailFieldPreference = {
  id: number;
  is_enabled: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SalesInboxSetting = {
  id: number;
  is_enabled: boolean;
  provider_integration: number | null;
  provider_integration_label?: string | null;
  is_active: boolean;
  crm_context_enabled: boolean;
  conversations_enabled: boolean;
  timeline_enabled: boolean;
  prioritized_columns_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type SalesInboxFeedItem = {
  id: number;
  subject: string;
  from_email: string;
  counterparty_email?: string | null;
  preview_text?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  direction: MessageDirection;
  status: MessageStatus;
  received_at: string;
  sent_at: string | null;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  thread_id: string | null;
  lead_id: number | null;
  lead_name: string | null;
  contact_id: number | null;
  contact_name: string | null;
  deal_id: number | null;
  deal_name: string | null;
  account_id: number | null;
  account_name: string | null;
  support_case_id: number | null;
  support_case_name: string | null;
};

export type EmailAttachment = {
  id: number;
  file_name: string;
  file_type: string | null;
  file_size: number;
  file_url: string | null;
  created_at: string;
};

export type EmailRecordLink = {
  id: number;
  lead: number | null;
  lead_name: string | null;
  contact: number | null;
  contact_name: string | null;
  account: number | null;
  account_name: string | null;
  deal: number | null;
  deal_name: string | null;
  support_case: number | null;
  support_case_name: string | null;
  created_at: string;
};

export type CRMEmailDetail = SalesInboxFeedItem & {
  provider_account_id: number | null;
  provider_email: string | null;
  body_text?: string | null;
  body_html?: string | null;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  attachments: EmailAttachment[];
  record_link?: EmailRecordLink | null;
};

export type EmailParserInbox = {
  id: number;
  parser_email_address: string;
  is_active: boolean;
  parser_name: string;
  mapping_config: Record<string, unknown>;
  create_record_type: CreateRecordType;
  created_at: string;
  updated_at: string;
};

export type ParserGeneratePayload = {
  parser_name: string;
  mapping_config?: Record<string, unknown>;
  create_record_type?: CreateRecordType;
};

export type ParserIngestPayload = {
  from_email?: string;
  from_name?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  email?: string;
  name?: string;
  company?: string;
  create_record_type?: CreateRecordType;
};

export type BCCDropboxVerifiedAddress = {
  id: number;
  bcc_setting: number;
  email_address: string;
  verification_status: "pending" | "verified";
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BCCDropboxSetting = {
  id: number;
  dropbox_email_address: string;
  exclude_domains: string[];
  search_pattern_order: string[];
  is_active: boolean;
  verified_addresses: BCCDropboxVerifiedAddress[];
  created_at: string;
  updated_at: string;
};

export type EmailAuthenticationDomain = {
  id: number;
  domain_name: string;
  email_status: string | null;
  authentication_status: Exclude<AuthenticationStatus, "not_applicable">;
  spf_status: string | null;
  dkim_status: string | null;
  dmarc_status: string | null;
  is_verified: boolean;
  last_checked_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailRelayServer = {
  id: number;
  server_name: string;
  port: number;
  secure_connection: SecureConnection;
  daily_mail_limit: number;
  domain_name: string;
  email_type: string | null;
  dkim_authentication_enabled: boolean;
  bounce_management_enabled: boolean;
  authentication_required: boolean;
  username: string | null;
  has_password?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailRelayFormValues = {
  server_name: string;
  port: number;
  secure_connection: SecureConnection;
  daily_mail_limit: number;
  domain_name: string;
  email_type: string;
  dkim_authentication_enabled: boolean;
  bounce_management_enabled: boolean;
  authentication_required: boolean;
  username: string;
  password: string;
  is_active: boolean;
};

export type EmailCredibilityMetric = {
  id: number;
  score: number;
  spam_complaints: number;
  bounce_volume: number;
  total_sent: number;
  delivered_count: number;
  bounced_count: number;
  report_period_start: string;
  report_period_end: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EmailCredibilityReport = {
  total_sent: number;
  delivered_count: number;
  bounced_count: number;
  spam_complaints: number;
  average_score: number;
  active_relays: Array<{ domain_name: string; active_relays: number }>;
};

export type EmailInsightSetting = {
  id: number;
  is_enabled: boolean;
  is_active: boolean;
  enabled_by: number | null;
  enabled_by_email?: string | null;
  enabled_at: string | null;
  tracking_open: boolean;
  tracking_click: boolean;
  tracking_bounce: boolean;
  workflow_trigger_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type UnsubscribeLink = {
  id: number;
  name: string;
  location_type: UnsubscribeLocationType;
  custom_url: string | null;
  action_type: UnsubscribeActionType;
  redirect_url: string | null;
  display_message: string | null;
  is_default: boolean;
  created_by: number | null;
  created_by_email?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UnsubscribeLinkFormValues = {
  name: string;
  location_type: UnsubscribeLocationType;
  custom_url: string;
  action_type: UnsubscribeActionType;
  redirect_url: string;
  display_message: string;
  is_default: boolean;
  is_active: boolean;
};

export type SocialAccount = {
  id: number;
  brand: number;
  platform: SocialPlatform;
  account_name: string | null;
  handle: string | null;
  page_id: string | null;
  is_connected: boolean;
  connected_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SocialBrand = {
  id: number;
  brand_name: string;
  brand_description: string | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  accounts?: SocialAccount[];
};

export type SocialPermissionSetting = {
  id: number;
  social_admin_role_name: string;
  social_tab_profiles: string[];
  social_profiles: string[];
  private_handles_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SocialLeadAutomationRule = {
  id: number;
  platform: SocialPlatform;
  trigger_type: SocialTriggerType;
  action_type: "create_lead" | "create_case";
  is_active: boolean;
  qualification_logic: Record<string, unknown>;
  assign_to_user: number | null;
  assign_to_user_email?: string | null;
  assign_to_team: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialMessage = {
  id: number;
  platform: SocialPlatform;
  brand: number | null;
  brand_name?: string | null;
  social_account: number | null;
  social_account_name?: string | null;
  external_message_id: string | null;
  profile_handle: string | null;
  sender_name: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  message: string;
  created_at_source: string | null;
  payload: Record<string, unknown>;
  lead: number | null;
  lead_name?: string | null;
  contact: number | null;
  contact_name?: string | null;
  account: number | null;
  account_name?: string | null;
  deal: number | null;
  deal_name?: string | null;
  support_case: number | null;
  support_case_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SocialConnectPayload = {
  account_name?: string;
  handle?: string;
  page_id?: string;
  access_token?: string;
  refresh_token?: string;
};

export type VisitorTrackingPortal = {
  id: number;
  portal_name: string;
  portal_url: string;
  is_active: boolean;
  is_available: boolean;
  created_by: number | null;
  created_by_email?: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitorTrackingSetting = {
  id: number;
  portal: number;
  portal_name?: string | null;
  push_new_visitors_as: PushVisitorsAs;
  assign_lead_to_user: number | null;
  assign_lead_to_user_email?: string | null;
  notify_when_visitor_online: boolean;
  status_enabled: boolean;
  department_name: string | null;
  app_name: string;
  tracking_code: string;
  chat_widget_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VisitorLeadEvent = {
  id: number;
  portal: number;
  portal_name?: string | null;
  session_id?: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  identified_email?: string | null;
  page_url?: string | null;
  source_url: string | null;
  referrer?: string | null;
  page_history: string[];
  time_spent_seconds: number | null;
  event_type: string;
  converted_to_lead: boolean;
  linked_lead: number | null;
  linked_lead_name?: string | null;
  linked_contact?: number | null;
  linked_contact_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type IntegrationLeadSourceEvent = {
  id: number;
  source_type: SourceType;
  source_label?: string | null;
  source_reference: string;
  payload: Record<string, unknown>;
  lead: number | null;
  lead_name?: string | null;
  contact: number | null;
  contact_name?: string | null;
  account: number | null;
  account_name?: string | null;
  deal: number | null;
  deal_name?: string | null;
  support_case: number | null;
  support_case_name?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EmailSyncLog = {
  id: number;
  provider_integration: number;
  provider_email?: string;
  sync_type: SyncType;
  status: SyncStatus;
  last_synced_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EmailProviderSyncResult = {
  message: string;
  emails_synced: number;
  lead_matches: number;
  log: EmailSyncLog;
};

export type IntegrationFilters = {
  search?: string;
  page?: number;
  page_size?: number;
  only_related?: boolean;
  provider_type?: IntegrationProviderType;
  is_active?: boolean;
  confirmation_status?: ConfirmationStatus;
  authentication_status?: AuthenticationStatus;
  platform?: SocialPlatform;
  source_type?: SourceType;
  lead?: string | number;
  contact?: string | number;
  account?: string | number;
  deal?: string | number;
  support_case?: string | number;
  participant_email?: string;
  status?: string;
  direction?: MessageDirection;
};
