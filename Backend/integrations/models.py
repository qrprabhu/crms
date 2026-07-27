from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db import transaction

from core.base_models import BaseModel


class EmailProviderIntegration(BaseModel):
    class ProviderType(models.TextChoices):
        ZOHO_MAIL = "zoho_mail", "Zoho Mail"
        GMAIL = "gmail", "Gmail"
        YAHOO = "yahoo", "Yahoo Mail"
        OFFICE365 = "office365", "Office 365"
        OUTLOOK = "outlook", "Outlook"
        OTHER = "other", "Other Mail"

    class ProtocolType(models.TextChoices):
        IMAP_OAUTH = "imap_oauth", "IMAP OAuth"
        IMAP = "imap", "IMAP"
        SMTP = "smtp", "SMTP"
        RELAY = "relay", "Relay"

    provider_type = models.CharField(max_length=30, choices=ProviderType.choices, db_index=True)
    protocol_type = models.CharField(max_length=20, choices=ProtocolType.choices)
    email_address = models.EmailField(db_index=True)
    display_name = models.CharField(max_length=255, blank=True, null=True)
    reply_to_address = models.EmailField(blank=True, null=True)
    is_default_from = models.BooleanField(default=False, db_index=True)
    access_token = models.TextField(blank=True, null=True)
    refresh_token = models.TextField(blank=True, null=True)
    token_expiry = models.DateTimeField(blank=True, null=True)
    imap_host = models.CharField(max_length=255, blank=True, null=True)
    imap_port = models.PositiveIntegerField(default=993)
    smtp_host = models.CharField(max_length=255, blank=True, null=True)
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)
    sync_enabled = models.BooleanField(default=True)
    sales_inbox_enabled = models.BooleanField(default=False)
    instant_notification_enabled = models.BooleanField(default=False)
    crm_sync_enabled = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="email_provider_integrations",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["provider_type", "is_active"]),
            models.Index(fields=["created_by", "created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["email_address"],
                condition=models.Q(is_active=True),
                name="integrations_active_provider_email_unique",
            ),
        ]

    def __str__(self) -> str:
        return self.email_address

    @property
    def email(self) -> str:
        return self.email_address

    @email.setter
    def email(self, value: str) -> None:
        self.email_address = value

    @property
    def reply_to(self) -> str | None:
        return self.reply_to_address

    @reply_to.setter
    def reply_to(self, value: str | None) -> None:
        self.reply_to_address = value

    @property
    def is_default(self) -> bool:
        return self.is_default_from

    @is_default.setter
    def is_default(self, value: bool) -> None:
        self.is_default_from = value

    @property
    def enable_sync(self) -> bool:
        return self.sync_enabled

    @enable_sync.setter
    def enable_sync(self, value: bool) -> None:
        self.sync_enabled = value

    @property
    def enable_crm_sync(self) -> bool:
        return self.crm_sync_enabled

    @enable_crm_sync.setter
    def enable_crm_sync(self, value: bool) -> None:
        self.crm_sync_enabled = value

    @property
    def enable_sales_inbox(self) -> bool:
        return self.sales_inbox_enabled

    @enable_sales_inbox.setter
    def enable_sales_inbox(self, value: bool) -> None:
        self.sales_inbox_enabled = value

    @property
    def enable_notifications(self) -> bool:
        return self.instant_notification_enabled

    @enable_notifications.setter
    def enable_notifications(self, value: bool) -> None:
        self.instant_notification_enabled = value

    def save(self, *args, **kwargs):
        with transaction.atomic():
            super().save(*args, **kwargs)
            if self.is_default_from:
                type(self).objects.filter(is_default_from=True).exclude(pk=self.pk).update(is_default_from=False)


class EmailComposeSetting(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_compose_settings",
        null=True,
        blank=True,
    )
    default_font_family = models.CharField(max_length=120, default="Arial")
    default_font_size = models.CharField(max_length=20, default="14px")
    default_from_integration = models.ForeignKey(
        "integrations.EmailProviderIntegration",
        on_delete=models.SET_NULL,
        related_name="default_from_compose_settings",
        null=True,
        blank=True,
    )
    default_reply_to_integration = models.ForeignKey(
        "integrations.EmailProviderIntegration",
        on_delete=models.SET_NULL,
        related_name="default_reply_to_compose_settings",
        null=True,
        blank=True,
    )
    email_signature_name = models.CharField(max_length=255, blank=True, null=True)
    email_signature_html = models.TextField(blank=True, null=True)
    is_plain_text = models.BooleanField(default=False)

    class Meta:
        ordering = ["-updated_at"]


