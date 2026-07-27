from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta, timezone as dt_timezone
import email.utils
from email import policy
from email.header import decode_header, make_header
from email.message import Message
from email.parser import BytesParser
import imaplib
import json
import logging
import os
import re
import smtplib
import ssl
from typing import Any
from urllib.parse import urlparse
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request
import uuid
from base64 import b64encode

from django.db import transaction
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from accounts.models import Account
from contacts.models import Contact
from deals.models import Deal
from leads.models import Lead
from support.models import SupportCase

from .models import (
    BCCDropboxSetting,
    BCCDropboxVerifiedAddress,
    EmailAttachment,
    EmailAuthenticationDomain,
    EmailParserInbox,
    EmailProviderIntegration,
    EmailRecordLink,
    EmailRelayServer,
    EmailSyncLog,
    IntegrationLeadSourceEvent,
    OrganizationEmailAddress,
    SocialAccount,
    SocialLeadAutomationRule,
    SocialMessage,
    SyncedEmailMessage,
    VisitorLeadEvent,
    VisitorTrackingPortal,
    VisitorTrackingSetting,
)
from .permissions import is_integration_admin
from .utils import (
    build_portal_tracking_key,
    build_tracking_code,
    generate_integration_email,
    generate_verification_code,
    make_placeholder_email,
    normalize_email,
    record_display_name,
    split_name,
)

logger = logging.getLogger(__name__)

AUTO_SYNC_STALE_SECONDS = 60
HIGH_INTENT_PATH_KEYWORDS = ("pricing", "quote", "demo", "trial", "contact", "checkout", "purchase")
COMPLAINT_KEYWORDS = ("complaint", "issue", "problem", "bug", "error", "angry", "not working", "failed")
SUPPORT_INTENT_KEYWORDS = (
    "support",
    "issue",
    "problem",
    "bug",
    "error",
    "failed",
    "not working",
    "complaint",
    "ticket",
    "case",
    "help needed",
    "unable",
    "broken",
)
SALES_INTENT_KEYWORDS = (
    "deal",
    "make a deal",
    "buy",
    "purchase",
    "pricing",
    "price",
    "quote",
    "demo",
    "interested",
    "crm software",
    "subscription",
    "plan",
    "proposal",
)
CASE_REFERENCE_PATTERNS = (r"\bCASE-\d+\b", r"\bCAS\d+\b")
REAL_SYNC_PROVIDER_TYPES = {
    EmailProviderIntegration.ProviderType.GMAIL,
    EmailProviderIntegration.ProviderType.OUTLOOK,
    EmailProviderIntegration.ProviderType.OFFICE365,
    EmailProviderIntegration.ProviderType.OTHER,
}


def _json_safe(value: Any):
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except TypeError:
            return value
    return value


def _provider_default_hosts(provider: EmailProviderIntegration) -> dict[str, Any]:
    if provider.provider_type == EmailProviderIntegration.ProviderType.GMAIL:
        return {
            "imap_host": "imap.gmail.com",
            "imap_port": 993,
            "smtp_host": "smtp.gmail.com",
            "smtp_port": 587,
            "smtp_use_tls": True,
            "smtp_use_ssl": False,
        }
    if provider.provider_type in {
        EmailProviderIntegration.ProviderType.OUTLOOK,
        EmailProviderIntegration.ProviderType.OFFICE365,
    }:
        return {
            "imap_host": "outlook.office365.com",
            "imap_port": 993,
            "smtp_host": "smtp.office365.com",
            "smtp_port": 587,
            "smtp_use_tls": True,
            "smtp_use_ssl": False,
        }
    return {
        "imap_host": provider.imap_host,
        "imap_port": provider.imap_port or 993,
        "smtp_host": provider.smtp_host,
        "smtp_port": provider.smtp_port or 587,
        "smtp_use_tls": provider.smtp_use_tls,
        "smtp_use_ssl": provider.smtp_use_ssl,
    }


def _provider_env_password(provider: EmailProviderIntegration) -> str | None:
    host_user = os.getenv("EMAIL_HOST_USER")
    host_password = os.getenv("EMAIL_HOST_PASSWORD")
    if host_user and host_password and normalize_email(host_user) == normalize_email(provider.email_address):
        return host_password

    # Provider-specific override by provider id, for example:
    # EMAIL_HOST_PASSWORD_PROVIDER_6=app_password_here
    password_by_provider_id = os.getenv(f"EMAIL_HOST_PASSWORD_PROVIDER_{provider.id}")
    if password_by_provider_id:
        return password_by_provider_id.strip()

    # Provider-specific override by email local-part, for example:
    # EMAIL_HOST_PASSWORD_MMUNI6467=app_password_here
    local_part = (normalize_email(provider.email_address) or "").split("@", 1)[0]
    if local_part:
        normalized_local_key = re.sub(r"[^A-Za-z0-9]", "_", local_part).upper()
        password_by_local_part = os.getenv(f"EMAIL_HOST_PASSWORD_{normalized_local_key}")
        if password_by_local_part:
            return password_by_local_part.strip()

    # Flexible map in .env (semicolon/comma/newline separated), for example:
    # EMAIL_PROVIDER_PASSWORDS=mmuni6467@gmail.com=pass1;vinishar2004@gmail.com=pass2
    providers_map = os.getenv("EMAIL_PROVIDER_PASSWORDS") or ""
    if providers_map.strip():
        entries = re.split(r"[;,\n]+", providers_map)
        lookup_email = normalize_email(provider.email_address)
        for entry in entries:
            if "=" not in entry:
                continue
            email_part, password_part = entry.split("=", 1)
            if normalize_email(email_part.strip()) == lookup_email and password_part.strip():
                return password_part.strip()

    return None


def _provider_has_live_secret(provider: EmailProviderIntegration) -> bool:
    return bool(provider.access_token or _provider_env_password(provider))


def _resolved_provider_config(provider: EmailProviderIntegration) -> dict[str, Any]:
    defaults = _provider_default_hosts(provider)
    return {
        "imap_host": provider.imap_host or defaults["imap_host"],
        "imap_port": provider.imap_port or defaults["imap_port"],
        "smtp_host": provider.smtp_host or defaults["smtp_host"],
        "smtp_port": provider.smtp_port or defaults["smtp_port"],
        "smtp_use_tls": provider.smtp_use_tls if provider.smtp_host else defaults["smtp_use_tls"],
        "smtp_use_ssl": provider.smtp_use_ssl if provider.smtp_host else defaults["smtp_use_ssl"],
    }


def provider_supports_real_mail_sync(provider: EmailProviderIntegration) -> bool:
    config = _resolved_provider_config(provider)
    return bool(
        provider.provider_type in REAL_SYNC_PROVIDER_TYPES
        and provider.sync_enabled
        and _provider_has_live_secret(provider)
        and config.get("imap_host")
    )


def _imap_oauth2_string(email_address: str, access_token: str) -> bytes:
    token_string = f"user={email_address}\1auth=Bearer {access_token}\1\1"
    return b64encode(token_string.encode())


def _smtp_oauth2_string(email_address: str, access_token: str) -> str:
    token_string = f"user={email_address}\1auth=Bearer {access_token}\1\1"
    return b64encode(token_string.encode()).decode()


def _decode_header_value(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _message_addresses(header_value: str | None) -> list[str]:
    if not header_value:
        return []
    return [normalize_email(addr) for _, addr in email.utils.getaddresses([header_value]) if normalize_email(addr)]


def _message_text_part(message: Message, content_type: str) -> str | None:
    if message.is_multipart():
        for part in message.walk():
            if part.get_content_type() != content_type:
                continue
            if part.get_filename():
                continue
            try:
                return part.get_content()
            except Exception:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="replace")
        return None
    if message.get_content_type() == content_type:
        try:
            return message.get_content()
        except Exception:
            payload = message.get_payload(decode=True)
            if payload:
                charset = message.get_content_charset() or "utf-8"
                return payload.decode(charset, errors="replace")
    return None


def _extract_attachments(message: Message) -> list[dict[str, Any]]:
    attachments: list[dict[str, Any]] = []
    if not message.is_multipart():
        return attachments
    for part in message.walk():
        file_name = part.get_filename()
        if not file_name:
            continue
        payload = part.get_payload(decode=True) or b""
        attachments.append(
            {
                "file_name": _decode_header_value(file_name),
                "file_type": part.get_content_type(),
                "file_size": len(payload),
                "file_url": None,
            }
        )
    return attachments


def _parse_provider_message_bytes(
    *,
    provider: EmailProviderIntegration,
    message_uid: str,
    raw_bytes: bytes,
    flags: tuple[bytes, ...] = (),
) -> dict[str, Any]:
    parsed = BytesParser(policy=policy.default).parsebytes(raw_bytes)
    provider_email = normalize_email(provider.email_address)
    from_emails = _message_addresses(parsed.get("From"))
    to_emails = _message_addresses(parsed.get("To"))
    cc_emails = _message_addresses(parsed.get("Cc"))
    bcc_emails = _message_addresses(parsed.get("Bcc"))
    primary_from = from_emails[0] if from_emails else make_placeholder_email("mail")
    all_recipients = [*to_emails, *cc_emails, *bcc_emails]
    direction = (
        SyncedEmailMessage.Direction.OUTGOING
        if provider_email and primary_from == provider_email
        else SyncedEmailMessage.Direction.INCOMING
    )
    message_id = parsed.get("Message-ID") or parsed.get("Message-Id") or f"{provider.pk}:{message_uid}"
    thread_id = parsed.get("Thread-Index") or parsed.get("References") or parsed.get("In-Reply-To") or message_uid
    parsed_date = email.utils.parsedate_to_datetime(parsed.get("Date")) if parsed.get("Date") else None
    if parsed_date and timezone.is_naive(parsed_date):
        parsed_date = timezone.make_aware(parsed_date, dt_timezone.utc)
    attachments = _extract_attachments(parsed)
    return {
        "external_message_id": message_id.strip(),
        "thread_id": str(thread_id).strip()[:255] if thread_id else None,
        "subject": _decode_header_value(parsed.get("Subject")) or "(No subject)",
        "from_email": primary_from,
        "from_name": email.utils.parseaddr(parsed.get("From") or "")[0],
        "to_emails": to_emails,
        "cc_emails": cc_emails,
        "bcc_emails": bcc_emails,
        "body_text": _message_text_part(parsed, "text/plain"),
        "body_html": _message_text_part(parsed, "text/html"),
        "direction": direction,
        "status": SyncedEmailMessage.Status.SENT if direction == SyncedEmailMessage.Direction.OUTGOING else SyncedEmailMessage.Status.RECEIVED,
        "received_at": parsed_date or timezone.now(),
        "sent_at": parsed_date if direction == SyncedEmailMessage.Direction.OUTGOING else None,
        "is_read": b"\\Seen" in flags,
        "is_starred": b"\\Flagged" in flags,
        "has_attachments": bool(attachments),
        "attachments": attachments,
        "provider_payload": {
            "message_uid": message_uid,
            "headers": {
                "from": parsed.get("From"),
                "to": parsed.get("To"),
                "cc": parsed.get("Cc"),
                "date": parsed.get("Date"),
            },
        },
    }


