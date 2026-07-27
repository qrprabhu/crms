from __future__ import annotations

import hashlib
import uuid

from django.conf import settings


def build_portal_tracking_key(portal_id: int, portal_name: str) -> str:
    return hashlib.sha256(f"{portal_id}:{portal_name}:{settings.SECRET_KEY}".encode()).hexdigest()[:18]


def generate_integration_email(prefix: str, domain: str = "crm.local") -> str:
    token = uuid.uuid4().hex[:12]
    return f"{prefix}-{token}@{domain}"


def generate_verification_code() -> str:
    return uuid.uuid4().hex[:6].upper()


def build_tracking_code(portal_id: int, portal_name: str, *, script_url: str | None = None) -> str:
    portal_hash = build_portal_tracking_key(portal_id, portal_name)
    tracker_url = script_url or "/api/integrations/visitors/tracker.js"
    return (
        "<script>"
        f"window.CRMVisitorPortal='{portal_hash}';"
        "(function(){var s=document.createElement('script');"
        "s.async=true;"
        f"s.src='{tracker_url}';"
        "document.head.appendChild(s);})();"
        "</script>"
    )


def normalize_email(value: str | None) -> str | None:
    if not value:
        return None
    email = value.strip().lower()
    return email or None


def split_name(value: str | None, fallback_first: str = "Unknown") -> tuple[str, str]:
    text = (value or "").strip()
    if not text:
        return fallback_first, "Lead"
    parts = text.split()
    if len(parts) == 1:
        return parts[0], "Lead"
    return parts[0], " ".join(parts[1:])


def make_placeholder_email(prefix: str = "integration") -> str:
    return f"{prefix}+{uuid.uuid4().hex[:12]}@crm.local"


def record_display_name(record) -> str | None:
    if not record:
        return None
    first_name = getattr(record, "first_name", None)
    last_name = getattr(record, "last_name", None)
    if first_name or last_name:
        return f"{first_name or ''} {last_name or ''}".strip()
    for attr in ("case_number", "solution_number", "account_name", "deal_name", "subject", "name", "email"):
        value = getattr(record, attr, None)
        if value:
            return str(value)
    return str(record)