class EmailSharingPermission(BaseModel):
    class SharingMode(models.TextChoices):
        PRIVATE = "private", "Private"
        PUBLIC = "public", "Public"
        SHARED = "shared", "Shared"
        ROLE_BASED = "role_based", "Role Based"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_sharing_permissions",
    )
    configuration_type = models.CharField(max_length=100)
    sharing_mode = models.CharField(max_length=20, choices=SharingMode.choices, default=SharingMode.PRIVATE)
    shared_with_profiles = models.JSONField(default=list, blank=True)
    excluded_domains = models.JSONField(default=list, blank=True)
    preferences = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-updated_at"]


class OrganizationEmailAddress(BaseModel):
    class UsageScope(models.TextChoices):
        STANDARD = "standard", "Standard"
        ALL_USERS = "all_users", "All Users"
        SELECTED_PROFILES = "selected_profiles", "Selected Profiles"

    class ConfirmationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"

    class AuthenticationStatus(models.TextChoices):
        NOT_APPLICABLE = "not_applicable", "Not Applicable"
        PENDING = "pending", "Pending"
        AUTHENTICATED = "authenticated", "Authenticated"
        FAILED = "failed", "Failed"

    display_name = models.CharField(max_length=255)
    email_address = models.EmailField(unique=True)
    usage_scope = models.CharField(max_length=20, choices=UsageScope.choices, default=UsageScope.STANDARD)
    confirmation_status = models.CharField(
        max_length=20,
        choices=ConfirmationStatus.choices,
        default=ConfirmationStatus.PENDING,
        db_index=True,
    )
    authentication_status = models.CharField(
        max_length=20,
        choices=AuthenticationStatus.choices,
        default=AuthenticationStatus.NOT_APPLICABLE,
        db_index=True,
    )
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="organization_email_addresses",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["display_name", "email_address"]


class CustomEmailFieldPreference(BaseModel):
    is_enabled = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-updated_at"]


class SalesInboxSetting(BaseModel):
    is_enabled = models.BooleanField(default=False)
    provider_integration = models.ForeignKey(
        "integrations.EmailProviderIntegration",
        on_delete=models.SET_NULL,
        related_name="sales_inbox_settings",
        null=True,
        blank=True,
    )
    crm_context_enabled = models.BooleanField(default=True)
    conversations_enabled = models.BooleanField(default=True)
    timeline_enabled = models.BooleanField(default=True)
    prioritized_columns_enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ["-updated_at"]


class EmailParserInbox(BaseModel):
    class RecordType(models.TextChoices):
        LEAD = "lead", "Lead"
        CONTACT = "contact", "Contact"
        CASE = "case", "Case"
        CUSTOM = "custom", "Custom"

    parser_email_address = models.EmailField(unique=True)
    parser_name = models.CharField(max_length=255)
    mapping_config = models.JSONField(default=dict, blank=True)
    create_record_type = models.CharField(max_length=20, choices=RecordType.choices, default=RecordType.LEAD)

    class Meta:
        ordering = ["parser_name"]


class BCCDropboxSetting(BaseModel):
    dropbox_email_address = models.EmailField(unique=True)
    exclude_domains = models.JSONField(default=list, blank=True)
    search_pattern_order = models.JSONField(
        default=list,
        blank=True,
    )

    class Meta:
        ordering = ["-updated_at"]


class BCCDropboxVerifiedAddress(BaseModel):
    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"

    bcc_setting = models.ForeignKey(
        "integrations.BCCDropboxSetting",
        on_delete=models.CASCADE,
        related_name="verified_addresses",
    )
    email_address = models.EmailField()
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
    verification_code = models.CharField(max_length=32, blank=True, null=True)
    verified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["email_address"]
        constraints = [
            models.UniqueConstraint(
                fields=["bcc_setting", "email_address"],
                name="integrations_bcc_verified_address_unique",
            ),
        ]


