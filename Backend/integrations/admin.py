from django.contrib import admin

from .models import (
    BCCDropboxSetting,
    BCCDropboxVerifiedAddress,
    CustomEmailFieldPreference,
    EmailAuthenticationDomain,
    EmailComposeSetting,
    EmailCredibilityMetric,
    EmailInsightSetting,
    EmailParserInbox,
    EmailProviderIntegration,
    EmailRelayServer,
    EmailSharingPermission,
    EmailSyncLog,
    IntegrationLeadSourceEvent,
    OrganizationEmailAddress,
    SalesInboxSetting,
    SocialAccount,
    SocialBrand,
    SocialLeadAutomationRule,
    SocialPermissionSetting,
    SyncedEmailMessage,
    UnsubscribeLink,
    VisitorLeadEvent,
    VisitorTrackingPortal,
    VisitorTrackingSetting,
)


class ReadonlyTimeAdmin(admin.ModelAdmin):
    readonly_fields = ("created_at", "updated_at")


@admin.register(EmailProviderIntegration)
class EmailProviderIntegrationAdmin(ReadonlyTimeAdmin):
    list_display = ("email_address", "provider_type", "protocol_type", "is_active", "sync_enabled", "created_by", "created_at")
    search_fields = ("email_address", "display_name")
    list_filter = ("provider_type", "protocol_type", "is_active", "sync_enabled", "sales_inbox_enabled")


@admin.register(EmailComposeSetting)
class EmailComposeSettingAdmin(ReadonlyTimeAdmin):
    list_display = ("id", "user", "default_font_family", "default_font_size", "is_plain_text", "updated_at")
    search_fields = ("user__email", "email_signature_name")
    list_filter = ("is_plain_text", "is_active")


@admin.register(EmailSharingPermission)
class EmailSharingPermissionAdmin(ReadonlyTimeAdmin):
    list_display = ("id", "user", "configuration_type", "sharing_mode", "is_active", "updated_at")
    search_fields = ("user__email", "configuration_type")
    list_filter = ("sharing_mode", "is_active")


@admin.register(OrganizationEmailAddress)
class OrganizationEmailAddressAdmin(ReadonlyTimeAdmin):
    list_display = ("display_name", "email_address", "usage_scope", "confirmation_status", "authentication_status", "is_verified")
    search_fields = ("display_name", "email_address")
    list_filter = ("usage_scope", "confirmation_status", "authentication_status", "is_verified")


@admin.register(CustomEmailFieldPreference)
class CustomEmailFieldPreferenceAdmin(ReadonlyTimeAdmin):
    list_display = ("id", "is_enabled", "is_active", "updated_at")
    search_fields = ("notes",)
    list_filter = ("is_enabled", "is_active")


@admin.register(SalesInboxSetting)
class SalesInboxSettingAdmin(ReadonlyTimeAdmin):
    list_display = ("id", "is_enabled", "provider_integration", "crm_context_enabled", "conversations_enabled", "timeline_enabled")
    search_fields = ("provider_integration__email_address",)
    list_filter = ("is_enabled", "crm_context_enabled", "conversations_enabled", "timeline_enabled", "prioritized_columns_enabled")


@admin.register(EmailParserInbox)
class EmailParserInboxAdmin(ReadonlyTimeAdmin):
    list_display = ("parser_name", "parser_email_address", "create_record_type", "is_active", "created_at")
    search_fields = ("parser_name", "parser_email_address")
    list_filter = ("create_record_type", "is_active")


@admin.register(BCCDropboxSetting)
class BCCDropboxSettingAdmin(ReadonlyTimeAdmin):
    list_display = ("dropbox_email_address", "is_active", "updated_at")
    search_fields = ("dropbox_email_address",)
    list_filter = ("is_active",)


@admin.register(BCCDropboxVerifiedAddress)
class BCCDropboxVerifiedAddressAdmin(ReadonlyTimeAdmin):
    list_display = ("bcc_setting", "email_address", "verification_status", "verified_at")
    search_fields = ("email_address",)
    list_filter = ("verification_status",)


@admin.register(EmailAuthenticationDomain)
class EmailAuthenticationDomainAdmin(ReadonlyTimeAdmin):
    list_display = ("domain_name", "authentication_status", "spf_status", "dkim_status", "dmarc_status", "is_verified")
    search_fields = ("domain_name",)
    list_filter = ("authentication_status", "is_verified")


@admin.register(EmailRelayServer)
class EmailRelayServerAdmin(ReadonlyTimeAdmin):
    list_display = ("server_name", "domain_name", "port", "secure_connection", "authentication_required", "is_active")
    search_fields = ("server_name", "domain_name", "username")
    list_filter = ("secure_connection", "authentication_required", "is_active")


