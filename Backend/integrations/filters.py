import django_filters
from django.db.models import Q

from .models import (
    EmailAuthenticationDomain,
    EmailProviderIntegration,
    IntegrationLeadSourceEvent,
    SocialMessage,
    OrganizationEmailAddress,
    SocialAccount,
    SyncedEmailMessage,
    VisitorLeadEvent,
    VisitorTrackingPortal,
)


class EmailProviderIntegrationFilter(django_filters.FilterSet):
    class Meta:
        model = EmailProviderIntegration
        fields = ["provider_type", "is_active", "sales_inbox_enabled", "sync_enabled"]


class OrganizationEmailAddressFilter(django_filters.FilterSet):
    class Meta:
        model = OrganizationEmailAddress
        fields = ["confirmation_status", "authentication_status", "is_verified"]


class EmailAuthenticationDomainFilter(django_filters.FilterSet):
    class Meta:
        model = EmailAuthenticationDomain
        fields = ["authentication_status", "is_verified"]


class SocialAccountFilter(django_filters.FilterSet):
    class Meta:
        model = SocialAccount
        fields = ["platform", "is_connected"]


class VisitorTrackingPortalFilter(django_filters.FilterSet):
    class Meta:
        model = VisitorTrackingPortal
        fields = ["is_active", "is_available"]


class VisitorLeadEventFilter(django_filters.FilterSet):
    lead = django_filters.NumberFilter(field_name="linked_lead")
    contact = django_filters.NumberFilter(field_name="linked_contact")
    created_at_after = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_at_before = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = VisitorLeadEvent
        fields = [
            "portal",
            "lead",
            "contact",
            "linked_lead",
            "linked_contact",
            "converted_to_lead",
            "event_type",
            "created_at_after",
            "created_at_before",
        ]


class IntegrationLeadSourceEventFilter(django_filters.FilterSet):
    created_at_after = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_at_before = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = IntegrationLeadSourceEvent
        fields = ["source_type", "status", "lead", "contact", "account", "deal", "support_case", "created_at_after", "created_at_before"]


class SyncedEmailMessageFilter(django_filters.FilterSet):
    received_at_after = django_filters.IsoDateTimeFilter(field_name="received_at", lookup_expr="gte")
    received_at_before = django_filters.IsoDateTimeFilter(field_name="received_at", lookup_expr="lte")
    participant_email = django_filters.CharFilter(method="filter_participant_email")

    def filter_participant_email(self, queryset, name, value):
        normalized = (value or "").strip().lower()
        if not normalized:
            return queryset
        return queryset.filter(
            Q(from_email__iexact=normalized)
            | Q(to_emails__contains=[normalized])
            | Q(cc_emails__contains=[normalized])
            | Q(bcc_emails__contains=[normalized])
        )

    class Meta:
        model = SyncedEmailMessage
        fields = [
            "provider_integration",
            "lead",
            "contact",
            "account",
            "deal",
            "support_case",
            "direction",
            "status",
            "is_read",
            "is_starred",
            "received_at_after",
            "received_at_before",
            "participant_email",
        ]


class SocialMessageFilter(django_filters.FilterSet):
    created_at_source_after = django_filters.IsoDateTimeFilter(field_name="created_at_source", lookup_expr="gte")
    created_at_source_before = django_filters.IsoDateTimeFilter(field_name="created_at_source", lookup_expr="lte")

    class Meta:
        model = SocialMessage
        fields = [
            "platform",
            "brand",
            "social_account",
            "lead",
            "contact",
            "account",
            "deal",
            "support_case",
            "created_at_source_after",
            "created_at_source_before",
        ]