class EmailAuthenticationDomain(BaseModel):
    class AuthenticationStatus(models.TextChoices):
        AVAILABLE = "available", "Available"
        PENDING = "pending", "Pending"
        AUTHENTICATED = "authenticated", "Authenticated"
        FAILED = "failed", "Failed"

    domain_name = models.CharField(max_length=255, unique=True)
    email_status = models.CharField(max_length=100, blank=True, null=True)
    authentication_status = models.CharField(
        max_length=20,
        choices=AuthenticationStatus.choices,
        default=AuthenticationStatus.AVAILABLE,
        db_index=True,
    )
    spf_status = models.CharField(max_length=100, blank=True, null=True)
    dkim_status = models.CharField(max_length=100, blank=True, null=True)
    dmarc_status = models.CharField(max_length=100, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    last_checked_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["domain_name"]


class EmailRelayServer(BaseModel):
    class SecureConnection(models.TextChoices):
        SSL = "ssl", "SSL"
        TLS = "tls", "TLS"
        NEVER = "never", "Never"

    server_name = models.CharField(max_length=255)
    port = models.PositiveIntegerField(default=587)
    secure_connection = models.CharField(
        max_length=10,
        choices=SecureConnection.choices,
        default=SecureConnection.TLS,
    )
    daily_mail_limit = models.PositiveIntegerField(default=1000)
    domain_name = models.CharField(max_length=255)
    email_type = models.CharField(max_length=100, blank=True, null=True)
    dkim_authentication_enabled = models.BooleanField(default=False)
    bounce_management_enabled = models.BooleanField(default=False)
    authentication_required = models.BooleanField(default=True)
    username = models.CharField(max_length=255, blank=True, null=True)
    password = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["server_name"]


class EmailCredibilityMetric(BaseModel):
    score = models.PositiveSmallIntegerField(default=0)
    spam_complaints = models.PositiveIntegerField(default=0)
    bounce_volume = models.PositiveIntegerField(default=0)
    total_sent = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    bounced_count = models.PositiveIntegerField(default=0)
    report_period_start = models.DateField()
    report_period_end = models.DateField()
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-report_period_end", "-created_at"]


class EmailInsightSetting(BaseModel):
    is_enabled = models.BooleanField(default=False)
    enabled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="email_insight_settings",
        null=True,
        blank=True,
    )
    enabled_at = models.DateTimeField(blank=True, null=True)
    tracking_open = models.BooleanField(default=True)
    tracking_click = models.BooleanField(default=True)
    tracking_bounce = models.BooleanField(default=True)
    workflow_trigger_enabled = models.BooleanField(default=False)

    class Meta:
        ordering = ["-updated_at"]


class UnsubscribeLink(BaseModel):
    class LocationType(models.TextChoices):
        STANDARD_PAGE = "standard_page", "Standard Page"
        CUSTOM_PAGE = "custom_page", "Custom Page"

    class ActionType(models.TextChoices):
        DISPLAY_MESSAGE = "display_message", "Display Message"
        REDIRECT_URL = "redirect_url", "Redirect URL"

    name = models.CharField(max_length=255)
    location_type = models.CharField(max_length=20, choices=LocationType.choices, default=LocationType.STANDARD_PAGE)
    custom_url = models.URLField(blank=True, null=True)
    action_type = models.CharField(max_length=20, choices=ActionType.choices, default=ActionType.DISPLAY_MESSAGE)
    redirect_url = models.URLField(blank=True, null=True)
    display_message = models.TextField(blank=True, null=True)
    is_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="unsubscribe_links",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-is_default", "name"]


class SocialBrand(BaseModel):
    brand_name = models.CharField(max_length=255)
    brand_description = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="social_brands",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["brand_name"]


class SocialAccount(BaseModel):
    class Platform(models.TextChoices):
        FACEBOOK = "facebook", "Facebook"
        X = "x", "X"

    brand = models.ForeignKey(
        "integrations.SocialBrand",
        on_delete=models.CASCADE,
        related_name="accounts",
    )
    platform = models.CharField(max_length=20, choices=Platform.choices, db_index=True)
    account_name = models.CharField(max_length=255, blank=True, null=True)
    handle = models.CharField(max_length=255, blank=True, null=True)
    page_id = models.CharField(max_length=255, blank=True, null=True)
    access_token = models.TextField(blank=True, null=True)
    refresh_token = models.TextField(blank=True, null=True)
    is_connected = models.BooleanField(default=False)
    connected_at = models.DateTimeField(blank=True, null=True)
    last_synced_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["platform", "account_name"]


