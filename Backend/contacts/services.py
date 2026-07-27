from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.db.models import Count, QuerySet

from activities.services import create_contact_activity
from notes.services import (
    create_contact_note,
    delete_contact_note,
    list_contact_notes,
    update_contact_note,
)

from .models import Contact
from .permissions import filter_queryset_for_user


def _normalize_email(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower()
    return normalized or None


class TimelineService:
    @staticmethod
    def log_event(*, contact: Contact, action: str, description: str = "", user=None):
        return create_contact_activity(
            contact=contact,
            action=action,
            description=description,
            user=user,
        )

    @staticmethod
    def list_events(*, contact: Contact):
        return contact.activities.select_related("user").all()


class NotesService:
    @staticmethod
    def create_note(*, contact: Contact, note: str, user=None):
        return create_contact_note(contact=contact, note=note, created_by=user)

    @staticmethod
    def list_notes(*, contact: Contact):
        return list_contact_notes(contact=contact)

    @staticmethod
    def update_note(*, note_id: int, note: str, user):
        return update_contact_note(note_id=note_id, note=note, user=user)

    @staticmethod
    def delete_note(*, note_id: int, user):
        return delete_contact_note(note_id=note_id, user=user)


class ActivityService:
    @staticmethod
    def log_activity(*, contact: Contact, action: str, description: str = "", user=None):
        return create_contact_activity(
            contact=contact,
            action=action,
            description=description,
            user=user,
        )


@dataclass
class ContactService:
    timeline_service: TimelineService = TimelineService()
    notes_service: NotesService = NotesService()
    activity_service: ActivityService = ActivityService()

    def list_contacts(self, *, user) -> QuerySet[Contact]:
        queryset = (
            Contact.objects.filter(is_active=True)
            .select_related("contact_owner", "account", "created_from_lead")
        )
        return filter_queryset_for_user(queryset, user)

    def get_contact_detail(self, *, contact_id: int, user) -> Contact:
        queryset = (
            self.list_contacts(user=user)
            .annotate(
                notes_count=Count("notes", distinct=True),
                activities_count=Count("activities", distinct=True),
                timeline_count=Count("activities", distinct=True),
            )
        )
        return queryset.get(pk=contact_id)

    @transaction.atomic
    def create_contact(self, *, data: dict[str, Any], user) -> Contact:
        if not data.get("account"):
            raise ValueError("account: Account is required.")
        if data.get("email"):
            data["email"] = _normalize_email(data["email"])
        if not data.get("contact_owner"):
            data["contact_owner"] = user

        allowed_fields = {
            f.name for f in Contact._meta.get_fields()
            if f.concrete and not f.auto_created
        }
        cleaned_data = {k: v for k, v in data.items() if k in allowed_fields}

        existing_contact = None
        if cleaned_data.get("created_from_lead"):
            existing_contact = (
                Contact.objects.filter(
                    created_from_lead=cleaned_data["created_from_lead"],
                    is_active=True,
                )
                .select_related("account", "contact_owner")
                .first()
            )
        if not existing_contact and cleaned_data.get("email"):
            existing_contact = (
                Contact.objects.filter(
                    email__iexact=cleaned_data["email"],
                    account=cleaned_data["account"],
                    is_active=True,
                )
                .select_related("account", "contact_owner")
                .first()
            )

        if existing_contact:
            updated_fields = []
            for field, value in cleaned_data.items():
                if value in (None, "", []) or getattr(existing_contact, field) == value:
                    continue
                setattr(existing_contact, field, value)
                updated_fields.append(field)
            if updated_fields:
                existing_contact.save(update_fields=[*updated_fields, "updated_at"])
            contact = existing_contact
        else:
            contact = Contact.objects.create(**cleaned_data)
        self.log_activity(
            contact=contact,
            action="Contact created",
            description="Contact created",
            user=user,
        )

        return contact

    @transaction.atomic
    def update_contact(self, *, contact: Contact, data: dict[str, Any], user) -> Contact:
        changed_messages = []
        tracked_fields = {
            "phone": "Phone updated",
            "contact_owner": "Owner changed",
            "email": "Email updated",
        }

        for field, value in data.items():
            old_value = getattr(contact, field)
            if old_value != value:
                setattr(contact, field, value)
                if field in tracked_fields:
                    changed_messages.append(tracked_fields[field])

        contact.save()
        if changed_messages:
            for message in changed_messages:
                self.log_activity(contact=contact, action=message, description=message, user=user)
        else:
            self.log_activity(
                contact=contact,
                action="Contact updated",
                description="Contact updated",
                user=user,
            )
        return contact

    @transaction.atomic
    def delete_contact(self, *, contact: Contact, user) -> Contact:
        contact.is_active = False
        contact.save(update_fields=["is_active", "updated_at"])
        self.log_activity(
            contact=contact,
            action="Contact deleted",
            description="Contact deleted",
            user=user,
        )
        return contact

    def log_activity(self, *, contact: Contact, action: str, description: str = "", user=None):
        return self.activity_service.log_activity(
            contact=contact,
            action=action,
            description=description,
            user=user,
        )


contact_service = ContactService()


def create_contact_from_lead(*, lead, account, owner=None):
    payload = {
        "account": account,
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "title": lead.title,
        "email": _normalize_email(lead.email),
        "secondary_email": getattr(lead, "secondary_email", None),
        "phone": lead.phone,
        "mobile": lead.mobile,
        "contact_owner": lead.owner or owner,
        "created_from_lead": lead,
        "lead_source": lead.lead_source,
    }
    existing_contact = (
        Contact.objects.filter(created_from_lead=lead, is_active=True)
        .select_related("account", "contact_owner")
        .first()
    )
    if not existing_contact and payload["email"]:
        existing_contact = (
            Contact.objects.filter(
                email__iexact=payload["email"],
                account=account,
                is_active=True,
            )
            .select_related("account", "contact_owner")
            .first()
        )
    if existing_contact:
        updated_fields = []
        for field, value in payload.items():
            if value in (None, "", []) or getattr(existing_contact, field) == value:
                continue
            setattr(existing_contact, field, value)
            updated_fields.append(field)
        if updated_fields:
            existing_contact.save(update_fields=[*updated_fields, "updated_at"])
        contact = existing_contact
    else:
        contact = Contact.objects.create(**payload)
    create_contact_activity(
        contact=contact,
        action="Lead converted",
        description=f"Created from lead #{lead.pk}",
        user=owner or lead.owner,
    )
    return contact