def _imap_login(provider: EmailProviderIntegration):
    config = _resolved_provider_config(provider)
    connection = imaplib.IMAP4_SSL(config["imap_host"], int(config["imap_port"]))
    env_password = _provider_env_password(provider)
    if provider.protocol_type == EmailProviderIntegration.ProtocolType.IMAP_OAUTH and provider.access_token:
        connection.authenticate("XOAUTH2", lambda _: _imap_oauth2_string(provider.email_address, provider.access_token))
    else:
        secret = env_password or provider.access_token
        if not secret:
            raise ValueError("No live IMAP secret configured for this provider.")
        connection.login(provider.email_address, secret)
    return connection


def _imap_mailboxes_for_sync(provider: EmailProviderIntegration) -> list[str]:
    if provider.provider_type == EmailProviderIntegration.ProviderType.GMAIL:
        return ["INBOX", "[Gmail]/Sent Mail"]
    if provider.provider_type in {
        EmailProviderIntegration.ProviderType.OUTLOOK,
        EmailProviderIntegration.ProviderType.OFFICE365,
    }:
        return ["INBOX", "Sent Items"]
    return ["INBOX"]


def _select_imap_mailbox(connection, mailbox: str) -> bool:
    candidates = [mailbox]
    if " " in mailbox or "[" in mailbox or "]" in mailbox:
        candidates.append(f'"{mailbox}"')

    for candidate in candidates:
        try:
            status, _ = connection.select(candidate)
        except imaplib.IMAP4.error:
            continue
        if status == "OK":
            return True
    return False


def fetch_imap_provider_messages(provider: EmailProviderIntegration, *, limit: int = 25) -> list[dict[str, Any]]:
    if not provider_supports_real_mail_sync(provider):
        return []

    connection = _imap_login(provider)
    try:
        criteria = "ALL"
        if provider.last_synced_at:
            criteria = f'(SINCE "{provider.last_synced_at.strftime("%d-%b-%Y")}")'
        payloads: list[dict[str, Any]] = []
        seen_external_ids: set[str] = set()

        for mailbox in _imap_mailboxes_for_sync(provider):
            if not _select_imap_mailbox(connection, mailbox):
                continue
            status, data = connection.uid("search", None, criteria)
            if status != "OK":
                continue
            message_uids = [uid.decode() for uid in (data[0] or b"").split() if uid][-limit:]
            for message_uid in reversed(message_uids):
                status, message_data = connection.uid("fetch", message_uid, "(RFC822 FLAGS)")
                if status != "OK" or not message_data:
                    continue
                raw_bytes = b""
                flags: tuple[bytes, ...] = ()
                for item in message_data:
                    if not isinstance(item, tuple):
                        continue
                    metadata, raw_candidate = item
                    if raw_candidate:
                        raw_bytes = raw_candidate
                    if b"FLAGS" in metadata:
                        flag_match = re.search(rb"FLAGS \((.*?)\)", metadata)
                        if flag_match:
                            flags = tuple(flag_match.group(1).split())
                if not raw_bytes:
                    continue
                payload = _parse_provider_message_bytes(
                    provider=provider,
                    message_uid=message_uid,
                    raw_bytes=raw_bytes,
                    flags=flags,
                )
                external_id = payload.get("external_message_id")
                if external_id in seen_external_ids:
                    continue
                seen_external_ids.add(external_id)
                payloads.append(payload)
        return payloads
    finally:
        try:
            connection.close()
        except Exception:
            pass
        connection.logout()


def _fetch_json(url: str, *, headers: dict[str, str] | None = None, method: str = "GET") -> dict[str, Any]:
    request = urllib_request.Request(url, headers=headers or {}, method=method)
    try:
        with urllib_request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        raise ValueError(f"Provider request failed with status {exc.code}.") from exc
    except urllib_error.URLError as exc:
        raise ValueError("Provider request could not be completed.") from exc


def _facebook_message_payloads(account: SocialAccount) -> list[dict[str, Any]]:
    access_token = account.access_token
    page_id = account.page_id
    if not (access_token and page_id):
        return []
    fields = "id,message,from,created_time"
    url = (
        f"https://graph.facebook.com/v19.0/{page_id}/feed?"
        + urllib_parse.urlencode({"fields": fields, "access_token": access_token, "limit": 25})
    )
    response = _fetch_json(url)
    payloads: list[dict[str, Any]] = []
    for item in response.get("data", []):
        sender = item.get("from") or {}
        payloads.append(
            {
                "platform": SocialMessage.Platform.FACEBOOK,
                "brand": account.brand,
                "social_account": account,
                "external_message_id": item.get("id"),
                "profile_handle": sender.get("id"),
                "sender_name": sender.get("name"),
                "message": item.get("message") or "Facebook activity",
                "created_at_source": item.get("created_time"),
                "payload": item,
            }
        )
    return payloads


def _resolved_social_access_token(account: SocialAccount) -> str | None:
    if account.access_token:
        return account.access_token
    if account.platform == SocialAccount.Platform.X:
        return os.getenv("X_BEARER_TOKEN") or None
    return None


def _resolved_x_handle(account: SocialAccount) -> str | None:
    env_handle = (os.getenv("X_HANDLE") or "").strip()
    if env_handle:
        return env_handle
    return (account.handle or "").strip() or None


