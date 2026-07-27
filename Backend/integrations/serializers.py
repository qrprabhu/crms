from __future__ import annotations
import html

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils.html import strip_tags
from django.utils import timezone
from rest_framework import serializers

from .models import (
    BCCDropboxSetting,
    BCCDropboxVerifiedAddress,
    CustomEmailFieldPreference,
    EmailAttachment,
    EmailAuthenticationDomain,
    EmailComposeSetting,
    EmailCredibilityMetric,
    EmailInsightSetting,
    EmailParserInbox,
    EmailProviderIntegration,
    EmailRecordLink,
    EmailRelayServer,
    EmailSharingPermission,
    EmailSyncLog,
    IntegrationLeadSourceEvent,
    OrganizationEmailAddress,
    SalesInboxSetting,
    SocialAccount,
    SocialBrand,
    SocialLeadAutomationRule,
    SocialMessage,
    SocialPermissionSetting,
    SyncedEmailMessage,
    UnsubscribeLink,
    VisitorLeadEvent,
    VisitorTrackingPortal,
    VisitorTrackingSetting,
)
from .services import validate_relay_configuration
from .utils import normalize_email, record_display_name

User = get_user_model()


class EmailProviderIntegrationListSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()
    email = serializers.EmailField(source="email_address", read_only=True)
    reply_to = serializers.EmailField(source="reply_to_address", read_only=True, allow_null=True)
    is_default = serializers.BooleanField(source="is_default_from", read_only=True)
    enable_sync = serializers.BooleanField(source="sync_enabled", read_only=True)
    enable_crm_sync = serializers.BooleanField(source="crm_sync_enabled", read_only=True)
    enable_sales_inbox = serializers.BooleanField(source="sales_inbox_enabled", read_only=True)
    enable_notifications = serializers.BooleanField(source="instant_notification_enabled", read_only=True)

    class Meta:
        model = EmailProviderIntegration
        fields = [
            "id",
            "provider_type",
            "protocol_type",
            "email",
            "email_address",
            "display_name",
            "reply_to",
            "reply_to_address",
            "is_active",
            "is_default",
            "is_default_from",
            "enable_sync",
            "sync_enabled",
            "enable_sales_inbox",
            "sales_inbox_enabled",
            "enable_notifications",
            "instant_notification_enabled",
            "enable_crm_sync",
            "crm_sync_enabled",
            "last_synced_at",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", None) if obj.created_by else None


class EmailProviderIntegrationDetailSerializer(EmailProviderIntegrationListSerializer):
    has_access_token = serializers.SerializerMethodField()
    has_refresh_token = serializers.SerializerMethodField()

    class Meta(EmailProviderIntegrationListSerializer.Meta):
        fields = EmailProviderIntegrationListSerializer.Meta.fields + [
            "has_access_token",
            "has_refresh_token",
            "token_expiry",
            "imap_host",
            "imap_port",
            "smtp_host",
            "smtp_port",
            "smtp_use_tls",
            "smtp_use_ssl",
        ]

    def get_has_access_token(self, obj):
        return bool(obj.access_token)

    def get_has_refresh_token(self, obj):
        return bool(obj.refresh_token)


class EmailProviderIntegrationWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailProviderIntegration
        fields = [
            "provider_type",
            "protocol_type",
            "email_address",
            "display_name",
            "reply_to_address",
            "is_active",
            "is_default_from",
            "access_token",
            "refresh_token",
            "token_expiry",
            "imap_host",
            "imap_port",
            "smtp_host",
            "smtp_port",
            "smtp_use_tls",
            "smtp_use_ssl",
            "sync_enabled",
            "sales_inbox_enabled",
            "instant_notification_enabled",
            "crm_sync_enabled",
        ]
        extra_kwargs = {
            "email_address": {"required": False},
            "reply_to_address": {"required": False, "allow_blank": True, "allow_null": True},
            "access_token": {"write_only": True, "required": False, "allow_blank": True, "allow_null": True},
            "refresh_token": {"write_only": True, "required": False, "allow_blank": True, "allow_null": True},
        }

    def to_internal_value(self, data):
        payload = data.copy()
        field_aliases = {
            "email": "email_address",
            "reply_to": "reply_to_address",
            "is_default": "is_default_from",
            "enable_sync": "sync_enabled",
            "enable_crm_sync": "crm_sync_enabled",
            "enable_sales_inbox": "sales_inbox_enabled",
            "enable_notifications": "instant_notification_enabled",
        }

        for alias, field_name in field_aliases.items():
            if alias in payload and field_name not in payload:
                payload[field_name] = payload.get(alias)

        return super().to_internal_value(payload)

    def validate_email_address(self, value):
        return normalize_email(value)

    def validate_reply_to_address(self, value):
        if value in ("", None):
            return None
        value = normalize_email(value)
        try:
            validate_email(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError("Enter a valid email address") from exc
        return value

    def validate(self, data):
        reply_to = data.get("reply_to_address")

        if reply_to:
            try:
                validate_email(reply_to)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"reply_to_address": "Enter a valid email address"}) from exc

        email = data.get("email_address")
        if not email and self.instance:
            email = self.instance.email_address

        if not email:
            raise serializers.ValidationError({"email": "This field is required."})

        queryset = EmailProviderIntegration.objects.all()
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.filter(email_address=email).exists():
            raise serializers.ValidationError({"email": "Email provider with this email already exists."})

        return data

    def _unset_other_defaults(self, instance_id: int | None = None):
        queryset = EmailProviderIntegration.objects.filter(is_default_from=True)
        if instance_id:
            queryset = queryset.exclude(pk=instance_id)
        queryset.update(is_default_from=False)

    def create(self, validated_data):
        with transaction.atomic():
            if validated_data.get("is_default_from"):
                self._unset_other_defaults()
            return super().create(validated_data)

    def update(self, instance, validated_data):
        with transaction.atomic():
            if validated_data.get("is_default_from"):
                self._unset_other_defaults(instance.pk)
            return super().update(instance, validated_data)


