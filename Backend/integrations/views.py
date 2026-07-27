from __future__ import annotations

from datetime import timedelta
import threading
from django.conf import settings
from django.core import signing
from django.http import HttpResponse, HttpResponseRedirect
from django.db.models import Q
from django.shortcuts import get_object_or_404
import os
import json
from urllib import parse as urllib_parse, request as urllib_request, error as urllib_error
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .filters import (
    EmailAuthenticationDomainFilter,
    EmailProviderIntegrationFilter,
    IntegrationLeadSourceEventFilter,
    OrganizationEmailAddressFilter,
    SocialAccountFilter,
    SocialMessageFilter,
    SyncedEmailMessageFilter,
    VisitorLeadEventFilter,
    VisitorTrackingPortalFilter,
)
from .models import (
    BCCDropboxSetting,
    CustomEmailFieldPreference,
    EmailProviderIntegration,
    EmailAuthenticationDomain,
    EmailComposeSetting,
    EmailCredibilityMetric,
    EmailInsightSetting,
    EmailParserInbox,
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
from .permissions import IsIntegrationAdminOrReadOnly, IsOwnerOrIntegrationAdmin, is_integration_admin
from .serializers import (
    BCCAddressAddSerializer,
    BCCAddressVerifySerializer,
    BCCDropboxSettingSerializer,
    CRMEmailDetailSerializer,
    CRMEmailSendSerializer,
    CRMEmailSyncSerializer,
    CredibilityReportSerializer,
    CustomEmailFieldPreferenceSerializer,
    EmailAuthenticationDomainSerializer,
    EmailComposeSettingSerializer,
    EmailCredibilityMetricSerializer,
    EmailInsightSettingSerializer,
    EmailParserInboxSerializer,
    EmailProviderIntegrationDetailSerializer,
    EmailProviderIntegrationListSerializer,
    EmailProviderIntegrationWriteSerializer,
    EmailProviderSyncRequestSerializer,
    EmailRelayServerSerializer,
    EmailSharingPermissionSerializer,
    EmailSyncLogSerializer,
    IntegrationLeadSourceEventSerializer,
    OrganizationEmailAddressSerializer,
    ParserGenerateSerializer,
    ParserIngestSerializer,
    PublicVisitorTrackingEventSerializer,
    SalesInboxFeedSerializer,
    SalesInboxSettingSerializer,
    SocialAccountSerializer,
    SocialBrandDetailSerializer,
    SocialBrandListSerializer,
    SocialConnectSerializer,
    SocialLeadAutomationRuleSerializer,
    SocialMessageSerializer,
    SocialPermissionSettingSerializer,
    TrackingCodeSerializer,
    UnsubscribeLinkSerializer,
    VisitorLeadEventLinkSerializer,
    VisitorLeadEventSerializer,
    VisitorTrackingPortalSerializer,
    VisitorTrackingSettingSerializer,
)
from .services import (
    add_verified_bcc_address,
    build_credibility_report,
    build_sales_inbox_queryset,
    check_domain_status,
    confirm_organization_email,
    connect_social_account,
    convert_visitor_event,
    create_outgoing_crm_email,
    create_visitor_event,
    disconnect_social_account,
    ensure_portal_tracking_code,
    generate_bcc_address,
    generate_parser_address,
    ingest_social_message,
    ingest_parser_message,
    process_bcc_payload,
    resolve_visitor_portal_by_tracking_key,
    regenerate_bcc_dropbox,
    run_provider_sync,
    sync_social_account,
    link_visitor_event_to_lead,
    provider_supports_real_mail_sync,
    upsert_email_record_link,
    verify_bcc_address,
    visible_queryset,
)
from .utils import build_tracking_code
from leads.models import Lead
from accounts.models import Account
from contacts.models import Contact
from deals.models import Deal
from support.models import SupportCase

# Hide synthetic starter/template messages in CRM lists/notifications.
# This keeps only real provider-synced emails (exact subject/body) visible.
DEMO_EMAIL_EXTERNAL_ID_REGEX = r"^\d+-(starter-message|(lead|contact|case)-\d+(-incoming)?)$"


TRACKER_SCRIPT_TEMPLATE = """
(function () {
  var portalKey = window.CRMVisitorPortal;
  if (!portalKey) return;

  var endpoint = "__COLLECT_URL__";
  var sessionStorageKey = "crmVisitorSession:" + portalKey;
  var sessionId = window.sessionStorage.getItem(sessionStorageKey);
  if (!sessionId) {
    sessionId = "visit-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.sessionStorage.setItem(sessionStorageKey, sessionId);
  }

  function readVisitorIdentity() {
    var identity = window.CRMVisitorIdentity || window.CRMVisitorData || {};
    return {
      visitor_name: identity.name || identity.visitor_name || "",
      visitor_email: identity.email || identity.visitor_email || "",
      identified_email: identity.identified_email || identity.email || "",
      phone: identity.phone || "",
    };
  }

  function buildPayload(eventType, secondsSpent) {
    var identity = readVisitorIdentity();
    return {
      portal_key: portalKey,
      session_id: sessionId,
      event_type: eventType || "visit",
      visitor_name: identity.visitor_name,
      visitor_email: identity.visitor_email,
      identified_email: identity.identified_email,
      phone: identity.phone,
      page_url: window.location.href,
      source_url: document.referrer || window.location.href,
      referrer: document.referrer || "",
      page_history: [window.location.href],
      time_spent_seconds: Math.max(0, Math.round(secondsSpent || 0)),
      source_label: document.title || "Website Visitor",
      source_reference: window.location.pathname || "/"
    };
  }

  function transmit(eventType, secondsSpent) {
    var payload = JSON.stringify(buildPayload(eventType, secondsSpent));
    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
      return;
    }
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "omit"
    }).catch(function () {});
  }

  var startedAt = Date.now();
  transmit("visit", 0);
  window.addEventListener("beforeunload", function () {
    var secondsSpent = (Date.now() - startedAt) / 1000;
    transmit("page_exit", secondsSpent);
  });
})();
""".strip()

FACEBOOK_OAUTH_STATE_SALT = "integrations.facebook.social.oauth"


def _frontend_base_url(request) -> str:
    configured = os.getenv("FRONTEND_BASE_URL")
    if configured:
        return configured.rstrip("/")
    origin = request.headers.get("Origin")
    if origin:
        return origin.rstrip("/")
    return request.build_absolute_uri("/").rstrip("/")


def _facebook_callback_url(request) -> str:
    return request.build_absolute_uri("/api/integrations/social/facebook/callback")


def _facebook_json(url: str) -> dict:
    try:
        with urllib_request.urlopen(url, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
            message = payload.get("error", {}).get("message")
        except Exception:
            message = None
        raise ValueError(message or f"Facebook request failed with status {exc.code}.") from exc
    except urllib_error.URLError as exc:
        raise ValueError("Facebook request could not be completed.") from exc


def _social_redirect_with_status(base_url: str, status_value: str, message: str | None = None) -> HttpResponseRedirect:
    parsed = urllib_parse.urlparse(base_url)
    params = urllib_parse.parse_qs(parsed.query)
    params["social_oauth"] = [status_value]
    if message:
        params["social_message"] = [message]
    query = urllib_parse.urlencode(params, doseq=True)
    return HttpResponseRedirect(urllib_parse.urlunparse(parsed._replace(query=query)))


def _activate_tenant_db(tenant_db: str | None) -> None:
    return None


def _auto_sync_email_providers_if_stale(request, *, max_age_seconds: int = 600) -> None:
    threshold = timezone.now() - timedelta(seconds=max_age_seconds)
    providers = visible_queryset(
        EmailProviderIntegration.objects.filter(
            is_active=True,
            sync_enabled=True,
            crm_sync_enabled=True,
        ),
        request.user,
    )

    for provider in providers:
        if not provider_supports_real_mail_sync(provider):
            continue
        if provider.last_synced_at and provider.last_synced_at >= threshold:
            continue
        try:
            run_provider_sync(
                provider_integration=provider,
                sync_type="incremental_sync",
                triggered_by=request.user,
            )
        except Exception:
            # Keep record pages responsive even if auto-sync fails.
            continue


class IntegrationBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    ordering = ["-created_at"]

    def sort_queryset(self, queryset):
        sort = self.request.query_params.get("sort")
        if not sort:
            return queryset
        allowed = set(getattr(self, "ordering_fields", []))
        normalized = sort[1:] if sort.startswith("-") else sort
        if normalized in allowed:
            return queryset.order_by(sort)
        return queryset


class VisitorTrackingScriptAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        collect_url = request.build_absolute_uri("/api/integrations/visitors/collect")
        content = TRACKER_SCRIPT_TEMPLATE.replace("__COLLECT_URL__", collect_url)
        return HttpResponse(content, content_type="application/javascript")


class PublicVisitorTrackingCollectAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PublicVisitorTrackingEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        portal = resolve_visitor_portal_by_tracking_key(serializer.validated_data["portal_key"])
        if not portal:
            return Response({"detail": "Invalid visitor portal key."}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = create_visitor_event(
                payload={
                    **serializer.validated_data,
                    "portal": portal,
                },
                user=None,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "event_id": result["visitor_event"].id,
                "linked_lead": getattr(result["visitor_event"].linked_lead, "id", None),
                "linked_contact": getattr(result["visitor_event"].linked_contact, "id", None),
            },
            status=status.HTTP_201_CREATED,
        )


class FacebookSocialWebhookAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        verify_token = request.query_params.get("hub.verify_token")
        expected = os.getenv("FACEBOOK_WEBHOOK_VERIFY_TOKEN")
        if expected and verify_token == expected:
            return Response(request.query_params.get("hub.challenge", ""))
        return Response({"detail": "Webhook verification failed."}, status=status.HTTP_403_FORBIDDEN)

    def post(self, request):
        processed = 0
        for entry in request.data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value") or {}
                sender = value.get("from") or {}
                page_id = value.get("post_id") or entry.get("id")
                account = SocialAccount.objects.filter(platform=SocialAccount.Platform.FACEBOOK, page_id=page_id).first()
                if not account:
                    continue
                ingest_social_message(
                    payload={
                        "platform": SocialMessage.Platform.FACEBOOK,
                        "brand": account.brand,
                        "social_account": account,
                        "external_message_id": value.get("comment_id") or value.get("post_id") or value.get("item"),
                        "profile_handle": sender.get("id"),
                        "sender_name": sender.get("name"),
                        "message": value.get("message") or value.get("verb") or "Facebook webhook activity",
                        "payload": value,
                    },
                    user=account.brand.created_by if account.brand else None,
                )
                processed += 1
        return Response({"processed": processed}, status=status.HTTP_202_ACCEPTED)


class XSocialWebhookAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        processed = 0
        for item in request.data.get("events", []) or request.data.get("data", []):
            user_handle = item.get("username") or item.get("user", {}).get("username")
            if not user_handle:
                continue
            account = SocialAccount.objects.filter(platform=SocialAccount.Platform.X, handle__iexact=f"@{user_handle}").first()
            if not account:
                account = SocialAccount.objects.filter(platform=SocialAccount.Platform.X, handle__iexact=user_handle).first()
            if not account:
                continue
            ingest_social_message(
                payload={
                    "platform": SocialMessage.Platform.X,
                    "brand": account.brand,
                    "social_account": account,
                    "external_message_id": item.get("id") or item.get("event_id"),
                    "profile_handle": f"@{user_handle}",
                    "sender_name": user_handle,
                    "message": item.get("text") or item.get("message") or "X webhook activity",
                    "payload": item,
                },
                user=account.brand.created_by if account.brand else None,
            )
            processed += 1
        return Response({"processed": processed}, status=status.HTTP_202_ACCEPTED)


class FacebookSocialOAuthStartAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        account = get_object_or_404(
            SocialAccount.objects.select_related("brand"),
            pk=pk,
            platform=SocialAccount.Platform.FACEBOOK,
        )
        app_id = os.getenv("FACEBOOK_APP_ID")
        if not app_id:
            return Response(
                {"detail": "FACEBOOK_APP_ID is not configured in the backend environment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        frontend_url = f"{_frontend_base_url(request)}/integrations/social"
        state = signing.dumps(
            {
                "account_id": account.id,
                "next": frontend_url,
            },
            salt=FACEBOOK_OAUTH_STATE_SALT,
        )
        auth_url = (
            "https://www.facebook.com/v19.0/dialog/oauth?"
            + urllib_parse.urlencode(
                {
                    "client_id": app_id,
                    "redirect_uri": _facebook_callback_url(request),
                    "state": state,
                    "scope": "pages_show_list,pages_read_engagement,pages_manage_metadata",
                    "response_type": "code",
                }
            )
        )
        return Response({"auth_url": auth_url})


class FacebookSocialOAuthCallbackAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        next_url = f"{_frontend_base_url(request)}/integrations/social"
        state_token = request.query_params.get("state")
        error_message = request.query_params.get("error_message") or request.query_params.get("error_description")
        code = request.query_params.get("code")

        try:
            state = signing.loads(state_token or "", salt=FACEBOOK_OAUTH_STATE_SALT, max_age=900)
            next_url = state.get("next") or next_url
        except Exception:
            return _social_redirect_with_status(
                next_url,
                "facebook_error",
                "Facebook login session expired. Please try connecting again.",
            )

        if error_message:
            return _social_redirect_with_status(next_url, "facebook_error", error_message)

        if not code:
            return _social_redirect_with_status(
                next_url,
                "facebook_error",
                "Facebook did not return an authorization code.",
            )

        app_id = os.getenv("FACEBOOK_APP_ID")
        app_secret = os.getenv("FACEBOOK_APP_SECRET")
        if not app_id or not app_secret:
            return _social_redirect_with_status(
                next_url,
                "facebook_error",
                "Facebook app credentials are missing in backend environment.",
            )

        try:
            token_payload = _facebook_json(
                "https://graph.facebook.com/v19.0/oauth/access_token?"
                + urllib_parse.urlencode(
                    {
                        "client_id": app_id,
                        "client_secret": app_secret,
                        "redirect_uri": _facebook_callback_url(request),
                        "code": code,
                    }
                )
            )
            user_access_token = token_payload.get("access_token")
            if not user_access_token:
                raise ValueError("Facebook did not return an access token.")

            account = SocialAccount.objects.get(pk=state["account_id"])
            pages_payload = _facebook_json(
                "https://graph.facebook.com/v19.0/me/accounts?"
                + urllib_parse.urlencode(
                    {
                        "access_token": user_access_token,
                        "fields": "id,name,access_token",
                        "limit": 25,
                    }
                )
            )
            pages = pages_payload.get("data") or []
            if not pages:
                raise ValueError("No Facebook pages were returned for this account. Connect a page-enabled Facebook account.")

            selected_page = next(
                (page for page in pages if str(page.get("id") or "") == str(account.page_id or "")),
                pages[0],
            )
            page_token = selected_page.get("access_token") or user_access_token
            if not page_token:
                raise ValueError("Facebook page access token is missing.")

            account.access_token = page_token
            account.account_name = account.account_name or selected_page.get("name")
            account.page_id = str(selected_page.get("id") or account.page_id or "")
            account.is_connected = True
            account.connected_at = timezone.now()
            account.save(
                update_fields=[
                    "access_token",
                    "account_name",
                    "page_id",
                    "is_connected",
                    "connected_at",
                    "updated_at",
                ]
            )
        except Exception as exc:
            return _social_redirect_with_status(next_url, "facebook_error", str(exc))
        return _social_redirect_with_status(next_url, "facebook_success", "Facebook page connected successfully.")


class EmailProviderIntegrationViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrIntegrationAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = EmailProviderIntegrationFilter
    search_fields = ["email_address", "display_name", "provider_type"]
    ordering_fields = ["created_at", "updated_at", "email_address", "provider_type", "is_active"]
    queryset = EmailProviderIntegration.objects.select_related("created_by")

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def get_serializer_class(self):
        if self.action == "list":
            return EmailProviderIntegrationListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return EmailProviderIntegrationWriteSerializer
        if self.action == "sync":
            return EmailProviderSyncRequestSerializer
        return EmailProviderIntegrationDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(created_by=request.user)
        detail_data = EmailProviderIntegrationDetailSerializer(instance, context=self.get_serializer_context()).data
        return Response(
            {
                "message": "Email provider added successfully",
                "data": detail_data,
            },
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(
            {
                "message": "Email provider updated successfully",
                "data": EmailProviderIntegrationDetailSerializer(
                    updated,
                    context=self.get_serializer_context(),
                ).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="sync")
    def sync(self, request, pk=None):
        provider = self.get_object()
        serializer = self.get_serializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        sync_type = serializer.validated_data.get("sync_type", "incremental_sync")

        running_log = (
            EmailSyncLog.objects.filter(
                provider_integration=provider,
                status=EmailSyncLog.Status.RUNNING,
            )
            .order_by("-created_at")
            .first()
        )
        if running_log and running_log.created_at and running_log.created_at >= timezone.now() - timedelta(minutes=10):
            return Response(
                {
                    "message": "Provider sync is already running.",
                    "emails_synced": 0,
                    "lead_matches": 0,
                    "log": EmailSyncLogSerializer(running_log).data,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        log = EmailSyncLog.objects.create(
            provider_integration=provider,
            sync_type=sync_type,
            status=EmailSyncLog.Status.RUNNING,
            metadata={"triggered_by": getattr(request.user, "id", None)},
        )

        def _run_sync_in_background():
            try:
                run_provider_sync(
                    provider_integration=provider,
                    sync_type=sync_type,
                    triggered_by=request.user,
                    existing_log=log,
                )
            except Exception:
                # Errors are already recorded into the sync log by run_provider_sync.
                return

        threading.Thread(target=_run_sync_in_background, daemon=True).start()
        return Response(
            {
                "message": "Provider sync started successfully.",
                "emails_synced": 0,
                "lead_matches": 0,
                "log": EmailSyncLogSerializer(log).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class EmailComposeSettingViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrIntegrationAdmin]
    queryset = EmailComposeSetting.objects.select_related("user", "default_from_integration", "default_reply_to_integration")
    ordering_fields = ["created_at", "updated_at", "default_font_family"]
    serializer_class = EmailComposeSettingSerializer

    def get_queryset(self):
        queryset = self.queryset
        if not is_integration_admin(self.request.user):
            queryset = queryset.filter(user=self.request.user)
        return self.sort_queryset(queryset)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user if not is_integration_admin(self.request.user) else serializer.validated_data.get("user") or self.request.user)


class EmailSharingPermissionViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrIntegrationAdmin]
    queryset = EmailSharingPermission.objects.select_related("user")
    ordering_fields = ["created_at", "updated_at", "configuration_type", "sharing_mode"]
    serializer_class = EmailSharingPermissionSerializer

    def get_queryset(self):
        queryset = self.queryset
        if not is_integration_admin(self.request.user):
            queryset = queryset.filter(user=self.request.user)
        return self.sort_queryset(queryset)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user if not is_integration_admin(self.request.user) else serializer.validated_data.get("user") or self.request.user)


class OrganizationEmailAddressViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = OrganizationEmailAddressFilter
    search_fields = ["display_name", "email_address"]
    ordering_fields = ["created_at", "updated_at", "display_name", "confirmation_status", "authentication_status"]
    queryset = OrganizationEmailAddress.objects.select_related("created_by")
    serializer_class = OrganizationEmailAddressSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        instance = self.get_object()
        confirm_organization_email(instance)
        return Response(self.get_serializer(instance).data)


class CustomEmailFieldPreferenceViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = CustomEmailFieldPreference.objects.all()
    ordering_fields = ["created_at", "updated_at"]
    serializer_class = CustomEmailFieldPreferenceSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)


class SalesInboxSettingViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = SalesInboxSetting.objects.select_related("provider_integration")
    ordering_fields = ["created_at", "updated_at"]

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def get_serializer_class(self):
        if self.action == "feed":
            return SalesInboxFeedSerializer
        return SalesInboxSettingSerializer

    @action(detail=False, methods=["get"], url_path="feed")
    def feed(self, request):
        _auto_sync_email_providers_if_stale(request)
        queryset = build_sales_inbox_queryset(request.user)
        only_related = str(request.query_params.get("only_related", "")).lower() in {"1", "true", "yes"}
        if only_related:
            queryset = queryset.filter(
                Q(lead__isnull=False)
                | Q(contact__isnull=False)
                | Q(account__isnull=False)
                | Q(deal__isnull=False)
                | Q(support_case__isnull=False)
            )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(self.get_serializer(queryset, many=True).data)


class SyncedEmailMessageViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SyncedEmailMessage.objects.select_related(
        "lead",
        "contact",
        "account",
        "deal",
        "support_case",
        "provider_integration",
    )
    serializer_class = SalesInboxFeedSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SyncedEmailMessageFilter
    search_fields = ["subject", "from_email", "thread_id", "provider_integration__email_address"]
    ordering_fields = ["created_at", "updated_at", "received_at", "sent_at", "status", "direction"]
    ordering = ["-received_at", "-created_at"]

    def get_queryset(self):
        return self.queryset


class EmailParserInboxViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = EmailParserInbox.objects.all()
    ordering_fields = ["created_at", "updated_at", "parser_name"]

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def get_serializer_class(self):
        if self.action == "generate":
            return ParserGenerateSerializer
        if self.action == "ingest":
            return ParserIngestSerializer
        return EmailParserInboxSerializer

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = EmailParserInbox.objects.create(
            parser_name=serializer.validated_data["parser_name"],
            parser_email_address=generate_parser_address(serializer.validated_data["parser_name"]),
            mapping_config=serializer.validated_data.get("mapping_config", {}),
            create_record_type=serializer.validated_data.get("create_record_type", EmailParserInbox.RecordType.LEAD),
        )
        return Response(EmailParserInboxSerializer(instance).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="ingest")
    def ingest(self, request, pk=None):
        parser_inbox = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = ingest_parser_message(parser_inbox=parser_inbox, payload=serializer.validated_data, user=request.user)
        return Response(
            {
                "message": "Parser email ingested successfully.",
                "lead_id": getattr(result.get("lead"), "id", None),
                "contact_id": getattr(result.get("contact"), "id", None),
                "support_case_id": getattr(result.get("support_case"), "id", None),
                "event_id": result["event"].id,
            },
            status=status.HTTP_201_CREATED,
        )


class BCCDropboxSettingViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = BCCDropboxSetting.objects.prefetch_related("verified_addresses")
    ordering_fields = ["created_at", "updated_at"]

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def get_serializer_class(self):
        if self.action == "add_email":
            return BCCAddressAddSerializer
        if self.action == "verify_email":
            return BCCAddressVerifySerializer
        return BCCDropboxSettingSerializer

    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        payload.setdefault("dropbox_email_address", generate_bcc_address())
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(BCCDropboxSettingSerializer(instance).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-email")
    def add_email(self, request, pk=None):
        setting = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        address = add_verified_bcc_address(setting=setting, email_address=serializer.validated_data["email_address"])
        return Response(
            {
                "id": address.id,
                "email_address": address.email_address,
                "verification_status": address.verification_status,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="verify-email")
    def verify_email(self, request, pk=None):
        setting = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            address = verify_bcc_address(
                setting=setting,
                email_address=serializer.validated_data["email_address"],
                verification_code=serializer.validated_data["verification_code"],
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"id": address.id, "verification_status": address.verification_status})

    @action(detail=True, methods=["post"], url_path="regenerate")
    def regenerate(self, request, pk=None):
        setting = regenerate_bcc_dropbox(self.get_object())
        return Response(BCCDropboxSettingSerializer(setting).data)

    @action(detail=True, methods=["post"], url_path="process")
    def process(self, request, pk=None):
        setting = self.get_object()
        result = process_bcc_payload(setting=setting, payload=request.data, user=request.user)
        return Response(
            {
                "message": "BCC payload processed successfully.",
                "lead_id": getattr(result.get("lead"), "id", None),
                "contact_id": getattr(result.get("contact"), "id", None),
                "event_id": result["event"].id,
            },
            status=status.HTTP_201_CREATED,
        )


class EmailAuthenticationDomainViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = EmailAuthenticationDomainFilter
    search_fields = ["domain_name", "email_status"]
    ordering_fields = ["created_at", "updated_at", "domain_name", "authentication_status"]
    queryset = EmailAuthenticationDomain.objects.all()
    serializer_class = EmailAuthenticationDomainSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    @action(detail=True, methods=["post"], url_path="check-status")
    def check_status(self, request, pk=None):
        instance = check_domain_status(self.get_object())
        return Response(self.get_serializer(instance).data)


class EmailRelayServerViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = EmailRelayServer.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["server_name", "domain_name", "email_type", "username"]
    ordering_fields = ["created_at", "updated_at", "server_name", "domain_name"]
    serializer_class = EmailRelayServerSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)


class EmailCredibilityMetricViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = EmailCredibilityMetric.objects.all()
    serializer_class = EmailCredibilityMetricSerializer
    ordering = ["-report_period_end"]

    @action(detail=False, methods=["get"], url_path="report")
    def report(self, request):
        return Response(CredibilityReportSerializer(build_credibility_report()).data)


class EmailInsightSettingViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = EmailInsightSetting.objects.select_related("enabled_by")
    ordering_fields = ["created_at", "updated_at", "enabled_at"]
    serializer_class = EmailInsightSettingSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)


class UnsubscribeLinkViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = UnsubscribeLink.objects.select_related("created_by")
    ordering_fields = ["created_at", "updated_at", "name"]
    serializer_class = UnsubscribeLinkSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SocialBrandViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = SocialBrand.objects.prefetch_related("accounts")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["brand_name", "brand_description"]
    ordering_fields = ["created_at", "updated_at", "brand_name"]

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def get_serializer_class(self):
        if self.action == "list":
            return SocialBrandListSerializer
        return SocialBrandDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SocialAccountViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = SocialAccount.objects.select_related("brand")
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SocialAccountFilter
    search_fields = ["account_name", "handle", "platform", "brand__brand_name"]
    ordering_fields = ["created_at", "updated_at", "account_name", "platform"]

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def get_serializer_class(self):
        if self.action in {"connect", "disconnect"}:
            return SocialConnectSerializer
        return SocialAccountSerializer

    @action(detail=True, methods=["post"], url_path="connect")
    def connect(self, request, pk=None):
        account = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        connect_social_account(account, serializer.validated_data)
        return Response(SocialAccountSerializer(account).data)

    @action(detail=True, methods=["post"], url_path="disconnect")
    def disconnect(self, request, pk=None):
        account = disconnect_social_account(self.get_object())
        return Response(SocialAccountSerializer(account).data)

    @action(detail=True, methods=["post"], url_path="sync")
    def sync(self, request, pk=None):
        account = self.get_object()
        try:
            messages = sync_social_account(account, triggered_by=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "message": "Social account sync completed successfully.",
                "messages_synced": len(messages),
                "last_synced_at": account.last_synced_at,
            }
        )


class SocialPermissionSettingViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = SocialPermissionSetting.objects.all()
    ordering_fields = ["created_at", "updated_at", "social_admin_role_name"]
    serializer_class = SocialPermissionSettingSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)


class SocialLeadAutomationRuleViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = SocialLeadAutomationRule.objects.select_related("assign_to_user")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["platform", "trigger_type", "assign_to_team", "assign_to_user__email"]
    ordering_fields = ["created_at", "updated_at", "platform", "trigger_type"]
    serializer_class = SocialLeadAutomationRuleSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)


class SocialMessageViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SocialMessage.objects.select_related(
        "brand",
        "social_account",
        "lead",
        "contact",
        "account",
        "deal",
        "support_case",
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SocialMessageFilter
    search_fields = ["sender_name", "sender_email", "profile_handle", "message", "external_message_id"]
    ordering_fields = ["created_at", "updated_at", "created_at_source", "platform"]
    serializer_class = SocialMessageSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = ingest_social_message(payload=serializer.validated_data, user=request.user)
        return Response(SocialMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class VisitorTrackingPortalViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = VisitorTrackingPortal.objects.select_related("created_by")
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = VisitorTrackingPortalFilter
    search_fields = ["portal_name", "portal_url"]
    ordering_fields = ["created_at", "updated_at", "portal_name", "is_available"]
    serializer_class = VisitorTrackingPortalSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def perform_create(self, serializer):
        portal = serializer.save(created_by=self.request.user)
        ensure_portal_tracking_code(
            portal,
            app_name=portal.portal_name,
            defaults={"push_new_visitors_as": "lead", "app_name": portal.portal_name},
        )

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        portal = self.get_object()
        portal.is_active = False
        portal.is_available = False
        portal.save(update_fields=["is_active", "is_available", "updated_at"])
        return Response(self.get_serializer(portal).data)


class VisitorTrackingSettingViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated, IsIntegrationAdminOrReadOnly]
    queryset = VisitorTrackingSetting.objects.select_related("portal", "assign_lead_to_user")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["portal__portal_name", "app_name", "department_name"]
    ordering_fields = ["created_at", "updated_at", "app_name"]

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def get_serializer_class(self):
        if self.action == "tracking_code":
            return TrackingCodeSerializer
        return VisitorTrackingSettingSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        portal = serializer.validated_data["portal"]
        instance = ensure_portal_tracking_code(
            portal,
            app_name=serializer.validated_data["app_name"],
            defaults={key: value for key, value in serializer.validated_data.items() if key != "portal"},
        )
        for field, value in serializer.validated_data.items():
            if field != "portal":
                setattr(instance, field, value)
        instance.save()
        return Response(VisitorTrackingSettingSerializer(instance).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="tracking-code")
    def tracking_code(self, request, pk=None):
        setting = self.get_object()
        script_url = request.build_absolute_uri("/api/integrations/visitors/tracker.js")
        tracking_code = build_tracking_code(setting.portal_id, setting.portal.portal_name, script_url=script_url)
        if setting.tracking_code != tracking_code:
            setting.tracking_code = tracking_code
            setting.save(update_fields=["tracking_code", "updated_at"])
        return Response({"tracking_code": tracking_code})


class VisitorLeadEventViewSet(IntegrationBaseViewSet):
    permission_classes = [IsAuthenticated]
    queryset = VisitorLeadEvent.objects.select_related("portal", "linked_lead", "linked_contact")
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = VisitorLeadEventFilter
    search_fields = ["visitor_name", "visitor_email", "source_url", "event_type"]
    ordering_fields = ["created_at", "updated_at", "event_type"]
    serializer_class = VisitorLeadEventSerializer

    def get_queryset(self):
        return self.sort_queryset(self.queryset)

    def get_serializer_class(self):
        if self.action == "link_lead":
            return VisitorLeadEventLinkSerializer
        return VisitorLeadEventSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = create_visitor_event(payload=serializer.validated_data, user=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                **VisitorLeadEventSerializer(result["visitor_event"]).data,
                "linked_source_event_id": result["source_event"].id,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="convert-to-lead")
    def convert_to_lead(self, request, pk=None):
        event = self.get_object()
        result = convert_visitor_event(visitor_event=event, user=request.user)
        return Response(
            {
                "lead_id": getattr(result.get("lead"), "id", None),
                "contact_id": getattr(result.get("contact"), "id", None),
                "event_id": getattr(result.get("event"), "id", None),
            }
        )

    @action(detail=True, methods=["post"], url_path="link-lead")
    def link_lead(self, request, pk=None):
        event = self.get_object()
        serializer = self.get_serializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        target_lead = None
        lead_id = serializer.validated_data.get("lead_id")
        if lead_id:
            target_lead = Lead.objects.filter(pk=lead_id).first()
            if not target_lead:
                return Response({"detail": "Lead not found."}, status=status.HTTP_404_NOT_FOUND)
        linked_lead = link_visitor_event_to_lead(visitor_event=event, lead=target_lead, user=request.user)
        return Response(
            {
                "message": "Visitor event linked successfully.",
                "lead_id": getattr(linked_lead, "id", None),
                "event_id": event.id,
            }
        )


class IntegrationLeadSourceEventViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = IntegrationLeadSourceEvent.objects.select_related("lead", "contact", "account", "deal", "support_case")
    serializer_class = IntegrationLeadSourceEventSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = IntegrationLeadSourceEventFilter
    search_fields = ["source_reference", "status", "lead__email", "contact__email", "deal__deal_name"]
    ordering_fields = ["created_at", "updated_at", "source_type", "status"]
    ordering = ["-created_at"]


def _email_record_filters(module: str, record_id: int) -> dict[str, int]:
    module_map = {
        "lead": {"lead_id": record_id},
        "leads": {"lead_id": record_id},
        "contact": {"contact_id": record_id},
        "contacts": {"contact_id": record_id},
        "account": {"account_id": record_id},
        "accounts": {"account_id": record_id},
        "deal": {"deal_id": record_id},
        "deals": {"deal_id": record_id},
        "case": {"support_case_id": record_id},
        "cases": {"support_case_id": record_id},
        "support_case": {"support_case_id": record_id},
    }
    filters_q = module_map.get((module or "").lower())
    if not filters_q:
        raise ValueError("Unsupported CRM module.")
    return filters_q


def _linked_record_kwargs(validated_data: dict[str, int]):
    lead = Lead.objects.filter(pk=validated_data.get("lead_id")).first() if validated_data.get("lead_id") else None
    contact = Contact.objects.filter(pk=validated_data.get("contact_id")).first() if validated_data.get("contact_id") else None
    account = Account.objects.filter(pk=validated_data.get("account_id")).first() if validated_data.get("account_id") else None
    deal = Deal.objects.filter(pk=validated_data.get("deal_id")).first() if validated_data.get("deal_id") else None
    support_case = (
        SupportCase.objects.filter(pk=validated_data.get("support_case_id")).first()
        if validated_data.get("support_case_id")
        else None
    )
    return {
        "lead": lead,
        "contact": contact,
        "account": account,
        "deal": deal,
        "support_case": support_case,
    }


class CRMEmailProviderConnectAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = EmailProviderIntegrationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(created_by=request.user)
        return Response(EmailProviderIntegrationDetailSerializer(instance).data, status=status.HTTP_201_CREATED)


class CRMEmailProviderListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = visible_queryset(
            EmailProviderIntegration.objects.select_related("created_by").all(),
            request.user,
        )
        return Response(EmailProviderIntegrationListSerializer(queryset, many=True).data)


class CRMEmailProviderDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        instance = get_object_or_404(visible_queryset(EmailProviderIntegration.objects.all(), request.user), pk=pk)
        serializer = EmailProviderIntegrationWriteSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(EmailProviderIntegrationDetailSerializer(updated).data)


class CRMEmailSyncAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CRMEmailSyncSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        provider_id = serializer.validated_data.get("provider_account_id")
        sync_type = serializer.validated_data.get("sync_type", EmailSyncLog.SyncType.INCREMENTAL_SYNC)

        queryset = visible_queryset(EmailProviderIntegration.objects.filter(is_active=True), request.user)
        if provider_id:
            queryset = queryset.filter(pk=provider_id)
        providers = list(queryset)
        if not providers:
            return Response({"detail": "No active provider found."}, status=status.HTTP_404_NOT_FOUND)

        logs = []
        for provider in providers:
            logs.append(run_provider_sync(provider_integration=provider, sync_type=sync_type, triggered_by=request.user))
        return Response(
            {
                "providers_synced": len(logs),
                "messages_processed": sum(log.metadata.get("messages_processed", 0) for log in logs),
                "logs": EmailSyncLogSerializer(logs, many=True).data,
            }
        )


class CRMEmailInboxAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        mailbox_filter = (request.query_params.get("filter") or "all").lower()
        search = (request.query_params.get("search") or "").strip()
        queryset = SyncedEmailMessage.objects.select_related(
            "provider_integration",
            "lead",
            "contact",
            "account",
            "deal",
            "support_case",
        ).prefetch_related("attachments")

        filter_map = {
            "incoming": Q(direction=SyncedEmailMessage.Direction.INCOMING),
            "outgoing": Q(direction=SyncedEmailMessage.Direction.OUTGOING),
            "unread": Q(is_read=False),
            "linked_to_lead": Q(lead__isnull=False),
            "linked_to_contact": Q(contact__isnull=False),
            "linked_to_deal": Q(deal__isnull=False),
            "linked_to_account": Q(account__isnull=False),
        }
        if mailbox_filter in filter_map:
            queryset = queryset.filter(filter_map[mailbox_filter])
        if search:
            queryset = queryset.filter(
                Q(subject__icontains=search)
                | Q(from_email__icontains=search)
                | Q(to_emails__icontains=search)
                | Q(cc_emails__icontains=search)
                | Q(bcc_emails__icontains=search)
            )
        queryset = queryset.order_by("-received_at", "-created_at")
        return Response(CRMEmailDetailSerializer(queryset, many=True).data)


class CRMEmailDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        queryset = SyncedEmailMessage.objects.select_related(
            "provider_integration",
            "lead",
            "contact",
            "account",
            "deal",
            "support_case",
        ).prefetch_related("attachments")
        instance = get_object_or_404(queryset, pk=pk)
        return Response(CRMEmailDetailSerializer(instance).data)

    def patch(self, request, pk):
        queryset = SyncedEmailMessage.objects.select_related(
            "provider_integration",
            "lead",
            "contact",
            "account",
            "deal",
            "support_case",
        ).prefetch_related("attachments")
        instance = get_object_or_404(queryset, pk=pk)

        updated_fields = []
        if "is_read" in request.data:
            instance.is_read = bool(request.data.get("is_read"))
            updated_fields.append("is_read")
        if "is_starred" in request.data:
            instance.is_starred = bool(request.data.get("is_starred"))
            updated_fields.append("is_starred")

        if updated_fields:
            updated_fields.append("updated_at")
            instance.save(update_fields=updated_fields)

        return Response(CRMEmailDetailSerializer(instance).data)


class CRMEmailUnreadCountAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        unread_queryset = SyncedEmailMessage.objects.filter(
            direction=SyncedEmailMessage.Direction.INCOMING,
            is_read=False,
            lead__isnull=False,
        ).exclude(
            external_message_id__regex=DEMO_EMAIL_EXTERNAL_ID_REGEX,
        )
        count = unread_queryset.count()
        recent = unread_queryset.order_by("-received_at", "-created_at").values(
            "id", "subject", "from_email", "received_at"
        )[:10]
        return Response({
            "unread_count": count,
            "recent": list(recent),
        })


class CRMEmailMarkAllReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = SyncedEmailMessage.objects.filter(
            direction=SyncedEmailMessage.Direction.INCOMING,
            is_read=False,
            lead__isnull=False,
        ).exclude(
            external_message_id__regex=DEMO_EMAIL_EXTERNAL_ID_REGEX,
        ).update(is_read=True)
        return Response({"marked_read": updated})


class CRMEmailSendAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CRMEmailSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        provider = get_object_or_404(
            visible_queryset(EmailProviderIntegration.objects.filter(is_active=True), request.user),
            pk=serializer.validated_data["provider_account_id"],
        )
        linked_records = _linked_record_kwargs(serializer.validated_data)
        try:
            message = create_outgoing_crm_email(
                provider_integration=provider,
                subject=serializer.validated_data["subject"],
                body=serializer.validated_data["body"],
                to_emails=serializer.validated_data["to"],
                cc_emails=serializer.validated_data.get("cc", []),
                bcc_emails=serializer.validated_data.get("bcc", []),
                reply_to=serializer.validated_data.get("reply_to"),
                send_live=True,
                owner=request.user,
                **linked_records,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CRMEmailDetailSerializer(message).data, status=status.HTTP_201_CREATED)


class CRMEmailRecordAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, module, record_id):
        _auto_sync_email_providers_if_stale(request)
        try:
            filters_q = _email_record_filters(module, record_id)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        queryset = SyncedEmailMessage.objects.select_related(
            "provider_integration",
            "lead",
            "contact",
            "account",
            "deal",
            "support_case",
        ).prefetch_related("attachments").filter(**filters_q).exclude(
            external_message_id__regex=DEMO_EMAIL_EXTERNAL_ID_REGEX
        )
        if module in {"lead", "leads", "contact", "contacts", "account", "accounts", "deal", "deals"}:
            queryset = queryset.filter(support_case__isnull=True)
        queryset = queryset.order_by("-received_at", "-created_at")
        return Response(CRMEmailDetailSerializer(queryset, many=True).data)


class RecordEmailListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    lookup_field = ""
    exclude_support_linked_messages = False
    exclude_notification_senders = False

    def filter_demo_messages(self, queryset):
        # Hide generated project/demo inbox messages from CRM record views so
        # users only see real synced emails for leads/contacts/accounts/deals.
        queryset = queryset.exclude(
            external_message_id__regex=DEMO_EMAIL_EXTERNAL_ID_REGEX
        )
        if self.exclude_notification_senders:
            queryset = queryset.exclude(
                from_email__iregex=r"(noreply|no-reply|donotreply|do-not-reply|notification|notifications|jobnotification|jobs2web|mailer-daemon|postmaster|jobalert|linkedin|naukri|indeed|workday|internshala|college|university|admission|scholarship)"
            )
        return queryset

    def get_base_queryset(self):
        queryset = self.filter_demo_messages(SyncedEmailMessage.objects.select_related(
            "provider_integration",
            "lead",
            "contact",
            "account",
            "deal",
            "support_case",
        ))
        if self.exclude_support_linked_messages:
            queryset = queryset.filter(support_case__isnull=True)
        return queryset

    def get_queryset(self):
        filter_key = {f"{self.lookup_field}_id": self.kwargs["pk"]}
        return self.get_base_queryset().filter(**filter_key).order_by("-received_at", "-created_at")

    def get(self, request, pk=None):
        _auto_sync_email_providers_if_stale(request)
        return Response(CRMEmailDetailSerializer(self.get_queryset(), many=True).data)


class RecordSocialListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    lookup_field = ""

    def get_queryset(self):
        return SocialMessage.objects.select_related(
            "brand",
            "social_account",
            "lead",
            "contact",
            "account",
            "deal",
            "support_case",
        ).filter(**{f"{self.lookup_field}_id": self.kwargs["pk"]}).order_by("-created_at_source", "-created_at")

    def get(self, request, pk=None):
        return Response(SocialMessageSerializer(self.get_queryset(), many=True).data)


class LeadVisitorEventListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk=None):
        lead = get_object_or_404(Lead, pk=pk)
        filters_q = Q(linked_lead=lead)
        if getattr(lead, "converted_contact", None):
            filters_q |= Q(linked_contact=lead.converted_contact)
        queryset = VisitorLeadEvent.objects.select_related("portal", "linked_lead", "linked_contact").filter(filters_q).order_by("-created_at")
        return Response(VisitorLeadEventSerializer(queryset, many=True).data)


class ContactVisitorEventListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk=None):
        queryset = VisitorLeadEvent.objects.select_related("portal", "linked_lead", "linked_contact").filter(
            linked_contact_id=pk
        ).order_by("-created_at")
        return Response(VisitorLeadEventSerializer(queryset, many=True).data)


class LeadEmailListAPIView(RecordEmailListAPIView):
    lookup_field = "lead"
    exclude_support_linked_messages = True
    # Keep notification emails visible on lead records so inbox cards match
    # the notification feed behavior.
    exclude_notification_senders = False

    def filter_demo_messages(self, queryset):
        # For lead detail pages, keep provider-linked project records visible
        # so users can still see inbox conversations while live IMAP/OAuth
        # credentials are being finalized.
        queryset = queryset.exclude(
            external_message_id__regex=r"^\d+-starter-message$"
        )
        if self.exclude_notification_senders:
            queryset = queryset.exclude(
                from_email__iregex=r"(noreply|no-reply|donotreply|do-not-reply|notification|notifications|jobnotification|jobs2web|mailer-daemon|postmaster|jobalert|linkedin|naukri|indeed|workday|internshala|college|university|admission|scholarship)"
            )
        return queryset

    def _lead_email_aliases(self, lead: Lead) -> list[str]:
        aliases: set[str] = set()
        for candidate in [
            getattr(lead, "email", None),
            getattr(lead, "secondary_email", None),
            getattr(getattr(lead, "converted_contact", None), "email", None),
            getattr(getattr(lead, "converted_contact", None), "secondary_email", None),
        ]:
            if isinstance(candidate, str):
                value = candidate.strip().lower()
                if value:
                    aliases.add(value)
        return sorted(aliases)

    def _participant_query(self, aliases: list[str]) -> Q:
        participant_q = Q()
        for email in aliases:
            participant_q |= (
                Q(from_email__iexact=email)
                | Q(to_emails__contains=[email])
                | Q(cc_emails__contains=[email])
                | Q(bcc_emails__contains=[email])
            )
        return participant_q

    def _active_provider_emails(self) -> list[str]:
        values = (
            EmailProviderIntegration.objects.filter(is_active=True)
            .values_list("email_address", flat=True)
        )
        return sorted({str(value).strip().lower() for value in values if value})

    def _provider_recipient_query(self, provider_emails: list[str]) -> Q:
        provider_q = Q()
        for email in provider_emails:
            provider_q |= (
                Q(to_emails__contains=[email])
                | Q(cc_emails__contains=[email])
                | Q(bcc_emails__contains=[email])
            )
        return provider_q

    def _provider_sender_query(self, provider_emails: list[str]) -> Q:
        sender_q = Q()
        for email in provider_emails:
            sender_q |= Q(from_email__iexact=email)
        return sender_q

    def _lead_recipient_query(self, aliases: list[str]) -> Q:
        lead_recipient_q = Q()
        for email in aliases:
            lead_recipient_q |= (
                Q(to_emails__contains=[email])
                | Q(cc_emails__contains=[email])
                | Q(bcc_emails__contains=[email])
            )
        return lead_recipient_q

    def _provider_thread_query(self, aliases: list[str], provider_emails: list[str]) -> Q:
        if not aliases or not provider_emails:
            return Q()

        provider_recipient_q = self._provider_recipient_query(provider_emails)
        provider_sender_q = self._provider_sender_query(provider_emails)
        inbound_to_provider_q = Q()
        for lead_email in aliases:
            inbound_to_provider_q |= Q(from_email__iexact=lead_email) & provider_recipient_q
        outbound_from_provider_q = provider_sender_q & self._lead_recipient_query(aliases)
        return inbound_to_provider_q | outbound_from_provider_q

    def _backfill_lead_links(self, *, lead: Lead, aliases: list[str], provider_emails: list[str]) -> None:
        provider_thread_q = self._provider_thread_query(aliases, provider_emails)
        if not provider_thread_q:
            return
        stale_ids = list(
            self.get_base_queryset()
            .filter(lead__isnull=True)
            .filter(provider_thread_q)
            .values_list("id", flat=True)[:200]
        )
        if not stale_ids:
            return

        SyncedEmailMessage.objects.filter(id__in=stale_ids).update(
            lead=lead,
            updated_at=timezone.now(),
        )

        refreshed_messages = list(
            SyncedEmailMessage.objects.filter(id__in=stale_ids).select_related(
                "lead", "contact", "account", "deal", "support_case"
            )
        )
        for message in refreshed_messages:
            upsert_email_record_link(message)

        IntegrationLeadSourceEvent.objects.filter(
            source_type=IntegrationLeadSourceEvent.SourceType.EMAIL,
            source_reference__in=[message.external_message_id for message in refreshed_messages],
        ).update(
            lead=lead,
            updated_at=timezone.now(),
        )

    def get_queryset(self):
        lead = get_object_or_404(Lead.objects.select_related("converted_contact"), pk=self.kwargs["pk"])
        aliases = self._lead_email_aliases(lead)
        provider_emails = self._active_provider_emails()
        base_queryset = self.get_base_queryset()
        if not aliases:
            return base_queryset.filter(lead_id=lead.id).order_by("-received_at", "-created_at")

        participant_q = self._participant_query(aliases)
        provider_thread_q = self._provider_thread_query(aliases, provider_emails)
        return base_queryset.filter(Q(lead_id=lead.id) | participant_q | provider_thread_q).order_by("-received_at", "-created_at")

    def get(self, request, pk=None):
        _auto_sync_email_providers_if_stale(request)
        lead = get_object_or_404(Lead.objects.select_related("converted_contact"), pk=pk)
        aliases = self._lead_email_aliases(lead)
        provider_emails = self._active_provider_emails()
        self._backfill_lead_links(lead=lead, aliases=aliases, provider_emails=provider_emails)
        return Response(CRMEmailDetailSerializer(self.get_queryset(), many=True).data)


class ContactEmailListAPIView(RecordEmailListAPIView):
    lookup_field = "contact"
    exclude_support_linked_messages = True
    exclude_notification_senders = True


class AccountEmailListAPIView(RecordEmailListAPIView):
    lookup_field = "account"
    exclude_support_linked_messages = True
    exclude_notification_senders = True


class DealEmailListAPIView(RecordEmailListAPIView):
    lookup_field = "deal"
    exclude_support_linked_messages = True
    exclude_notification_senders = True


class CaseEmailListAPIView(RecordEmailListAPIView):
    lookup_field = "support_case"


class LeadSocialListAPIView(RecordSocialListAPIView):
    lookup_field = "lead"


class ContactSocialListAPIView(RecordSocialListAPIView):
    lookup_field = "contact"


class CaseSocialListAPIView(RecordSocialListAPIView):
    lookup_field = "support_case"


class EmailSyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = EmailSyncLog.objects.select_related("provider_integration")
    serializer_class = EmailSyncLogSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["provider_integration__email_address", "sync_type", "status", "error_message"]
    ordering_fields = ["created_at", "updated_at", "last_synced_at", "status"]
    ordering = ["-created_at"]