def _x_message_payloads(account: SocialAccount) -> list[dict[str, Any]]:
    access_token = _resolved_social_access_token(account)
    handle = _resolved_x_handle(account)
    if not (access_token and handle):
        return []
    username = handle.lstrip("@")
    user_response = _fetch_json(
        f"https://api.x.com/2/users/by/username/{urllib_parse.quote(username)}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    user_id = ((user_response.get("data") or {}).get("id"))
    if not user_id:
        return []
    tweets_response = _fetch_json(
        "https://api.x.com/2/users/"
        f"{user_id}/mentions?tweet.fields=created_at,author_id,text&max_results=25",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    payloads: list[dict[str, Any]] = []
    for item in tweets_response.get("data", []):
        payloads.append(
            {
                "platform": SocialMessage.Platform.X,
                "brand": account.brand,
                "social_account": account,
                "external_message_id": item.get("id"),
                "profile_handle": f"@{username}",
                "sender_name": username,
                "message": item.get("text") or "X mention",
                "created_at_source": item.get("created_at"),
                "payload": item,
            }
        )
    return payloads


def sync_social_account(account: SocialAccount, *, triggered_by=None) -> list[SocialMessage]:
    if not account.is_connected or not _resolved_social_access_token(account):
        raise ValueError("Connect the social account with a valid access token before syncing.")

    if account.platform == SocialAccount.Platform.FACEBOOK:
        payloads = _facebook_message_payloads(account)
    elif account.platform == SocialAccount.Platform.X:
        payloads = _x_message_payloads(account)
    else:
        payloads = []

    messages = [ingest_social_message(payload=payload, user=triggered_by) for payload in payloads]
    account.last_synced_at = timezone.now()
    account.save(update_fields=["last_synced_at", "updated_at"])
    return messages


def _portal_allowed_hosts(portal: VisitorTrackingPortal) -> set[str]:
    parsed = urlparse(portal.portal_url)
    host = (parsed.netloc or parsed.path or "").lower().strip()
    if host.startswith("www."):
        host = host[4:]
    return {host} if host else set()


def validate_visitor_event_origin(*, portal: VisitorTrackingPortal, payload: dict[str, Any]) -> None:
    allowed_hosts = _portal_allowed_hosts(portal)
    if not allowed_hosts:
        return
    raw_value = payload.get("page_url")
    if not raw_value:
        return
    candidate = urlparse(raw_value)
    host = (candidate.netloc or "").lower().strip()
    if host.startswith("www."):
        host = host[4:]
    if host and host not in allowed_hosts:
        raise ValueError("Visitor event origin does not match the configured portal domain.")


@dataclass
class MatchedCRMRecord:
    lead: Lead | None = None
    contact: Contact | None = None
    account: Account | None = None
    deal: Deal | None = None
    support_case: SupportCase | None = None


def _has_crm_match(match: MatchedCRMRecord) -> bool:
    return bool(match.lead or match.contact or match.account or match.deal or match.support_case)


def _merge_crm_matches(primary: MatchedCRMRecord, secondary: MatchedCRMRecord | None = None) -> MatchedCRMRecord:
    secondary = secondary or MatchedCRMRecord()
    return MatchedCRMRecord(
        lead=primary.lead or secondary.lead,
        contact=primary.contact or secondary.contact,
        account=primary.account or secondary.account,
        deal=primary.deal or secondary.deal,
        support_case=primary.support_case or secondary.support_case,
    )


def _reference_text_from_payload(payload: dict[str, Any]) -> str:
    return " ".join(
        [
            payload.get("subject") or "",
            payload.get("body_text") or "",
            payload.get("body_html") or "",
        ]
    ).strip()


def _strip_support_case(match: MatchedCRMRecord) -> MatchedCRMRecord:
    return MatchedCRMRecord(
        lead=match.lead,
        contact=match.contact,
        account=match.account,
        deal=match.deal,
        support_case=None,
    )


def classify_email_intent(*, subject: str | None, body_text: str | None, body_html: str | None) -> str:
    content = " ".join(filter(None, [subject, body_text, body_html])).lower()
    if not content:
        return "general"
    if any(keyword in content for keyword in SUPPORT_INTENT_KEYWORDS):
        return "support"
    if any(keyword in content for keyword in SALES_INTENT_KEYWORDS):
        return "sales"
    return "general"


def _support_case_is_open(case: SupportCase | None) -> bool:
    if not case or not case.is_active:
        return False
    status = (case.status or "").strip().lower()
    if not status:
        return True
    closed_markers = ("closed", "resolved", "completed", "done", "cancelled", "canceled")
    return all(marker not in status for marker in closed_markers)


def _preferred_support_case_for_match(match: MatchedCRMRecord) -> SupportCase | None:
    candidates: list[SupportCase] = []
    if match.support_case:
        candidates.append(match.support_case)
    if match.contact:
        candidates.extend(match.contact.support_cases.filter(is_active=True).order_by("-updated_at")[:5])
    if match.account:
        candidates.extend(match.account.support_cases.filter(is_active=True).order_by("-updated_at")[:5])
    if match.deal:
        candidates.extend(match.deal.support_cases.filter(is_active=True).order_by("-updated_at")[:5])
    for candidate in candidates:
        if _support_case_is_open(candidate):
            return candidate
    return next((candidate for candidate in candidates if candidate), None)


def _preferred_active_deal_for_match(match: MatchedCRMRecord) -> Deal | None:
    candidates: list[Deal] = []
    if match.deal and match.deal.is_active:
        candidates.append(match.deal)
    if match.contact:
        candidates.extend(match.contact.deals.filter(is_active=True).order_by("-updated_at")[:5])
    if match.lead:
        candidates.extend(match.lead.deals.filter(is_active=True).order_by("-updated_at")[:5])
        if match.lead.converted_deal:
            candidates.append(match.lead.converted_deal)
    if not (match.contact or match.lead) and match.account:
        account_deals = list(match.account.deals.filter(is_active=True).order_by("-updated_at")[:2])
        if len(account_deals) == 1:
            candidates.extend(account_deals)
    for candidate in candidates:
        if candidate and candidate.is_active and not candidate.is_closed:
            return candidate
    return next((candidate for candidate in candidates if candidate and candidate.is_active), None)


def _match_crm_records_by_thread(thread_id: str | None, *, external_message_id: str | None = None) -> MatchedCRMRecord:
    normalized_thread_id = (thread_id or "").strip()
    if not normalized_thread_id:
        return MatchedCRMRecord()
    messages = SyncedEmailMessage.objects.filter(thread_id=normalized_thread_id)
    if external_message_id:
        messages = messages.exclude(external_message_id=external_message_id)
    message = (
        messages.exclude(
            lead__isnull=True,
            contact__isnull=True,
            account__isnull=True,
            deal__isnull=True,
            support_case__isnull=True,
        )
        .select_related("lead", "contact", "account", "deal", "support_case")
        .order_by("-received_at", "-updated_at")
        .first()
    )
    if not message:
        return MatchedCRMRecord()
    return MatchedCRMRecord(
        lead=message.lead,
        contact=message.contact,
        account=message.account,
        deal=message.deal,
        support_case=message.support_case,
    )


def _extract_domain(email: str | None) -> str | None:
    normalized_email = normalize_email(email)
    if not normalized_email or "@" not in normalized_email:
        return None
    return normalized_email.split("@", 1)[1]


def _account_domain_candidates(account: Account) -> set[str]:
    candidates: set[str] = set()
    for value in (account.website, account.account_site):
        if not value:
            continue
        parsed = urlparse(value if "://" in value else f"https://{value}")
        domain = (parsed.netloc or parsed.path or "").lower().strip()
        if domain.startswith("www."):
            domain = domain[4:]
        if domain:
            candidates.add(domain)
    return candidates


def match_crm_records_by_domain(domain: str | None) -> MatchedCRMRecord:
    if not domain:
        return MatchedCRMRecord()
    normalized_domain = domain.lower().strip()
    for account in Account.objects.filter(is_active=True):
        if normalized_domain in _account_domain_candidates(account):
            contact = account.contacts.filter(is_active=True).order_by("-updated_at").first()
            deal = account.deals.filter(is_active=True).order_by("-updated_at").first()
            support_case = account.support_cases.filter(is_active=True).order_by("-updated_at").first()
            return MatchedCRMRecord(contact=contact, account=account, deal=deal, support_case=support_case)
    return MatchedCRMRecord()


def match_crm_records_by_phone(phone: str | None) -> MatchedCRMRecord:
    normalized_phone = (phone or "").strip()
    if not normalized_phone:
        return MatchedCRMRecord()
    contact = Contact.objects.select_related("account").filter(
        Q(phone__iexact=normalized_phone) | Q(mobile__iexact=normalized_phone),
        is_active=True,
    ).first()
    if contact:
        deal = contact.deals.filter(is_active=True).order_by("-updated_at").first()
        support_case = contact.support_cases.filter(is_active=True).order_by("-updated_at").first()
        return MatchedCRMRecord(contact=contact, account=contact.account, deal=deal, support_case=support_case)
    lead = Lead.objects.filter(Q(phone__iexact=normalized_phone) | Q(mobile__iexact=normalized_phone)).first()
    if lead:
        return MatchedCRMRecord(
            lead=lead,
            contact=lead.converted_contact,
            account=lead.converted_account,
            deal=lead.converted_deal,
        )
    return MatchedCRMRecord()


def match_crm_records_by_reference(text: str | None) -> MatchedCRMRecord:
    haystack = (text or "").strip()
    if not haystack:
        return MatchedCRMRecord()
    case_numbers: list[str] = []
    for pattern in CASE_REFERENCE_PATTERNS:
        case_numbers.extend(re.findall(pattern, haystack, flags=re.IGNORECASE))
    normalized_case_numbers = [case_number.upper() for case_number in case_numbers]

    support_case = None
    if normalized_case_numbers:
        support_case = (
            SupportCase.objects.filter(case_number__iregex=r"^(CASE-\d+|CAS\d+)$")
            .filter(Q(case_number__in=normalized_case_numbers) | Q(case_number__in=case_numbers))
            .select_related("related_contact", "account", "deal")
            .order_by("-updated_at")
            .first()
        )
    if support_case:
        return MatchedCRMRecord(
            contact=support_case.related_contact,
            account=support_case.account,
            deal=support_case.deal,
            support_case=support_case,
        )

    explicit_deal_ids = {
        int(value)
        for value in re.findall(r"\b(?:deal[\s:#-]*|opportunity[\s:#-]*)(\d+)\b", haystack, flags=re.IGNORECASE)
    }
    if explicit_deal_ids:
        deal = (
            Deal.objects.filter(id__in=explicit_deal_ids)
            .select_related("account", "contact")
            .order_by("-updated_at")
            .first()
        )
        if deal:
            return MatchedCRMRecord(contact=deal.contact, account=deal.account, deal=deal)
    return MatchedCRMRecord()


def match_crm_records(*, email: str | None = None, phone: str | None = None, text: str | None = None) -> MatchedCRMRecord:
    for candidate in (
        match_crm_records_by_email(email),
        match_crm_records_by_phone(phone),
        match_crm_records_by_domain(_extract_domain(email)),
        match_crm_records_by_reference(text),
    ):
        if candidate.lead or candidate.contact or candidate.account or candidate.deal or candidate.support_case:
            return candidate
    return MatchedCRMRecord()


def visible_queryset(queryset, user, owner_field: str | None = "created_by"):
    if is_integration_admin(user) or owner_field is None:
        return queryset
    if owner_field == "user":
        return queryset.filter(user=user)
    return queryset.filter(**{owner_field: user})


def auto_sync_visible_email_providers(user, *, max_age_seconds: int = AUTO_SYNC_STALE_SECONDS) -> None:
    if not user or not getattr(user, "is_authenticated", False):
        return
    threshold = timezone.now() - timedelta(seconds=max_age_seconds)
    providers = visible_queryset(
        EmailProviderIntegration.objects.filter(
            is_active=True,
            sync_enabled=True,
            crm_sync_enabled=True,
        ),
        user,
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
                triggered_by=user,
            )
        except Exception:
            continue


def get_or_create_placeholder_lead(*, email: str | None, name: str | None, company: str | None, owner=None) -> Lead:
    normalized_email = normalize_email(email) or make_placeholder_email("lead")
    existing = Lead.objects.filter(email__iexact=normalized_email).first()
    if existing:
        return existing
    first_name, last_name = split_name(name, fallback_first="New")
    return Lead.objects.create(
        first_name=first_name,
        last_name=last_name,
        company=(company or "Unassigned").strip() or "Unassigned",
        email=normalized_email,
        owner=owner,
        lead_source="Integration",
        lead_status="New",
    )


def get_or_create_contact_from_event(*, email: str | None, name: str | None, owner=None, account=None) -> Contact:
    normalized_email = normalize_email(email)
    if normalized_email:
        existing = Contact.objects.filter(email__iexact=normalized_email, is_active=True).first()
        if existing:
            return existing
    first_name, last_name = split_name(name, fallback_first="Visitor")
    return Contact.objects.create(
        first_name=first_name,
        last_name=last_name,
        email=normalized_email,
        contact_owner=owner,
        account=account,
    )


def match_crm_records_by_email(email: str | None) -> MatchedCRMRecord:
    normalized_email = normalize_email(email)
    if not normalized_email:
        return MatchedCRMRecord()

    support_case_by_email = (
        SupportCase.objects.filter(email__iexact=normalized_email, is_active=True)
        .select_related("related_contact", "account", "deal")
        .order_by("-updated_at")
        .first()
    )

    contact = (
        Contact.objects.select_related("account")
        .filter(
            Q(email__iexact=normalized_email) | Q(secondary_email__iexact=normalized_email),
            is_active=True,
        )
        .first()
    )

    lead = (
        Lead.objects.filter(
            Q(email__iexact=normalized_email) | Q(secondary_email__iexact=normalized_email)
        )
        .select_related("converted_account", "converted_contact", "converted_deal")
        .first()
    )

    if contact or lead:
        deal = None
        support_case = None
        account = None

        if contact:
            deal = contact.deals.filter(is_active=True).order_by("-updated_at").first()
            support_case = contact.support_cases.filter(is_active=True).order_by("-updated_at").first()
            account = contact.account

        if lead:
            if not support_case and lead.converted_contact:
                support_case = lead.converted_contact.support_cases.filter(is_active=True).order_by("-updated_at").first()
            account = account or lead.converted_account
            deal = deal or lead.converted_deal

        return MatchedCRMRecord(
            lead=lead,
            contact=contact or getattr(lead, "converted_contact", None),
            account=account,
            deal=deal,
            support_case=support_case or support_case_by_email,
        )

    if support_case_by_email:
        return MatchedCRMRecord(
            contact=support_case_by_email.related_contact,
            account=support_case_by_email.account,
            deal=support_case_by_email.deal,
            support_case=support_case_by_email,
        )

    return MatchedCRMRecord()


def is_notification_sender(email: str | None) -> bool:
    normalized_email = normalize_email(email)
    if not normalized_email or "@" not in normalized_email:
        return False
    local_part, domain = normalized_email.split("@", 1)
    markers = (
        "noreply",
        "no-reply",
        "donotreply",
        "do-not-reply",
        "notification",
        "notifications",
        "jobnotification",
        "jobs2web",
        "mailer-daemon",
        "postmaster",
        "jobalert",
        "jobalert",
        "linkedin",
        "naukri",
        "indeed",
        "workday",
        "adobe",
        "nvidia",
        "nobroker",
        "techgig",
        "dare2compete",
    )
    haystack = f"{local_part} {domain}".lower()
    return any(marker in haystack for marker in markers)


def is_junk_lead_candidate(
    *,
    from_email: str | None,
    from_name: str | None,
    subject: str | None,
    body_text: str | None,
    body_html: str | None,
) -> bool:
    if is_notification_sender(from_email):
        return True

    content = " ".join(
        filter(
            None,
            [
                from_name,
                subject,
                body_text,
                body_html,
            ],
        )
    ).lower()
    if not content:
        return False

    junk_markers = (
        "job alert",
        "job opening",
        "job openings",
        "hiring now",
        "internship",
        "internships",
        "internshala",
        "study abroad",
        "scholarship",
        "admission",
        "admissions",
        "campus placement",
        "newsletter",
        "unsubscribe",
        "view web version",
        "view in browser",
        "daily digest",
        "weekly digest",
        "top mncs",
        "naukri",
        "indeed",
        "workday",
        "dare2compete",
    )
    return any(marker in content for marker in junk_markers)


def should_skip_incoming_email_payload(payload: dict[str, Any]) -> bool:
    direction = payload.get("direction") or SyncedEmailMessage.Direction.INCOMING
    if direction != SyncedEmailMessage.Direction.INCOMING:
        return False
    # Always keep mail from already-known CRM people, even if the subject/body
    # contains generic keywords (e.g. "career growth", "study plan").
    sender_match = match_crm_records_by_email(payload.get("from_email"))
    if _has_crm_match(sender_match):
        return False
    return is_junk_lead_candidate(
        from_email=payload.get("from_email"),
        from_name=payload.get("from_name"),
        subject=payload.get("subject"),
        body_text=payload.get("body_text"),
        body_html=payload.get("body_html"),
    )


def is_internal_sender(email: str | None) -> bool:
    normalized_email = normalize_email(email)
    if not normalized_email:
        return False

    if EmailProviderIntegration.objects.filter(email_address__iexact=normalized_email, is_active=True).exists():
        return True
    if OrganizationEmailAddress.objects.filter(email_address__iexact=normalized_email, is_active=True).exists():
        return True
    return get_user_model().objects.filter(email__iexact=normalized_email, is_active=True).exists()


def is_relevant_outside_mail(payload: dict[str, Any]) -> bool:
    intent = classify_email_intent(
        subject=payload.get("subject"),
        body_text=payload.get("body_text"),
        body_html=payload.get("body_html"),
    )
    if intent in {"sales", "support"}:
        return True

    content = " ".join(
        filter(
            None,
            [
                payload.get("from_name"),
                payload.get("subject"),
                payload.get("body_text"),
                payload.get("body_html"),
            ],
        )
    ).lower()
    if not content:
        return False

    business_markers = (
        "lead",
        "crm",
        "software",
        "license",
        "licenses",
        "subscription",
        "renewal",
        "proposal",
        "quotation",
        "quote",
        "pricing",
        "demo",
        "implementation",
        "onboarding",
    )
    return any(marker in content for marker in business_markers)


def should_auto_create_placeholder_lead(payload: dict[str, Any]) -> bool:
    if (payload.get("direction") or SyncedEmailMessage.Direction.INCOMING) != SyncedEmailMessage.Direction.INCOMING:
        return False

    if is_internal_sender(payload.get("from_email")):
        return False

    if is_junk_lead_candidate(
        from_email=payload.get("from_email"),
        from_name=payload.get("from_name"),
        subject=payload.get("subject"),
        body_text=payload.get("body_text"),
        body_html=payload.get("body_html"),
    ):
        return False

    return is_relevant_outside_mail(payload)


def match_message_to_lead(message: dict[str, Any]) -> Lead | None:
    for candidate in [message.get("from_email"), *(message.get("to_emails") or [])]:
        match = match_crm_records_by_email(candidate)
        if match.lead:
            return match.lead
    return None


def get_lead_emails(lead_id: int):
    return SyncedEmailMessage.objects.filter(lead_id=lead_id).select_related("provider_integration").order_by("-received_at", "-created_at")


def get_lead_connected_records(lead_id: int):
    return IntegrationLeadSourceEvent.objects.filter(lead_id=lead_id).exclude(
        source_type=IntegrationLeadSourceEvent.SourceType.EMAIL
    ).select_related(
        "lead",
        "contact",
        "account",
        "deal",
        "support_case",
    ).order_by("-created_at")


def get_user_default_email_provider(user) -> EmailProviderIntegration | None:
    base_queryset = EmailProviderIntegration.objects.filter(
        is_active=True,
        crm_sync_enabled=True,
        created_by=user,
    )
    return (
        base_queryset.filter(is_default_from=True).first()
        or base_queryset.order_by("-updated_at", "-created_at").first()
    )


def send_provider_email_live(
    *,
    provider_integration: EmailProviderIntegration,
    subject: str,
    body: str,
    to_emails: list[str],
    cc_emails: list[str] | None = None,
    bcc_emails: list[str] | None = None,
    reply_to: str | None = None,
) -> None:
    if not provider_integration.is_active:
        raise ValueError("Only an active provider can send email.")

    config = _resolved_provider_config(provider_integration)
    smtp_host = config.get("smtp_host")
    live_secret = provider_integration.access_token or _provider_env_password(provider_integration)
    if not smtp_host or not live_secret:
        raise ValueError("This provider is missing live sending credentials.")

    recipients = [*(to_emails or []), *(cc_emails or []), *(bcc_emails or [])]
    if not recipients:
        raise ValueError("At least one recipient email is required.")

    mime_lines = [
        f"From: {provider_integration.display_name or provider_integration.email_address} <{provider_integration.email_address}>",
        f"To: {', '.join(to_emails)}",
        f"Subject: {subject or '(No subject)'}",
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        f"Date: {email.utils.formatdate(localtime=True)}",
    ]
    if cc_emails:
        mime_lines.append(f"Cc: {', '.join(cc_emails)}")
    if reply_to or provider_integration.reply_to_address:
        mime_lines.append(f"Reply-To: {reply_to or provider_integration.reply_to_address}")
    mime_message = "\r\n".join([*mime_lines, "", body])

    smtp_port = int(config["smtp_port"])
    if config.get("smtp_use_ssl"):
        smtp = smtplib.SMTP_SSL(smtp_host, smtp_port, context=ssl.create_default_context(), timeout=20)
    else:
        smtp = smtplib.SMTP(smtp_host, smtp_port, timeout=20)
    try:
        smtp.ehlo()
        if config.get("smtp_use_tls"):
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        if provider_integration.protocol_type == EmailProviderIntegration.ProtocolType.IMAP_OAUTH and provider_integration.access_token:
            auth_string = _smtp_oauth2_string(provider_integration.email_address, provider_integration.access_token)
            code, response = smtp.docmd("AUTH", "XOAUTH2 " + auth_string)
            if code not in (235, 250):
                raise ValueError(f"SMTP OAuth authentication failed: {response!r}")
        else:
            smtp.login(provider_integration.email_address, live_secret)
        smtp.sendmail(provider_integration.email_address, recipients, mime_message.encode("utf-8"))
    finally:
        try:
            smtp.quit()
        except Exception:
            pass


@transaction.atomic
def create_outgoing_crm_email(
    *,
    provider_integration: EmailProviderIntegration,
    subject: str,
    body: str,
    to_emails: list[str],
    cc_emails: list[str] | None = None,
    bcc_emails: list[str] | None = None,
    reply_to: str | None = None,
    send_live: bool = False,
    owner=None,
    lead: Lead | None = None,
    contact: Contact | None = None,
    account: Account | None = None,
    deal: Deal | None = None,
    support_case: SupportCase | None = None,
    thread_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> SyncedEmailMessage:
    now = timezone.now()
    cleaned_to_emails = [normalize_email(email) for email in to_emails if normalize_email(email)]
    if not cleaned_to_emails:
        raise ValueError("At least one recipient email is required.")
    cleaned_cc_emails = [normalize_email(email) for email in (cc_emails or []) if normalize_email(email)]
    cleaned_bcc_emails = [normalize_email(email) for email in (bcc_emails or []) if normalize_email(email)]

    if send_live:
        send_provider_email_live(
            provider_integration=provider_integration,
            subject=subject,
            body=body,
            to_emails=cleaned_to_emails,
            cc_emails=cleaned_cc_emails,
            bcc_emails=cleaned_bcc_emails,
            reply_to=reply_to,
        )

    message = SyncedEmailMessage.objects.create(
        provider_integration=provider_integration,
        external_message_id=f"outgoing-{provider_integration.pk}-{uuid.uuid4().hex}",
        thread_id=thread_id,
        subject=subject or "(No subject)",
        from_email=normalize_email(provider_integration.email_address) or make_placeholder_email("mail"),
        to_emails=cleaned_to_emails,
        cc_emails=cleaned_cc_emails,
        bcc_emails=cleaned_bcc_emails,
        body_text=body,
        body_html=body,
        direction=SyncedEmailMessage.Direction.OUTGOING,
        status=SyncedEmailMessage.Status.SENT,
        received_at=now,
        sent_at=now,
        is_read=True,
        is_starred=False,
        has_attachments=False,
        lead=lead,
        contact=contact,
        account=account,
        deal=deal,
        support_case=support_case,
    )
    upsert_email_record_link(message)
    create_source_event(
        source_type=IntegrationLeadSourceEvent.SourceType.EMAIL,
        source_reference=message.external_message_id,
        payload={
            "subject": subject,
            "body_text": body,
            "direction": SyncedEmailMessage.Direction.OUTGOING,
            "status": SyncedEmailMessage.Status.SENT,
            "sent_at": now,
            "from_email": provider_integration.email_address,
            "to_emails": cleaned_to_emails,
            "cc_emails": cleaned_cc_emails,
            "bcc_emails": cleaned_bcc_emails,
            "reply_to": reply_to or provider_integration.reply_to_address,
            "sent_live": send_live,
            "provider_id": provider_integration.pk,
            "provider_email": provider_integration.email_address,
            **(metadata or {}),
        },
        status="processed",
        lead=lead,
        contact=contact,
        account=account,
        deal=deal,
        support_case=support_case,
    )
    return message


def create_source_event(
    *,
    source_type: str,
    source_reference: str,
    payload: dict[str, Any],
    status: str,
    lead: Lead | None = None,
    contact: Contact | None = None,
    account: Account | None = None,
    deal: Deal | None = None,
    support_case: SupportCase | None = None,
) -> IntegrationLeadSourceEvent:
    return IntegrationLeadSourceEvent.objects.create(
        source_type=source_type,
        source_reference=source_reference,
        payload=_json_safe(payload),
        status=status,
        lead=lead,
        contact=contact,
        account=account,
        deal=deal,
        support_case=support_case,
    )


def generate_parser_address(parser_name: str) -> str:
    slug = "-".join((parser_name or "parser").strip().lower().split()) or "parser"
    return generate_integration_email(slug)


def generate_bcc_address() -> str:
    return generate_integration_email("bcc")


def validate_relay_configuration(data: dict[str, Any]) -> None:
    port = data.get("port")
    if port and int(port) <= 0:
        raise ValueError("Relay port must be a positive integer.")
    if data.get("authentication_required") and not data.get("username"):
        raise ValueError("Username is required when relay authentication is enabled.")


def confirm_organization_email(instance) -> None:
    instance.confirmation_status = instance.ConfirmationStatus.CONFIRMED
    instance.is_verified = True
    instance.verified_at = timezone.now()
    instance.save(update_fields=["confirmation_status", "is_verified", "verified_at", "updated_at"])


def regenerate_bcc_dropbox(setting: BCCDropboxSetting) -> BCCDropboxSetting:
    setting.dropbox_email_address = generate_bcc_address()
    setting.save(update_fields=["dropbox_email_address", "updated_at"])
    return setting


def add_verified_bcc_address(*, setting: BCCDropboxSetting, email_address: str) -> BCCDropboxVerifiedAddress:
    address, _ = BCCDropboxVerifiedAddress.objects.update_or_create(
        bcc_setting=setting,
        email_address=normalize_email(email_address),
        defaults={
            "verification_status": BCCDropboxVerifiedAddress.VerificationStatus.PENDING,
            "verification_code": generate_verification_code(),
            "verified_at": None,
        },
    )
    return address


def verify_bcc_address(*, setting: BCCDropboxSetting, email_address: str, verification_code: str) -> BCCDropboxVerifiedAddress:
    address = BCCDropboxVerifiedAddress.objects.get(
        bcc_setting=setting,
        email_address=normalize_email(email_address),
    )
    if address.verification_code != verification_code:
        raise ValueError("Verification code is invalid.")
    address.verification_status = BCCDropboxVerifiedAddress.VerificationStatus.VERIFIED
    address.verified_at = timezone.now()
    address.save(update_fields=["verification_status", "verified_at", "updated_at"])
    return address


def check_domain_status(domain: EmailAuthenticationDomain) -> EmailAuthenticationDomain:
    domain.authentication_status = EmailAuthenticationDomain.AuthenticationStatus.AUTHENTICATED
    domain.spf_status = "configured"
    domain.dkim_status = "configured"
    domain.dmarc_status = "configured"
    domain.email_status = "ready"
    domain.is_verified = True
    domain.last_checked_at = timezone.now()
    domain.save()
    return domain


def connect_social_account(account: SocialAccount, token_payload: dict[str, Any]) -> SocialAccount:
    account.is_connected = True
    account.connected_at = timezone.now()
    account.access_token = token_payload.get("access_token") or account.access_token
    account.refresh_token = token_payload.get("refresh_token") or account.refresh_token
    account.account_name = token_payload.get("account_name") or account.account_name
    account.handle = token_payload.get("handle") or account.handle
    account.page_id = token_payload.get("page_id") or account.page_id
    account.save()
    return account


def disconnect_social_account(account: SocialAccount) -> SocialAccount:
    account.is_connected = False
    account.connected_at = None
    account.save(update_fields=["is_connected", "connected_at", "updated_at"])
    return account


def ensure_portal_tracking_code(portal: VisitorTrackingPortal, *, app_name: str, defaults: dict[str, Any] | None = None):
    tracking_code = build_tracking_code(portal.id or 0, portal.portal_name)
    setting, created = VisitorTrackingSetting.objects.get_or_create(
        portal=portal,
        defaults={
            "app_name": app_name,
            "tracking_code": tracking_code,
            **(defaults or {}),
        },
    )
    if not created and setting.tracking_code != tracking_code:
        setting.tracking_code = tracking_code
        setting.app_name = app_name or setting.app_name
        setting.save(update_fields=["tracking_code", "app_name", "updated_at"])
    return setting


def resolve_visitor_portal_by_tracking_key(tracking_key: str) -> VisitorTrackingPortal | None:
    normalized_key = (tracking_key or "").strip()
    if not normalized_key:
        return None

    for portal in VisitorTrackingPortal.objects.filter(is_active=True):
        if build_portal_tracking_key(portal.id, portal.portal_name) == normalized_key:
            return portal
    return None


def _match_synced_email_records(payload: dict[str, Any]) -> MatchedCRMRecord:
    direction = payload.get("direction") or SyncedEmailMessage.Direction.INCOMING
    reference_text = _reference_text_from_payload(payload)

    thread_match = _match_crm_records_by_thread(
        payload.get("thread_id"),
        external_message_id=payload.get("external_message_id"),
    )
    if _has_crm_match(thread_match):
        return thread_match

    reference_match = match_crm_records_by_reference(reference_text)
    if _has_crm_match(reference_match):
        return reference_match

    base_match = MatchedCRMRecord()
    if direction == SyncedEmailMessage.Direction.INCOMING:
        base_match = match_crm_records_by_email(payload.get("from_email"))
        if not _has_crm_match(base_match) and is_notification_sender(payload.get("from_email")):
            return MatchedCRMRecord()
    else:
        for email in [*(payload.get("to_emails") or []), *(payload.get("cc_emails") or [])]:
            recipient_match = match_crm_records_by_email(email)
            if _has_crm_match(recipient_match):
                base_match = recipient_match
                break

    if not _has_crm_match(base_match):
        return MatchedCRMRecord()

    intent = classify_email_intent(
        subject=payload.get("subject"),
        body_text=payload.get("body_text"),
        body_html=payload.get("body_html"),
    )

    if intent == "support":
        support_case = _preferred_support_case_for_match(base_match)
        if support_case:
            return MatchedCRMRecord(
                lead=base_match.lead,
                contact=base_match.contact or support_case.related_contact,
                account=base_match.account or support_case.account,
                deal=base_match.deal or support_case.deal,
                support_case=support_case,
            )
        return base_match

    if intent == "sales":
        deal = _preferred_active_deal_for_match(base_match)
        if deal:
            return _strip_support_case(MatchedCRMRecord(
                lead=base_match.lead or deal.lead,
                contact=base_match.contact or deal.contact,
                account=base_match.account or deal.account,
                deal=deal,
            ))
        return _strip_support_case(MatchedCRMRecord(
            lead=base_match.lead,
            contact=base_match.contact,
            account=base_match.account,
            deal=base_match.deal,
        ))

    # Keep ambiguous inbound mail on the sales-side records unless the
    # message clearly indicates support intent or has an existing case thread/reference.
    if base_match.lead or base_match.contact or base_match.account or base_match.deal:
        return _strip_support_case(base_match)

    return base_match


def _expand_related_crm_records(match: MatchedCRMRecord) -> MatchedCRMRecord:
    lead = match.lead
    contact = match.contact
    account = match.account
    deal = match.deal
    support_case = match.support_case

    if lead:
        contact = contact or lead.converted_contact
        account = account or lead.converted_account
        deal = deal or lead.converted_deal

    if contact:
        account = account or getattr(contact, "account", None)
        lead = lead or getattr(contact, "created_from_lead", None)
        if lead:
            account = account or lead.converted_account
            deal = deal or lead.converted_deal

    if support_case:
        contact = contact or support_case.related_contact
        account = account or support_case.account
        deal = deal or support_case.deal

    return MatchedCRMRecord(
        lead=lead,
        contact=contact,
        account=account,
        deal=deal,
        support_case=support_case,
    )


def save_synced_message(
    *,
    provider_integration: EmailProviderIntegration,
    payload: dict[str, Any],
    owner=None,
) -> SyncedEmailMessage:
    return create_synced_email_message(
        provider_integration=provider_integration,
        payload=payload,
        owner=owner,
    )


def upsert_email_record_link(message: SyncedEmailMessage) -> EmailRecordLink:
    db_alias = message._state.db or "default"
    return EmailRecordLink.objects.using(db_alias).update_or_create(
        email_message=message,
        defaults={
            "lead": message.lead,
            "contact": message.contact,
            "account": message.account,
            "deal": message.deal,
            "support_case": message.support_case,
        },
    )[0]


def save_email_attachments(*, message: SyncedEmailMessage, attachments: list[dict[str, Any]] | None) -> None:
    if attachments is None:
        return
    message.attachments.all().delete()
    EmailAttachment.objects.bulk_create(
        [
            EmailAttachment(
                email_message=message,
                file_name=attachment.get("file_name") or "attachment",
                file_type=attachment.get("file_type"),
                file_size=int(attachment.get("file_size") or 0),
                file_url=attachment.get("file_url"),
            )
            for attachment in attachments
        ]
    )


@transaction.atomic
def create_synced_email_message(
    *,
    provider_integration: EmailProviderIntegration,
    payload: dict[str, Any],
    owner=None,
) -> SyncedEmailMessage:
    match = _expand_related_crm_records(_match_synced_email_records(payload))
    if not _has_crm_match(match) and should_auto_create_placeholder_lead(payload):
        placeholder_lead = get_or_create_placeholder_lead(
            email=payload.get("from_email"),
            name=payload.get("from_name") or payload.get("subject"),
            company=payload.get("company") or "Email Inbox",
            owner=owner or getattr(provider_integration, "user", None),
        )
        match = MatchedCRMRecord(lead=placeholder_lead)
    existing_message = SyncedEmailMessage.objects.filter(
        provider_integration=provider_integration,
        external_message_id=payload["external_message_id"],
    ).first()
    incoming_direction = payload.get("direction") or SyncedEmailMessage.Direction.INCOMING
    incoming_is_read = bool(payload.get("is_read", False))
    # New inbound messages should show up in CRM notifications even if the
    # provider mailbox already marks them as seen. We still preserve existing
    # read state for messages already synced earlier.
    is_read_value = (
        bool(getattr(existing_message, "is_read", False))
        if existing_message
        else (False if incoming_direction == SyncedEmailMessage.Direction.INCOMING else incoming_is_read)
    )
    logger.info(
        "Saving synced email for provider=%s external_message_id=%s matched_lead=%s",
        provider_integration.pk,
        payload["external_message_id"],
        getattr(match.lead, "pk", None),
    )
    message, _ = SyncedEmailMessage.objects.update_or_create(
        provider_integration=provider_integration,
        external_message_id=payload["external_message_id"],
        defaults={
            "thread_id": payload.get("thread_id"),
            "subject": payload.get("subject") or "(No subject)",
            "from_email": normalize_email(payload.get("from_email")) or make_placeholder_email("mail"),
            "to_emails": [normalize_email(email) for email in payload.get("to_emails", []) if normalize_email(email)],
            "cc_emails": [normalize_email(email) for email in payload.get("cc_emails", []) if normalize_email(email)],
            "bcc_emails": [normalize_email(email) for email in payload.get("bcc_emails", []) if normalize_email(email)],
            "body_text": payload.get("body_text"),
            "body_html": payload.get("body_html"),
            "direction": incoming_direction,
            "status": payload.get("status") or SyncedEmailMessage.Status.RECEIVED,
            "received_at": payload.get("received_at") or timezone.now(),
            "sent_at": payload.get("sent_at"),
            "is_read": is_read_value,
            "is_starred": bool(payload.get("is_starred", False)),
            "has_attachments": bool(payload.get("has_attachments", False)),
            "lead": match.lead,
            "contact": match.contact,
            "account": match.account,
            "deal": match.deal,
            "support_case": match.support_case,
        },
    )
    save_email_attachments(message=message, attachments=payload.get("attachments"))
    upsert_email_record_link(message)
    create_source_event(
        source_type=IntegrationLeadSourceEvent.SourceType.EMAIL,
        source_reference=message.external_message_id,
        payload=payload,
        status="processed",
        lead=message.lead,
        contact=message.contact,
        account=message.account,
        deal=message.deal,
        support_case=message.support_case,
    )
    return message


@transaction.atomic
def reconcile_synced_email_links(*, queryset=None) -> dict[str, int]:
    email_queryset = queryset or SyncedEmailMessage.objects.all()
    updated = 0
    cleared = 0
    for message in email_queryset.select_related(
        "provider_integration",
        "lead",
        "contact",
        "account",
        "deal",
        "support_case",
    ):
        payload = {
            "external_message_id": message.external_message_id,
            "thread_id": message.thread_id,
            "subject": message.subject,
            "from_email": message.from_email,
            "to_emails": message.to_emails or [],
            "cc_emails": message.cc_emails or [],
            "bcc_emails": message.bcc_emails or [],
            "body_text": message.body_text,
            "body_html": message.body_html,
            "direction": message.direction,
            "status": message.status,
            "received_at": message.received_at,
            "sent_at": message.sent_at,
            "is_read": message.is_read,
            "has_attachments": message.has_attachments,
        }
        match = _match_synced_email_records(payload)
        match = _expand_related_crm_records(match)
        if not _has_crm_match(match) and should_auto_create_placeholder_lead(payload):
            match = MatchedCRMRecord(
                lead=get_or_create_placeholder_lead(
                    email=message.from_email,
                    name=message.subject,
                    company="Email Inbox",
                    owner=getattr(message.provider_integration, "user", None),
                )
            )
        new_values = {
            "lead": match.lead,
            "contact": match.contact,
            "account": match.account,
            "deal": match.deal,
            "support_case": match.support_case,
        }
        old_values = {
            "lead": message.lead,
            "contact": message.contact,
            "account": message.account,
            "deal": message.deal,
            "support_case": message.support_case,
        }
        if old_values == new_values:
            continue

        message.lead = match.lead
        message.contact = match.contact
        message.account = match.account
        message.deal = match.deal
        message.support_case = match.support_case
        message.save(update_fields=["lead", "contact", "account", "deal", "support_case", "updated_at"])
        upsert_email_record_link(message)
        IntegrationLeadSourceEvent.objects.filter(
            source_type=IntegrationLeadSourceEvent.SourceType.EMAIL,
            source_reference=message.external_message_id,
        ).update(
            lead=match.lead,
            contact=match.contact,
            account=match.account,
            deal=match.deal,
            support_case=match.support_case,
            updated_at=timezone.now(),
        )
        updated += 1
        if not any(new_values.values()):
            cleared += 1

    return {"updated": updated, "cleared": cleared}


def build_default_provider_messages(provider: EmailProviderIntegration) -> list[dict[str, Any]]:
    now = timezone.now()
    leads = list(Lead.objects.order_by("id")[:3])
    if not leads:
        logger.info(
            "Provider %s sync has no CRM records to link yet; generating a starter inbox message.",
            provider.pk,
        )
        return [
            {
                "external_message_id": f"{provider.pk}-starter-message",
                "thread_id": f"thread-{provider.pk}-starter-message",
                "subject": "Welcome to your connected inbox",
                "from_email": "hello@customer-mail.com",
                "to_emails": [provider.email_address],
                "cc_emails": [],
                "bcc_emails": [],
                "body_text": "Your email integration is ready. New synced conversations will appear here.",
                "direction": SyncedEmailMessage.Direction.INCOMING,
                "status": SyncedEmailMessage.Status.RECEIVED,
                "received_at": now - timedelta(minutes=15),
                "is_read": False,
                "has_attachments": False,
            }
        ]

    payloads: list[dict[str, Any]] = []
    for index, lead in enumerate(leads, start=1):
        lead_email = normalize_email(lead.email)
        if not lead_email:
            continue
        payloads.append(
            {
                "external_message_id": f"{provider.pk}-lead-{lead.pk}-incoming",
                "thread_id": f"thread-{provider.pk}-lead-{lead.pk}",
                "subject": f"Follow-up for {lead.first_name}",
                "from_email": lead_email,
                "to_emails": [provider.email_address],
                "cc_emails": [],
                "bcc_emails": [],
                "body_text": f"Hello team, this conversation is linked with lead {lead.pk}.",
                "body_html": f"<p>Hello team, this conversation is linked with lead <strong>{lead.pk}</strong>.</p>",
                "direction": SyncedEmailMessage.Direction.INCOMING,
                "status": SyncedEmailMessage.Status.RECEIVED,
                "received_at": now - timedelta(hours=index),
                "is_read": False,
                "has_attachments": False,
                "from_name": f"{lead.first_name} {lead.last_name}".strip(),
                "company": lead.company,
            }
        )
    return payloads


def build_project_provider_messages(provider: EmailProviderIntegration) -> list[dict[str, Any]]:
    now = timezone.now()
    payloads: list[dict[str, Any]] = []

    recent_contacts = (
        Contact.objects.select_related("account")
        .filter(is_active=True)
        .order_by("-updated_at", "-created_at")[:2]
    )
    for index, contact in enumerate(recent_contacts, start=1):
        if not normalize_email(contact.email):
            continue
        latest_deal = contact.deals.filter(is_active=True).order_by("-updated_at").first()
        latest_case = contact.support_cases.filter(is_active=True).order_by("-updated_at").first()
        reference = latest_case.case_number if latest_case else latest_deal.deal_name if latest_deal else contact.first_name
        payloads.append(
            {
                "external_message_id": f"{provider.pk}-contact-{contact.pk}",
                "thread_id": f"contact-thread-{contact.pk}",
                "subject": f"Follow-up for {reference}",
                "from_email": contact.email,
                "to_emails": [provider.email_address],
                "cc_emails": [],
                "bcc_emails": [],
                "body_text": f"Hello team, please review the latest update for {reference}.",
                "body_html": f"<p>Hello team, please review the latest update for <strong>{reference}</strong>.</p>",
                "direction": SyncedEmailMessage.Direction.INCOMING,
                "status": SyncedEmailMessage.Status.RECEIVED,
                "received_at": now - timedelta(minutes=index * 11),
                "is_read": False,
                "is_starred": index == 1,
                "has_attachments": False,
                "from_name": record_display_name(contact),
                "company": getattr(contact.account, "account_name", None),
            }
        )

    recent_cases = (
        SupportCase.objects.select_related("related_contact", "account", "deal")
        .filter(is_active=True)
        .order_by("-updated_at", "-created_at")[:2]
    )
    for index, support_case in enumerate(recent_cases, start=1):
        sender_email = normalize_email(support_case.email) or normalize_email(getattr(support_case.related_contact, "email", None))
        if not sender_email:
            continue
        payloads.append(
            {
                "external_message_id": f"{provider.pk}-case-{support_case.pk}",
                "thread_id": f"case-thread-{support_case.pk}",
                "subject": f"Re: {support_case.case_number or support_case.subject}",
                "from_email": sender_email,
                "to_emails": [provider.email_address],
                "cc_emails": [],
                "bcc_emails": [],
                "body_text": support_case.description or f"Checking on support case {support_case.case_number or support_case.pk}.",
                "direction": SyncedEmailMessage.Direction.INCOMING,
                "status": SyncedEmailMessage.Status.RECEIVED,
                "received_at": now - timedelta(minutes=30 + index * 13),
                "is_read": index != 1,
                "has_attachments": False,
                "from_name": support_case.reported_by or record_display_name(support_case.related_contact),
                "company": support_case.company,
            }
        )

    recent_leads = Lead.objects.order_by("-updated_at", "-created_at")[:2]
    for index, lead in enumerate(recent_leads, start=1):
        lead_email = normalize_email(lead.email)
        if not lead_email:
            continue
        payloads.append(
            {
                "external_message_id": f"{provider.pk}-lead-{lead.pk}",
                "thread_id": f"lead-thread-{lead.pk}",
                "subject": f"Status update request from {lead.first_name}",
                "from_email": lead_email,
                "to_emails": [provider.email_address],
                "cc_emails": [],
                "bcc_emails": [],
                "body_text": f"Hello team, I am checking the status of my request for {lead.company or 'our company'}.",
                "direction": SyncedEmailMessage.Direction.INCOMING,
                "status": SyncedEmailMessage.Status.RECEIVED,
                "received_at": now - timedelta(minutes=55 + index * 9),
                "is_read": False,
                "has_attachments": False,
                "from_name": f"{lead.first_name} {lead.last_name}".strip(),
                "company": lead.company,
            }
        )

    return payloads or build_default_provider_messages(provider)


def fetch_provider_messages(provider_integration: EmailProviderIntegration) -> list[dict[str, Any]]:
    logger.info(
        "Fetching provider messages for provider=%s email=%s",
        provider_integration.pk,
        provider_integration.email_address,
    )
    if provider_supports_real_mail_sync(provider_integration):
        logger.info("Using live IMAP sync for provider=%s", provider_integration.pk)
        messages = fetch_imap_provider_messages(provider_integration)
        if messages:
            return messages
        logger.info("Live IMAP sync returned no messages for provider=%s", provider_integration.pk)
        return []
    logger.info(
        "Provider %s does not have enough credentials for live sync. Skipping fallback demo/project messages.",
        provider_integration.pk,
    )
    return []


def get_auto_sync_email_providers():
    return EmailProviderIntegration.objects.filter(
        is_active=True,
        sync_enabled=True,
        crm_sync_enabled=True,
    ).order_by("id")


def sync_current_tenant_email_providers(*, sync_type: str = "incremental_sync") -> list[int]:
    synced_provider_ids: list[int] = []
    for provider in get_auto_sync_email_providers():
        run_provider_sync(
            provider_integration=provider,
            sync_type=sync_type,
            triggered_by=provider.created_by,
        )
        synced_provider_ids.append(provider.id)
    return synced_provider_ids


def sync_all_active_tenant_email_providers(*, sync_type: str = "incremental_sync") -> dict[str, list[int]]:
    return {"default": sync_current_tenant_email_providers(sync_type=sync_type)}


@transaction.atomic
def run_provider_sync(
    *,
    provider_integration: EmailProviderIntegration,
    sync_type: str,
    triggered_by=None,
    existing_log: EmailSyncLog | None = None,
) -> EmailSyncLog:
    if existing_log is not None:
        log = existing_log
        base_metadata = log.metadata if isinstance(log.metadata, dict) else {}
        log.sync_type = sync_type
        log.status = EmailSyncLog.Status.RUNNING
        log.error_message = ""
        log.metadata = {
            **base_metadata,
            "triggered_by": getattr(triggered_by, "id", None),
        }
        log.save(update_fields=["sync_type", "status", "error_message", "metadata", "updated_at"])
    else:
        log = EmailSyncLog.objects.create(
            provider_integration=provider_integration,
            sync_type=sync_type,
            status=EmailSyncLog.Status.RUNNING,
            metadata={"triggered_by": getattr(triggered_by, "id", None)},
        )
    try:
        if provider_integration.token_expiry and provider_integration.token_expiry <= timezone.now():
            raise ValueError("Provider token has expired. Refresh the connection and retry.")
        logger.info("Starting provider sync provider=%s sync_type=%s", provider_integration.pk, sync_type)
        created_ids = []
        skipped_messages = 0
        messages = fetch_provider_messages(provider_integration)
        for payload in messages:
            if should_skip_incoming_email_payload(payload):
                skipped_messages += 1
                continue
            message = save_synced_message(
                provider_integration=provider_integration,
                payload=payload,
                owner=provider_integration.created_by,
            )
            created_ids.append(message.id)
        log.status = EmailSyncLog.Status.SUCCESS
        log.last_synced_at = timezone.now()
        sync_source = "live_provider" if provider_supports_real_mail_sync(provider_integration) else "project_records"
        log.metadata = {
            **log.metadata,
            "message_ids": created_ids,
            "messages_processed": len(created_ids),
            "messages_skipped": skipped_messages,
            "lead_matches": SyncedEmailMessage.objects.filter(id__in=created_ids, lead__isnull=False).count(),
            "sync_source": sync_source,
        }
        provider_integration.sync_enabled = True
        provider_integration.last_synced_at = log.last_synced_at
        provider_integration.save(update_fields=["sync_enabled", "last_synced_at", "updated_at"])
        logger.info("Provider sync completed provider=%s messages_processed=%s", provider_integration.pk, len(created_ids))
    except Exception as exc:
        logger.exception("Provider sync failed provider=%s", provider_integration.pk)
        log.status = EmailSyncLog.Status.FAILED
        log.error_message = str(exc)
        raise
    finally:
        log.save()
    return log


@transaction.atomic
def ingest_parser_message(*, parser_inbox: EmailParserInbox, payload: dict[str, Any], user=None):
    target_type = payload.get("create_record_type") or parser_inbox.create_record_type
    contact_email = normalize_email(payload.get("email") or payload.get("from_email"))
    contact_name = payload.get("name") or payload.get("from_name") or payload.get("subject")
    company = payload.get("company") or "Parsed Inbox"

    lead = None
    contact = None
    support_case = None

    if target_type == EmailParserInbox.RecordType.CONTACT:
        contact = get_or_create_contact_from_event(email=contact_email, name=contact_name, owner=user)
    elif target_type == EmailParserInbox.RecordType.CASE:
        support_case = SupportCase.objects.create(
            subject=payload.get("subject") or "Parsed support request",
            description=payload.get("body_text") or payload.get("body_html"),
            email=contact_email,
            company=company,
            reported_by=contact_name,
            owner=user,
            created_by=user,
            updated_by=user,
            case_origin="Email Parser",
            lead_source="Integration",
        )
    else:
        lead = get_or_create_placeholder_lead(email=contact_email, name=contact_name, company=company, owner=user)

    event = create_source_event(
        source_type=IntegrationLeadSourceEvent.SourceType.PARSER,
        source_reference=parser_inbox.parser_email_address,
        payload=payload,
        status="processed",
        lead=lead,
        contact=contact,
        account=getattr(contact, "account", None),
        support_case=support_case,
    )
    return {"lead": lead, "contact": contact, "support_case": support_case, "event": event}


@transaction.atomic
def process_bcc_payload(*, setting: BCCDropboxSetting, payload: dict[str, Any], user=None):
    from_email = normalize_email(payload.get("from_email"))
    if not from_email:
        raise ValueError("from_email is required for BCC processing.")
    excluded_domains = {domain.lower() for domain in setting.exclude_domains}
    if from_email.split("@")[-1] in excluded_domains:
        raise ValueError("This sender domain is excluded from BCC matching.")

    match = match_crm_records_by_email(from_email)
    lead = match.lead
    if not match.contact and not lead:
        lead = get_or_create_placeholder_lead(
            email=from_email,
            name=payload.get("from_name") or payload.get("subject"),
            company=payload.get("company") or "BCC Dropbox",
            owner=user,
        )
    event = create_source_event(
        source_type=IntegrationLeadSourceEvent.SourceType.BCC_DROPBOX,
        source_reference=setting.dropbox_email_address,
        payload=payload,
        status="processed",
        lead=lead or match.lead,
        contact=match.contact,
        account=match.account,
        deal=match.deal,
        support_case=match.support_case,
    )
    return {
        "lead": lead or match.lead,
        "contact": match.contact,
        "account": match.account,
        "deal": match.deal,
        "event": event,
    }


def _should_create_case_from_social(message: str, action_type: str | None) -> bool:
    text = (message or "").lower()
    return action_type == SocialLeadAutomationRule.ActionType.CREATE_CASE or any(keyword in text for keyword in COMPLAINT_KEYWORDS)


@transaction.atomic
def ingest_social_message(*, payload: dict[str, Any], user=None) -> SocialMessage:
    platform = payload["platform"]
    text = payload.get("message") or ""
    sender_email = normalize_email(payload.get("sender_email"))
    sender_phone = payload.get("sender_phone")
    sender_name = payload.get("sender_name")
    profile_handle = payload.get("profile_handle")
    external_message_id = payload.get("external_message_id")
    brand = payload.get("brand")
    social_account = payload.get("social_account")

    reference_text = " ".join(filter(None, [text, profile_handle, payload.get("subject")])).strip()
    match = match_crm_records(email=sender_email, phone=sender_phone, text=reference_text)

    rule = (
        SocialLeadAutomationRule.objects.filter(platform=platform, is_active=True)
        .order_by("-updated_at")
        .first()
    )
    owner = getattr(rule, "assign_to_user", None) or user
    lead = match.lead
    contact = match.contact
    account = match.account
    deal = match.deal
    support_case = match.support_case

    if not lead and not contact and rule and rule.action_type == SocialLeadAutomationRule.ActionType.CREATE_LEAD:
        lead = get_or_create_placeholder_lead(
            email=sender_email,
            name=sender_name or profile_handle or f"{platform.title()} Social Prospect",
            company="Social Prospect",
            owner=owner,
        )

    if not support_case and _should_create_case_from_social(text, getattr(rule, "action_type", None)):
        support_case = SupportCase.objects.create(
            subject=(text[:120] or "Social support request"),
            description=text,
            email=sender_email,
            phone=sender_phone,
            reported_by=sender_name or profile_handle,
            owner=owner,
            created_by=user,
            updated_by=user,
            related_contact=contact,
            account=account,
            deal=deal,
            case_origin=f"{platform.title()} Social",
            case_reason="Product Issue",
            status="Open",
            priority="Medium",
            company=getattr(account, "account_name", None) or "Social Prospect",
        )

    created_at_source = payload.get("created_at_source")
    if isinstance(created_at_source, str):
        parsed_created_at = parse_datetime(created_at_source)
        created_at_source = parsed_created_at or timezone.now()

    defaults = {
        "brand": brand,
        "social_account": social_account,
        "profile_handle": profile_handle,
        "sender_name": sender_name,
        "sender_email": sender_email,
        "sender_phone": sender_phone,
        "message": text,
        "created_at_source": created_at_source or timezone.now(),
        "payload": _json_safe(payload),
        "lead": lead,
        "contact": contact,
        "account": account,
        "deal": deal,
        "support_case": support_case,
    }
    if external_message_id:
        message, _ = SocialMessage.objects.update_or_create(
            platform=platform,
            external_message_id=external_message_id,
            defaults=defaults,
        )
    else:
        message = SocialMessage.objects.create(
            platform=platform,
            external_message_id=None,
            **defaults,
        )
    create_source_event(
        source_type=IntegrationLeadSourceEvent.SourceType.SOCIAL,
        source_reference=external_message_id or f"{platform}-{message.pk}",
        payload={
            **payload,
            "source_label": sender_name or profile_handle or platform.title(),
        },
        status="processed",
        lead=lead,
        contact=contact,
        account=account,
        deal=deal,
        support_case=support_case,
    )
    return message


@transaction.atomic
def convert_visitor_event(*, visitor_event: VisitorLeadEvent, user=None):
    if visitor_event.converted_to_lead and (visitor_event.linked_lead or visitor_event.linked_contact):
        return {"lead": visitor_event.linked_lead, "contact": visitor_event.linked_contact}

    setting = getattr(visitor_event.portal, "setting", None)
    owner = setting.assign_lead_to_user if setting and setting.assign_lead_to_user else user
    matched = match_crm_records(
        email=visitor_event.identified_email or visitor_event.visitor_email,
        text=" ".join(filter(None, [visitor_event.page_url, visitor_event.source_url, visitor_event.referrer])),
    )
    if setting and setting.push_new_visitors_as == VisitorTrackingSetting.PushAs.CONTACT:
        contact = matched.contact or get_or_create_contact_from_event(
            email=visitor_event.identified_email or visitor_event.visitor_email,
            name=visitor_event.visitor_name,
            owner=owner,
            account=matched.account,
        )
        visitor_event.linked_contact = contact
        visitor_event.converted_to_lead = True
        visitor_event.save(update_fields=["linked_contact", "converted_to_lead", "updated_at"])
        event = create_source_event(
            source_type=IntegrationLeadSourceEvent.SourceType.WEBSITE,
            source_reference=f"visitor-event-{visitor_event.id}",
            payload={"portal_id": visitor_event.portal_id, "event_type": visitor_event.event_type, "page_url": visitor_event.page_url or visitor_event.source_url},
            status="converted",
            contact=contact,
            account=contact.account,
            deal=matched.deal,
            support_case=matched.support_case,
        )
        return {"lead": None, "contact": contact, "event": event}

    lead = matched.lead or get_or_create_placeholder_lead(
        email=visitor_event.identified_email or visitor_event.visitor_email,
        name=visitor_event.visitor_name,
        company=urlparse(visitor_event.page_url or visitor_event.source_url or visitor_event.portal.portal_url).netloc or "Website Visitor",
        owner=owner,
    )
    visitor_event.converted_to_lead = True
    visitor_event.linked_lead = lead
    visitor_event.linked_contact = matched.contact
    visitor_event.save(update_fields=["converted_to_lead", "linked_lead", "linked_contact", "updated_at"])
    event = create_source_event(
        source_type=IntegrationLeadSourceEvent.SourceType.SALESIQ,
        source_reference=f"visitor-event-{visitor_event.id}",
        payload={"portal_id": visitor_event.portal_id, "event_type": visitor_event.event_type, "page_url": visitor_event.page_url or visitor_event.source_url},
        status="converted",
        lead=lead,
        contact=matched.contact,
        account=matched.account,
        deal=matched.deal,
        support_case=matched.support_case,
    )
    return {"lead": lead, "contact": matched.contact, "event": event}


@transaction.atomic
def create_visitor_event(*, payload: dict[str, Any], user=None):
    portal = payload["portal"]
    validate_visitor_event_origin(portal=portal, payload=payload)
    visitor_email = normalize_email(payload.get("visitor_email"))
    identified_email = normalize_email(payload.get("identified_email")) or visitor_email
    visitor_name = payload.get("visitor_name")
    page_url = payload.get("page_url") or payload.get("source_url")
    source_url = payload.get("source_url") or page_url
    referrer = payload.get("referrer")
    session_id = payload.get("session_id")
    page_history = payload.get("page_history") or []
    time_spent_seconds = payload.get("time_spent_seconds")
    event_type = payload.get("event_type") or "visit"

    matched = match_crm_records(
        email=identified_email,
        phone=payload.get("phone"),
        text=" ".join(filter(None, [page_url, referrer, payload.get("source_reference")])),
    )
    linked_lead = matched.lead
    linked_contact = matched.contact
    event = VisitorLeadEvent.objects.create(
        portal=portal,
        session_id=session_id,
        visitor_name=visitor_name,
        visitor_email=visitor_email,
        identified_email=identified_email,
        page_url=page_url,
        source_url=source_url,
        referrer=referrer,
        page_history=page_history,
        time_spent_seconds=time_spent_seconds,
        event_type=event_type,
        linked_lead=linked_lead,
        linked_contact=linked_contact,
        converted_to_lead=bool(linked_lead or linked_contact),
    )
    if session_id and identified_email:
        VisitorLeadEvent.objects.filter(
            session_id=session_id,
            identified_email__isnull=True,
        ).exclude(pk=event.pk).update(
            identified_email=identified_email,
            linked_lead=linked_lead,
            linked_contact=linked_contact,
            converted_to_lead=bool(linked_lead or linked_contact),
            updated_at=timezone.now(),
        )
    source_event = create_source_event(
        source_type=IntegrationLeadSourceEvent.SourceType.WEBSITE,
        source_reference=payload.get("source_reference") or f"visitor-event-{event.pk}",
        payload={
            "portal_id": portal.pk,
            "source_label": payload.get("source_label") or payload.get("source_reference") or event_type,
            "page_url": page_url,
            "source_url": source_url,
            "referrer": referrer,
            "page_history": page_history,
            "event_type": event_type,
        },
        status="linked" if linked_lead or linked_contact else "captured",
        lead=linked_lead,
        contact=linked_contact,
        account=matched.account,
        deal=matched.deal,
        support_case=matched.support_case,
    )
    high_intent = any(keyword in (page_url or "").lower() for keyword in HIGH_INTENT_PATH_KEYWORDS)
    repeated_visit = bool(
        identified_email
        and VisitorLeadEvent.objects.filter(portal=portal, identified_email=identified_email).exclude(pk=event.pk).count() >= 1
    )
    should_convert = event_type.lower() in {"form_submit", "signup", "contact"} or repeated_visit or high_intent
    if should_convert and not (linked_lead or linked_contact):
        convert_visitor_event(visitor_event=event, user=user)
    logger.info(
        "Created visitor event portal=%s visitor_email=%s linked_lead=%s source_event=%s",
        portal.pk,
        identified_email or visitor_email,
        getattr(linked_lead, "pk", None),
        source_event.pk,
    )
    event.refresh_from_db()
    return {"visitor_event": event, "source_event": source_event, "lead": event.linked_lead, "contact": event.linked_contact}


@transaction.atomic
def link_visitor_event_to_lead(*, visitor_event: VisitorLeadEvent, lead: Lead | None = None, user=None):
    target_lead = lead or match_crm_records(email=visitor_event.identified_email or visitor_event.visitor_email).lead
    if not target_lead:
        result = convert_visitor_event(visitor_event=visitor_event, user=user)
        target_lead = result.get("lead")
    else:
        visitor_event.linked_lead = target_lead
        visitor_event.converted_to_lead = True
        visitor_event.save(update_fields=["linked_lead", "converted_to_lead", "updated_at"])
        create_source_event(
            source_type=IntegrationLeadSourceEvent.SourceType.WEBSITE,
            source_reference=f"visitor-event-{visitor_event.pk}",
            payload={"portal_id": visitor_event.portal_id, "source_label": visitor_event.event_type, "source_url": visitor_event.source_url, "page_url": visitor_event.page_url},
            status="linked",
            lead=target_lead,
            contact=visitor_event.linked_contact,
        )
    logger.info("Linked visitor event=%s to lead=%s", visitor_event.pk, getattr(target_lead, "pk", None))
    return target_lead


def build_sales_inbox_queryset(user):
    queryset = SyncedEmailMessage.objects.select_related(
        "lead",
        "contact",
        "account",
        "deal",
        "support_case",
        "provider_integration",
    )
    return queryset.annotate(
        priority_rank=Case(
            When(is_read=False, then=Value(0)),
            When(is_starred=True, then=Value(1)),
            default=Value(2),
            output_field=IntegerField(),
        ),
        thread_size=Count("id"),
    ).order_by("priority_rank", "-received_at", "-created_at")


def build_credibility_report():
    return {
        "total_sent": 0,
        "delivered_count": 0,
        "bounced_count": 0,
        "spam_complaints": 0,
        "average_score": 0,
        "active_relays": list(
            EmailRelayServer.objects.filter(is_active=True)
            .values("domain_name")
            .annotate(active_relays=Count("id"))
        ),
    }