@admin.register(EmailCredibilityMetric)
class EmailCredibilityMetricAdmin(ReadonlyTimeAdmin):
    list_display = ("score", "total_sent", "delivered_count", "bounced_count", "report_period_start", "report_period_end")
    search_fields = ("report_period_start", "report_period_end")
    list_filter = ("report_period_start", "report_period_end")


@admin.register(EmailInsightSetting)
class EmailInsightSettingAdmin(ReadonlyTimeAdmin):
    list_display = ("id", "is_enabled", "enabled_by", "enabled_at", "tracking_open", "tracking_click", "tracking_bounce")
    search_fields = ("enabled_by__email",)
    list_filter = ("is_enabled", "tracking_open", "tracking_click", "tracking_bounce", "workflow_trigger_enabled")


@admin.register(UnsubscribeLink)
class UnsubscribeLinkAdmin(ReadonlyTimeAdmin):
    list_display = ("name", "location_type", "action_type", "is_default", "is_active", "created_by")
    search_fields = ("name", "custom_url", "redirect_url")
    list_filter = ("location_type", "action_type", "is_default", "is_active")


@admin.register(SocialBrand)
class SocialBrandAdmin(ReadonlyTimeAdmin):
    list_display = ("brand_name", "is_active", "created_by", "created_at")
    search_fields = ("brand_name", "brand_description")
    list_filter = ("is_active",)


@admin.register(SocialAccount)
class SocialAccountAdmin(ReadonlyTimeAdmin):
    list_display = ("brand", "platform", "account_name", "handle", "is_connected", "connected_at", "is_active")
    search_fields = ("account_name", "handle", "page_id")
    list_filter = ("platform", "is_connected", "is_active")


@admin.register(SocialPermissionSetting)
class SocialPermissionSettingAdmin(ReadonlyTimeAdmin):
    list_display = ("social_admin_role_name", "private_handles_enabled", "updated_at")
    search_fields = ("social_admin_role_name",)
    list_filter = ("private_handles_enabled", "is_active")


@admin.register(SocialLeadAutomationRule)
class SocialLeadAutomationRuleAdmin(ReadonlyTimeAdmin):
    list_display = ("platform", "trigger_type", "action_type", "assign_to_user", "assign_to_team", "is_active")
    search_fields = ("assign_to_user__email", "assign_to_team")
    list_filter = ("platform", "trigger_type", "action_type", "is_active")


@admin.register(VisitorTrackingPortal)
class VisitorTrackingPortalAdmin(ReadonlyTimeAdmin):
    list_display = ("portal_name", "portal_url", "is_active", "is_available", "created_by")
    search_fields = ("portal_name", "portal_url")
    list_filter = ("is_active", "is_available")


@admin.register(VisitorTrackingSetting)
class VisitorTrackingSettingAdmin(ReadonlyTimeAdmin):
    list_display = ("portal", "push_new_visitors_as", "assign_lead_to_user", "app_name", "chat_widget_enabled")
    search_fields = ("portal__portal_name", "app_name", "department_name")
    list_filter = ("push_new_visitors_as", "notify_when_visitor_online", "status_enabled", "chat_widget_enabled")


@admin.register(VisitorLeadEvent)
class VisitorLeadEventAdmin(ReadonlyTimeAdmin):
    list_display = ("portal", "visitor_name", "visitor_email", "event_type", "converted_to_lead", "linked_lead", "created_at")
    search_fields = ("visitor_name", "visitor_email", "source_url")
    list_filter = ("event_type", "converted_to_lead", "is_active")


@admin.register(IntegrationLeadSourceEvent)
class IntegrationLeadSourceEventAdmin(ReadonlyTimeAdmin):
    list_display = ("source_type", "source_reference", "status", "lead", "contact", "deal", "created_at")
    search_fields = ("source_reference", "status")
    list_filter = ("source_type", "status")


@admin.register(SyncedEmailMessage)
class SyncedEmailMessageAdmin(ReadonlyTimeAdmin):
    list_display = ("subject", "provider_integration", "from_email", "direction", "status", "received_at", "is_read")
    search_fields = ("subject", "from_email", "external_message_id", "thread_id")
    list_filter = ("direction", "status", "is_read", "is_starred", "has_attachments")


@admin.register(EmailSyncLog)
class EmailSyncLogAdmin(ReadonlyTimeAdmin):
    list_display = ("provider_integration", "sync_type", "status", "last_synced_at", "created_at")
    search_fields = ("provider_integration__email_address", "error_message")
    list_filter = ("sync_type", "status")