class SocialPermissionSetting(BaseModel):
    social_admin_role_name = models.CharField(max_length=255)
    social_tab_profiles = models.JSONField(default=list, blank=True)
    social_profiles = models.JSONField(default=list, blank=True)
    private_handles_enabled = models.BooleanField(default=False)

    class Meta:
        ordering = ["-updated_at"]


class SocialLeadAutomationRule(BaseModel):
    class Platform(models.TextChoices):
        FACEBOOK = "facebook", "Facebook"
        X = "x", "X"

    class TriggerType(models.TextChoices):
        MENTION = "mention", "Mention"
        COMMENT = "comment", "Comment"
        LIKE = "like", "Like"
        RETWEET = "retweet", "Retweet"
        MESSAGE = "message", "Message"

    class ActionType(models.TextChoices):
        CREATE_LEAD = "create_lead", "Create Lead"
        CREATE_CASE = "create_case", "Create Case"

    platform = models.CharField(max_length=20, choices=Platform.choices)
    trigger_type = models.CharField(max_length=20, choices=TriggerType.choices)
    action_type = models.CharField(max_length=20, choices=ActionType.choices, default=ActionType.CREATE_LEAD)
    qualification_logic = models.JSONField(default=dict, blank=True)
    assign_to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="social_lead_automation_rules",
        null=True,
        blank=True,
    )
    assign_to_team = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ["-updated_at"]


class VisitorTrackingPortal(BaseModel):
    portal_name = models.CharField(max_length=255)
    portal_url = models.URLField()
    is_available = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="visitor_tracking_portals",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["portal_name"]


class VisitorTrackingSetting(BaseModel):
    class PushAs(models.TextChoices):
        LEAD = "lead", "Lead"
        CONTACT = "contact", "Contact"

    portal = models.OneToOneField(
        "integrations.VisitorTrackingPortal",
        on_delete=models.CASCADE,
        related_name="setting",
    )
    push_new_visitors_as = models.CharField(max_length=20, choices=PushAs.choices, default=PushAs.LEAD)
    assign_lead_to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="visitor_tracking_settings",
        null=True,
        blank=True,
    )
    notify_when_visitor_online = models.BooleanField(default=False)
    status_enabled = models.BooleanField(default=True)
    department_name = models.CharField(max_length=255, blank=True, null=True)
    app_name = models.CharField(max_length=255)
    tracking_code = models.TextField()
    chat_widget_enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ["-updated_at"]


class VisitorLeadEvent(BaseModel):
    portal = models.ForeignKey(
        "integrations.VisitorTrackingPortal",
        on_delete=models.CASCADE,
        related_name="events",
    )
    session_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    visitor_name = models.CharField(max_length=255, blank=True, null=True)
    visitor_email = models.EmailField(blank=True, null=True, db_index=True)
    identified_email = models.EmailField(blank=True, null=True, db_index=True)
    page_url = models.URLField(blank=True, null=True)
    source_url = models.URLField(blank=True, null=True)
    referrer = models.URLField(blank=True, null=True)
    page_history = models.JSONField(default=list, blank=True)
    time_spent_seconds = models.PositiveIntegerField(blank=True, null=True)
    event_type = models.CharField(max_length=100, db_index=True)
    converted_to_lead = models.BooleanField(default=False)
    linked_lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        related_name="visitor_events",
        null=True,
        blank=True,
    )
    linked_contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="visitor_events",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["portal", "created_at"]),
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["session_id", "created_at"]),
        ]


class SocialMessage(BaseModel):
    class Platform(models.TextChoices):
        FACEBOOK = "facebook", "Facebook"
        X = "x", "X"

    platform = models.CharField(max_length=20, choices=Platform.choices, db_index=True)
    brand = models.ForeignKey(
        "integrations.SocialBrand",
        on_delete=models.SET_NULL,
        related_name="messages",
        null=True,
        blank=True,
    )
    social_account = models.ForeignKey(
        "integrations.SocialAccount",
        on_delete=models.SET_NULL,
        related_name="messages",
        null=True,
        blank=True,
    )
    external_message_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    profile_handle = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    sender_name = models.CharField(max_length=255, blank=True, null=True)
    sender_email = models.EmailField(blank=True, null=True, db_index=True)
    sender_phone = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    message = models.TextField()
    created_at_source = models.DateTimeField(blank=True, null=True, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        related_name="social_messages",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="social_messages",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="social_messages",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="social_messages",
        null=True,
        blank=True,
    )
    support_case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.SET_NULL,
        related_name="social_messages",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at_source", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["platform", "external_message_id"],
                condition=models.Q(external_message_id__isnull=False),
                name="integrations_social_external_unique",
            ),
        ]