class EmailComposeSettingSerializer(serializers.ModelSerializer):
    default_from_integration_label = serializers.SerializerMethodField()
    default_reply_to_integration_label = serializers.SerializerMethodField()

    class Meta:
        model = EmailComposeSetting
        fields = [
            "id",
            "user",
            "default_font_family",
            "default_font_size",
            "default_from_integration",
            "default_from_integration_label",
            "default_reply_to_integration",
            "default_reply_to_integration_label",
            "email_signature_name",
            "email_signature_html",
            "is_plain_text",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_default_from_integration_label(self, obj):
        return obj.default_from_integration.email_address if obj.default_from_integration else None

    def get_default_reply_to_integration_label(self, obj):
        return obj.default_reply_to_integration.email_address if obj.default_reply_to_integration else None


class EmailSharingPermissionSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = EmailSharingPermission
        fields = [
            "id",
            "user",
            "user_email",
            "configuration_type",
            "sharing_mode",
            "shared_with_profiles",
            "excluded_domains",
            "preferences",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_user_email(self, obj):
        return getattr(obj.user, "email", None)


class OrganizationEmailAddressSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationEmailAddress
        fields = [
            "id",
            "display_name",
            "email_address",
            "usage_scope",
            "confirmation_status",
            "authentication_status",
            "is_verified",
            "verified_at",
            "created_by",
            "created_by_email",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", None) if obj.created_by else None


class CustomEmailFieldPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomEmailFieldPreference
        fields = ["id", "is_enabled", "notes", "is_active", "created_at", "updated_at"]


class SalesInboxSettingSerializer(serializers.ModelSerializer):
    provider_integration_label = serializers.SerializerMethodField()

    class Meta:
        model = SalesInboxSetting
        fields = [
            "id",
            "is_enabled",
            "provider_integration",
            "provider_integration_label",
            "is_active",
            "crm_context_enabled",
            "conversations_enabled",
            "timeline_enabled",
            "prioritized_columns_enabled",
            "created_at",
            "updated_at",
        ]

    def get_provider_integration_label(self, obj):
        return obj.provider_integration.email_address if obj.provider_integration else None


class SalesInboxFeedSerializer(serializers.ModelSerializer):
    sent_by_email = serializers.EmailField(source="from_email", read_only=True)
    counterparty_email = serializers.SerializerMethodField()
    preview_text = serializers.SerializerMethodField()
    lead_id = serializers.IntegerField(source="lead.id", read_only=True, allow_null=True)
    lead_name = serializers.SerializerMethodField()
    contact_id = serializers.IntegerField(source="contact.id", read_only=True, allow_null=True)
    contact_name = serializers.SerializerMethodField()
    deal_id = serializers.IntegerField(source="deal.id", read_only=True, allow_null=True)
    deal_name = serializers.SerializerMethodField()
    account_id = serializers.IntegerField(source="account.id", read_only=True, allow_null=True)
    account_name = serializers.SerializerMethodField()
    support_case_id = serializers.IntegerField(source="support_case.id", read_only=True, allow_null=True)
    support_case_name = serializers.SerializerMethodField()

    class Meta:
        model = SyncedEmailMessage
        fields = [
            "id",
            "subject",
            "sent_by_email",
            "counterparty_email",
            "from_email",
            "preview_text",
            "direction",
            "status",
            "received_at",
            "sent_at",
            "is_read",
            "is_starred",
            "has_attachments",
            "thread_id",
            "lead_id",
            "lead_name",
            "contact_id",
            "contact_name",
            "deal_id",
            "deal_name",
            "account_id",
            "account_name",
            "support_case_id",
            "support_case_name",
        ]

    def get_lead_name(self, obj):
        return record_display_name(obj.lead)

    def get_contact_name(self, obj):
        return record_display_name(obj.contact)

    def get_deal_name(self, obj):
        return record_display_name(obj.deal)

    def get_account_name(self, obj):
        return record_display_name(obj.account)

    def get_support_case_name(self, obj):
        return record_display_name(obj.support_case)

    def get_counterparty_email(self, obj):
        if obj.direction == SyncedEmailMessage.Direction.OUTGOING:
            for email in [*(obj.to_emails or []), *(obj.cc_emails or []), *(obj.bcc_emails or [])]:
                if email:
                    return email
            if getattr(obj.lead, "email", None):
                return obj.lead.email
            if getattr(obj.contact, "email", None):
                return obj.contact.email
        return obj.from_email

    def get_preview_text(self, obj):
        preview_source = obj.body_text or strip_tags(obj.body_html or "")
        preview = html.unescape((preview_source or "").strip())
        preview = " ".join(preview.split())
        return preview[:160]


class EmailAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAttachment
        fields = [
            "id",
            "file_name",
            "file_type",
            "file_size",
            "file_url",
            "created_at",
        ]


class EmailRecordLinkSerializer(serializers.ModelSerializer):
    lead_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()
    support_case_name = serializers.SerializerMethodField()

    class Meta:
        model = EmailRecordLink
        fields = [
            "id",
            "lead",
            "lead_name",
            "contact",
            "contact_name",
            "account",
            "account_name",
            "deal",
            "deal_name",
            "support_case",
            "support_case_name",
            "created_at",
        ]

    def get_lead_name(self, obj):
        return record_display_name(obj.lead)

    def get_contact_name(self, obj):
        return record_display_name(obj.contact)

    def get_account_name(self, obj):
        return record_display_name(obj.account)

    def get_deal_name(self, obj):
        return record_display_name(obj.deal)

    def get_support_case_name(self, obj):
        return record_display_name(obj.support_case)


class CRMEmailDetailSerializer(SalesInboxFeedSerializer):
    provider_account_id = serializers.IntegerField(source="provider_integration_id", read_only=True)
    provider_email = serializers.EmailField(source="provider_integration.email_address", read_only=True)
    body_text = serializers.CharField(read_only=True, allow_null=True)
    body_html = serializers.CharField(read_only=True, allow_null=True)
    to_emails = serializers.ListField(child=serializers.EmailField(), read_only=True)
    cc_emails = serializers.ListField(child=serializers.EmailField(), read_only=True)
    bcc_emails = serializers.ListField(child=serializers.EmailField(), read_only=True)
    attachments = EmailAttachmentSerializer(many=True, read_only=True)
    record_link = EmailRecordLinkSerializer(read_only=True)

    class Meta(SalesInboxFeedSerializer.Meta):
        fields = SalesInboxFeedSerializer.Meta.fields + [
            "provider_account_id",
            "provider_email",
            "body_text",
            "body_html",
            "to_emails",
            "cc_emails",
            "bcc_emails",
            "attachments",
            "record_link",
        ]


class CRMEmailSendSerializer(serializers.Serializer):
    provider_account_id = serializers.IntegerField()
    to = serializers.ListField(child=serializers.EmailField(), allow_empty=False)
    cc = serializers.ListField(child=serializers.EmailField(), required=False, allow_empty=True)
    bcc = serializers.ListField(child=serializers.EmailField(), required=False, allow_empty=True)
    subject = serializers.CharField(max_length=255)
    body = serializers.CharField()
    reply_to = serializers.EmailField(required=False, allow_null=True)
    lead_id = serializers.IntegerField(required=False)
    contact_id = serializers.IntegerField(required=False)
    account_id = serializers.IntegerField(required=False)
    deal_id = serializers.IntegerField(required=False)
    support_case_id = serializers.IntegerField(required=False)


class CRMEmailSyncSerializer(serializers.Serializer):
    provider_account_id = serializers.IntegerField(required=False)
    sync_type = serializers.ChoiceField(choices=EmailSyncLog.SyncType.choices, required=False)


class EmailParserInboxSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailParserInbox
        fields = [
            "id",
            "parser_email_address",
            "is_active",
            "parser_name",
            "mapping_config",
            "create_record_type",
            "created_at",
            "updated_at",
        ]


class ParserGenerateSerializer(serializers.Serializer):
    parser_name = serializers.CharField(max_length=255)
    mapping_config = serializers.JSONField(required=False)
    create_record_type = serializers.ChoiceField(choices=EmailParserInbox.RecordType.choices, required=False)


class ParserIngestSerializer(serializers.Serializer):
    from_email = serializers.EmailField(required=False)
    from_name = serializers.CharField(required=False, allow_blank=True)
    subject = serializers.CharField(required=False, allow_blank=True)
    body_text = serializers.CharField(required=False, allow_blank=True)
    body_html = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    name = serializers.CharField(required=False, allow_blank=True)
    company = serializers.CharField(required=False, allow_blank=True)
    create_record_type = serializers.ChoiceField(choices=EmailParserInbox.RecordType.choices, required=False)


class BCCDropboxVerifiedAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = BCCDropboxVerifiedAddress
        fields = [
            "id",
            "bcc_setting",
            "email_address",
            "verification_status",
            "verified_at",
            "created_at",
            "updated_at",
        ]


class BCCDropboxSettingSerializer(serializers.ModelSerializer):
    verified_addresses = BCCDropboxVerifiedAddressSerializer(many=True, read_only=True)

    class Meta:
        model = BCCDropboxSetting
        fields = [
            "id",
            "dropbox_email_address",
            "exclude_domains",
            "search_pattern_order",
            "is_active",
            "verified_addresses",
            "created_at",
            "updated_at",
        ]

    def validate_search_pattern_order(self, value):
        return value or ["contacts", "leads", "create_new_lead_if_not_found"]


class BCCAddressAddSerializer(serializers.Serializer):
    email_address = serializers.EmailField()


class BCCAddressVerifySerializer(serializers.Serializer):
    email_address = serializers.EmailField()
    verification_code = serializers.CharField(max_length=32)


class EmailAuthenticationDomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAuthenticationDomain
        fields = [
            "id",
            "domain_name",
            "email_status",
            "authentication_status",
            "spf_status",
            "dkim_status",
            "dmarc_status",
            "is_verified",
            "last_checked_at",
            "is_active",
            "created_at",
            "updated_at",
        ]


class EmailRelayServerSerializer(serializers.ModelSerializer):
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = EmailRelayServer
        fields = [
            "id",
            "server_name",
            "port",
            "secure_connection",
            "daily_mail_limit",
            "domain_name",
            "email_type",
            "dkim_authentication_enabled",
            "bounce_management_enabled",
            "authentication_required",
            "username",
            "password",
            "has_password",
            "is_active",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "password": {"write_only": True, "required": False, "allow_blank": True, "allow_null": True},
        }

    def get_has_password(self, obj):
        return bool(obj.password)

    def validate(self, attrs):
        payload = attrs.copy()
        if self.instance:
            for field in self.Meta.fields:
                if field not in payload and hasattr(self.instance, field):
                    payload[field] = getattr(self.instance, field)
        try:
            validate_relay_configuration(payload)
        except ValueError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from exc
        return attrs


class EmailCredibilityMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailCredibilityMetric
        fields = [
            "id",
            "score",
            "spam_complaints",
            "bounce_volume",
            "total_sent",
            "delivered_count",
            "bounced_count",
            "report_period_start",
            "report_period_end",
            "metadata",
            "created_at",
            "updated_at",
        ]


class EmailInsightSettingSerializer(serializers.ModelSerializer):
    enabled_by_email = serializers.SerializerMethodField()

    class Meta:
        model = EmailInsightSetting
        fields = [
            "id",
            "is_enabled",
            "is_active",
            "enabled_by",
            "enabled_by_email",
            "enabled_at",
            "tracking_open",
            "tracking_click",
            "tracking_bounce",
            "workflow_trigger_enabled",
            "created_at",
            "updated_at",
        ]

    def get_enabled_by_email(self, obj):
        return getattr(obj.enabled_by, "email", None) if obj.enabled_by else None

    def update(self, instance, validated_data):
        if any(field in validated_data for field in ["is_enabled", "tracking_open", "tracking_click", "tracking_bounce"]):
            validated_data.setdefault("enabled_at", timezone.now())
            request = self.context.get("request")
            if request and request.user.is_authenticated:
                validated_data.setdefault("enabled_by", request.user)
        return super().update(instance, validated_data)


class UnsubscribeLinkSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = UnsubscribeLink
        fields = [
            "id",
            "name",
            "location_type",
            "custom_url",
            "action_type",
            "redirect_url",
            "display_message",
            "is_default",
            "created_by",
            "created_by_email",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", None) if obj.created_by else None


class SocialAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialAccount
        fields = [
            "id",
            "brand",
            "platform",
            "account_name",
            "handle",
            "page_id",
            "access_token",
            "refresh_token",
            "is_connected",
            "connected_at",
            "last_synced_at",
            "is_active",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "access_token": {"write_only": True, "required": False, "allow_blank": True, "allow_null": True},
            "refresh_token": {"write_only": True, "required": False, "allow_blank": True, "allow_null": True},
        }


class SocialBrandListSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialBrand
        fields = ["id", "brand_name", "brand_description", "is_active", "created_by", "created_at", "updated_at"]


class SocialBrandDetailSerializer(SocialBrandListSerializer):
    accounts = SocialAccountSerializer(many=True, read_only=True)

    class Meta(SocialBrandListSerializer.Meta):
        fields = SocialBrandListSerializer.Meta.fields + ["accounts"]


class SocialPermissionSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialPermissionSetting
        fields = [
            "id",
            "social_admin_role_name",
            "social_tab_profiles",
            "social_profiles",
            "private_handles_enabled",
            "is_active",
            "created_at",
            "updated_at",
        ]


class SocialLeadAutomationRuleSerializer(serializers.ModelSerializer):
    assign_to_user_email = serializers.SerializerMethodField()

    class Meta:
        model = SocialLeadAutomationRule
        fields = [
            "id",
            "platform",
            "trigger_type",
            "action_type",
            "is_active",
            "qualification_logic",
            "assign_to_user",
            "assign_to_user_email",
            "assign_to_team",
            "created_at",
            "updated_at",
        ]

    def get_assign_to_user_email(self, obj):
        return getattr(obj.assign_to_user, "email", None) if obj.assign_to_user else None


class SocialConnectSerializer(serializers.Serializer):
    account_name = serializers.CharField(required=False, allow_blank=True)
    handle = serializers.CharField(required=False, allow_blank=True)
    page_id = serializers.CharField(required=False, allow_blank=True)
    access_token = serializers.CharField(required=False, allow_blank=True)
    refresh_token = serializers.CharField(required=False, allow_blank=True)


class SocialMessageSerializer(serializers.ModelSerializer):
    brand_name = serializers.SerializerMethodField()
    social_account_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()
    support_case_name = serializers.SerializerMethodField()

    class Meta:
        model = SocialMessage
        fields = [
            "id",
            "platform",
            "brand",
            "brand_name",
            "social_account",
            "social_account_name",
            "external_message_id",
            "profile_handle",
            "sender_name",
            "sender_email",
            "sender_phone",
            "message",
            "created_at_source",
            "payload",
            "lead",
            "lead_name",
            "contact",
            "contact_name",
            "account",
            "account_name",
            "deal",
            "deal_name",
            "support_case",
            "support_case_name",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_brand_name(self, obj):
        return record_display_name(obj.brand)

    def get_social_account_name(self, obj):
        return record_display_name(obj.social_account)

    def get_lead_name(self, obj):
        return record_display_name(obj.lead)

    def get_contact_name(self, obj):
        return record_display_name(obj.contact)

    def get_account_name(self, obj):
        return record_display_name(obj.account)

    def get_deal_name(self, obj):
        return record_display_name(obj.deal)

    def get_support_case_name(self, obj):
        return record_display_name(obj.support_case)

    def validate_sender_email(self, value):
        return normalize_email(value)


class VisitorTrackingPortalSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = VisitorTrackingPortal
        fields = [
            "id",
            "portal_name",
            "portal_url",
            "is_active",
            "is_available",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", None) if obj.created_by else None


class VisitorTrackingSettingSerializer(serializers.ModelSerializer):
    assign_lead_to_user_email = serializers.SerializerMethodField()
    portal_name = serializers.SerializerMethodField()

    class Meta:
        model = VisitorTrackingSetting
        fields = [
            "id",
            "portal",
            "portal_name",
            "push_new_visitors_as",
            "assign_lead_to_user",
            "assign_lead_to_user_email",
            "notify_when_visitor_online",
            "status_enabled",
            "department_name",
            "app_name",
            "tracking_code",
            "chat_widget_enabled",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["tracking_code"]

    def get_assign_lead_to_user_email(self, obj):
        return getattr(obj.assign_lead_to_user, "email", None) if obj.assign_lead_to_user else None

    def get_portal_name(self, obj):
        return obj.portal.portal_name if obj.portal else None


class VisitorLeadEventSerializer(serializers.ModelSerializer):
    portal_name = serializers.SerializerMethodField()
    linked_lead_name = serializers.SerializerMethodField()
    linked_contact_name = serializers.SerializerMethodField()
    source_label = serializers.CharField(write_only=True, required=False, allow_blank=True)
    source_reference = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = VisitorLeadEvent
        fields = [
            "id",
            "portal",
            "portal_name",
            "session_id",
            "visitor_name",
            "visitor_email",
            "identified_email",
            "page_url",
            "source_url",
            "referrer",
            "page_history",
            "time_spent_seconds",
            "event_type",
            "converted_to_lead",
            "linked_lead",
            "linked_lead_name",
            "linked_contact",
            "linked_contact_name",
            "source_label",
            "source_reference",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_portal_name(self, obj):
        return obj.portal.portal_name

    def get_linked_lead_name(self, obj):
        return record_display_name(obj.linked_lead)

    def get_linked_contact_name(self, obj):
        return record_display_name(obj.linked_contact)

    def validate_visitor_email(self, value):
        return normalize_email(value)

    def validate_identified_email(self, value):
        return normalize_email(value)


class IntegrationLeadSourceEventSerializer(serializers.ModelSerializer):
    lead_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()
    support_case_name = serializers.SerializerMethodField()
    source_label = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationLeadSourceEvent
        fields = [
            "id",
            "source_type",
            "source_label",
            "source_reference",
            "payload",
            "lead",
            "lead_name",
            "contact",
            "contact_name",
            "account",
            "account_name",
            "deal",
            "deal_name",
            "support_case",
            "support_case_name",
            "status",
            "created_at",
            "updated_at",
        ]

    def get_lead_name(self, obj):
        return record_display_name(obj.lead)

    def get_contact_name(self, obj):
        return record_display_name(obj.contact)

    def get_account_name(self, obj):
        return record_display_name(obj.account)

    def get_deal_name(self, obj):
        return record_display_name(obj.deal)

    def get_support_case_name(self, obj):
        return record_display_name(obj.support_case)

    def get_source_label(self, obj):
        payload = obj.payload or {}
        if obj.source_type == IntegrationLeadSourceEvent.SourceType.EMAIL:
            subject = payload.get("subject")
            from_email = payload.get("from_email")
            direction = payload.get("direction")
            if subject and from_email:
                suffix = "sent" if direction == "outgoing" else "received"
                return f"{subject} ({from_email}, {suffix})"
            if subject:
                return subject
            if from_email:
                return from_email
        return payload.get("source_label") or obj.source_reference


class EmailSyncLogSerializer(serializers.ModelSerializer):
    provider_email = serializers.SerializerMethodField()

    class Meta:
        model = EmailSyncLog
        fields = [
            "id",
            "provider_integration",
            "provider_email",
            "sync_type",
            "status",
            "last_synced_at",
            "error_message",
            "metadata",
            "created_at",
            "updated_at",
        ]

    def get_provider_email(self, obj):
        return obj.provider_integration.email_address


class EmailProviderSyncRequestSerializer(serializers.Serializer):
    sync_type = serializers.ChoiceField(choices=EmailSyncLog.SyncType.choices, required=False)


class VisitorLeadEventLinkSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField(required=False)


class TrackingCodeSerializer(serializers.Serializer):
    tracking_code = serializers.CharField()


class CredibilityReportSerializer(serializers.Serializer):
    total_sent = serializers.IntegerField()
    delivered_count = serializers.IntegerField()
    bounced_count = serializers.IntegerField()
    spam_complaints = serializers.IntegerField()
    average_score = serializers.IntegerField()
    active_relays = serializers.ListField()


class PublicVisitorTrackingEventSerializer(serializers.Serializer):
    portal_key = serializers.CharField(max_length=64)
    session_id = serializers.CharField(required=False, allow_blank=True)
    visitor_name = serializers.CharField(required=False, allow_blank=True)
    visitor_email = serializers.EmailField(required=False, allow_null=True)
    identified_email = serializers.EmailField(required=False, allow_null=True)
    page_url = serializers.URLField(required=False, allow_blank=True)
    source_url = serializers.URLField(required=False, allow_blank=True)
    referrer = serializers.URLField(required=False, allow_blank=True)
    page_history = serializers.ListField(child=serializers.CharField(), required=False)
    time_spent_seconds = serializers.IntegerField(required=False, min_value=0)
    event_type = serializers.CharField(required=False, allow_blank=True)
    source_label = serializers.CharField(required=False, allow_blank=True)
    source_reference = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)

    def validate_visitor_email(self, value):
        return normalize_email(value)

    def validate_identified_email(self, value):
        return normalize_email(value)