class IntegrationLeadSourceEvent(BaseModel):
    class SourceType(models.TextChoices):
        EMAIL = "email", "Email"
        SOCIAL = "social", "Social"
        WEBSITE = "website", "Website"
        PARSER = "parser", "Parser"
        BCC_DROPBOX = "bcc_dropbox", "BCC Dropbox"
        SALESIQ = "salesiq", "SalesIQ"

    source_type = models.CharField(max_length=20, choices=SourceType.choices, db_index=True)
    source_reference = models.CharField(max_length=255, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        related_name="integration_source_events",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="integration_source_events",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="integration_source_events",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="integration_source_events",
        null=True,
        blank=True,
    )
    support_case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.SET_NULL,
        related_name="integration_source_events",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=100, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["source_type", "created_at"]),
            models.Index(fields=["status", "created_at"]),
        ]


class SyncedEmailMessage(BaseModel):
    class Direction(models.TextChoices):
        INCOMING = "incoming", "Incoming"
        OUTGOING = "outgoing", "Outgoing"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        RECEIVED = "received", "Received"
        FAILED = "failed", "Failed"
        SCHEDULED = "scheduled", "Scheduled"

    provider_integration = models.ForeignKey(
        "integrations.EmailProviderIntegration",
        on_delete=models.CASCADE,
        related_name="synced_messages",
    )
    external_message_id = models.CharField(max_length=255)
    thread_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    subject = models.CharField(max_length=255)
    from_email = models.EmailField()
    to_emails = models.JSONField(default=list, blank=True)
    cc_emails = models.JSONField(default=list, blank=True)
    bcc_emails = models.JSONField(default=list, blank=True)
    body_text = models.TextField(blank=True, null=True)
    body_html = models.TextField(blank=True, null=True)
    direction = models.CharField(max_length=20, choices=Direction.choices, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, db_index=True)
    received_at = models.DateTimeField(db_index=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    is_read = models.BooleanField(default=False, db_index=True)
    is_starred = models.BooleanField(default=False)
    has_attachments = models.BooleanField(default=False)
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        related_name="synced_email_messages",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="synced_email_messages",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="synced_email_messages",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="synced_email_messages",
        null=True,
        blank=True,
    )
    support_case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.SET_NULL,
        related_name="synced_email_messages",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-received_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["provider_integration", "external_message_id"],
                name="integrations_synced_email_external_unique",
            ),
        ]


class EmailAttachment(BaseModel):
    email_message = models.ForeignKey(
        "integrations.SyncedEmailMessage",
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=120, blank=True, null=True)
    file_size = models.PositiveBigIntegerField(default=0)
    file_url = models.URLField(blank=True, null=True)

    class Meta:
        ordering = ["file_name", "created_at"]


class EmailRecordLink(BaseModel):
    email_message = models.OneToOneField(
        "integrations.SyncedEmailMessage",
        on_delete=models.CASCADE,
        related_name="record_link",
    )
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        related_name="email_record_links",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="email_record_links",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="email_record_links",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="email_record_links",
        null=True,
        blank=True,
    )
    support_case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.SET_NULL,
        related_name="email_record_links",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]


class EmailSyncLog(BaseModel):
    class SyncType(models.TextChoices):
        FULL_SYNC = "full_sync", "Full Sync"
        INCREMENTAL_SYNC = "incremental_sync", "Incremental Sync"
        WEBHOOK_SYNC = "webhook_sync", "Webhook Sync"
        PARSER_INGEST = "parser_ingest", "Parser Ingest"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    provider_integration = models.ForeignKey(
        "integrations.EmailProviderIntegration",
        on_delete=models.CASCADE,
        related_name="sync_logs",
    )
    sync_type = models.CharField(max_length=30, choices=SyncType.choices, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    last_synced_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
