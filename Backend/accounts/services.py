from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.db.models import Count, QuerySet
from django.utils.text import slugify

from activities.services import create_account_activity
from integrations.models import SyncedEmailMessage
from notes.services import (
    create_account_note,
    delete_account_note,
    list_account_notes,
    update_account_note,
)

from .models import Account, AccountAttachment
from .permissions import filter_queryset_for_user


def _normalize_account_name(value: str | None) -> str:
    return (value or "").strip()


class TimelineService:
    @staticmethod
    def log_event(*, account: Account, action: str, description: str = "", user=None):
        return create_account_activity(
            account=account,
            action=action,
            description=description,
            user=user,
        )

    @staticmethod
    def list_events(*, account: Account):
        return account.activities.select_related("user").all()


class NotesService:
    @staticmethod
    def create_note(*, account: Account, note: str, user=None):
        return create_account_note(account=account, note=note, created_by=user)

    @staticmethod
    def list_notes(*, account: Account):
        return list_account_notes(account=account)

    @staticmethod
    def update_note(*, note_id: int, note: str, user):
        return update_account_note(note_id=note_id, note=note, user=user)

    @staticmethod
    def delete_note(*, note_id: int, user):
        return delete_account_note(note_id=note_id, user=user)


class ActivityService:
    @staticmethod
    def log_activity(*, account: Account, action: str, description: str = "", user=None):
        return create_account_activity(
            account=account,
            action=action,
            description=description,
            user=user,
        )


@dataclass
class AccountService:
    timeline_service: TimelineService = TimelineService()
    notes_service: NotesService = NotesService()
    activity_service: ActivityService = ActivityService()

    def list_accounts(self, *, user) -> QuerySet[Account]:
        queryset = (
            Account.objects.filter(is_active=True)
            .select_related("account_owner", "parent_account")
        )
        return filter_queryset_for_user(queryset, user)

    def get_account_detail(self, *, account_id: int, user) -> Account:
        queryset = self.list_accounts(user=user).annotate(
            contacts_count=Count("contacts", distinct=True),
            deals_count=Count("deals", distinct=True),
            activities_count=Count("activities", distinct=True),
            notes_count=Count("notes", distinct=True),
        )
        return queryset.get(pk=account_id)

    @transaction.atomic
    def create_account(self, *, data: dict[str, Any], user) -> Account:
        if data.get("account_name"):
            data["account_name"] = _normalize_account_name(data["account_name"])
        if not data.get("account_owner"):
            data["account_owner"] = user
        existing_account = Account.objects.filter(
            account_name__iexact=data["account_name"],
            is_active=True,
        ).first()
        if existing_account:
            updated_fields = []
            for field, value in data.items():
                if field == "account_owner":
                    continue
                if value in (None, "", []) or getattr(existing_account, field) == value:
                    continue
                setattr(existing_account, field, value)
                updated_fields.append(field)
            if not existing_account.account_owner_id and data.get("account_owner"):
                existing_account.account_owner = data["account_owner"]
                updated_fields.append("account_owner")
            if updated_fields:
                existing_account.save(update_fields=[*updated_fields, "updated_at"])
            return existing_account

        account = Account.objects.create(**data)
        self.log_activity(
            account=account,
            action="Account created",
            description="Account created",
            user=user,
        )
        return account

    @transaction.atomic
    def update_account(self, *, account: Account, data: dict[str, Any], user) -> Account:
        for field, value in data.items():
            setattr(account, field, value)
        account.save()
        self.log_activity(
            account=account,
            action="Account updated",
            description="Account updated",
            user=user,
        )
        return account

    @transaction.atomic
    def delete_account(self, *, account: Account, user) -> Account:
        account.is_active = False
        account.save(update_fields=["is_active", "updated_at"])
        self.log_activity(
            account=account,
            action="Account deleted",
            description="Account deleted",
            user=user,
        )
        return account

    def _build_clone_name(self, account_name: str) -> str:
        base = slugify(account_name.replace("+", " ")) or "account"
        candidate = f"{base}-clone"
        counter = 1
        while Account.objects.filter(account_name__iexact=candidate, is_active=True).exists():
            candidate = f"{base}-clone-{counter}"
            counter += 1
        return candidate

    @transaction.atomic
    def clone_account(self, *, account: Account, user) -> Account:
        account_data = {
            field.name: deepcopy(getattr(account, field.name))
            for field in account._meta.fields
            if field.name not in {"id", "created_at", "updated_at", "image"}
        }
        account_data["account_name"] = self._build_clone_name(account.account_name)
        cloned = Account.objects.create(**account_data)
        self.log_activity(
            account=cloned,
            action="Account cloned",
            description=f"Cloned from account #{account.pk}",
            user=user,
        )
        return cloned

    @transaction.atomic
    def merge_accounts(self, *, target: Account, sources: list[Account], user) -> Account:
        for source in sources:
            source.contacts.update(account=target)
            source.deals.update(account=target)
            source.activities.update(account=target)
            source.notes.update(account=target)
            source.attachments.update(account=target)
            source.is_active = False
            source.save(update_fields=["is_active", "updated_at"])

        self.log_activity(
            account=target,
            action="Accounts merged",
            description=f"Merged accounts: {[source.pk for source in sources]}",
            user=user,
        )
        return target

    def list_account_contacts(self, *, account: Account):
        return account.contacts.filter(is_active=True).select_related("contact_owner")

    def list_account_deals(self, *, account: Account):
        return account.deals.select_related("deal_owner", "contact", "lead", "stage")

    def list_account_activities(self, *, account: Account):
        return account.activities.select_related("user")

    def list_account_emails(self, *, account: Account):
        return list(
            SyncedEmailMessage.objects.filter(account=account)
            .order_by("-sent_at", "-received_at", "-created_at")
            .values(
                "id",
                "subject",
                "from_email",
                "to_emails",
                "status",
                "sent_at",
                "received_at",
                "direction",
            )
        )

    def list_account_products(self, *, account: Account):
        # Product module is not implemented yet in this codebase.
        return []

    def list_account_quotes(self, *, account: Account):
        # Quote module is not implemented yet in this codebase.
        return []

    def list_account_orders(self, *, account: Account):
        # Sales order module is not implemented yet in this codebase.
        return []

    def list_account_invoices(self, *, account: Account):
        # Invoice module is not implemented yet in this codebase.
        return []

    def list_account_cases(self, *, account: Account):
        # Case module is not implemented yet in this codebase.
        return []

    def log_activity(self, *, account: Account, action: str, description: str = "", user=None):
        return self.activity_service.log_activity(
            account=account,
            action=action,
            description=description,
            user=user,
        )

    @transaction.atomic
    def add_attachment(self, *, account: Account, file, user) -> AccountAttachment:
        attachment = AccountAttachment.objects.create(
            account=account,
            file=file,
            uploaded_by=user,
        )
        self.log_activity(
            account=account,
            action="Attachment added",
            description=f"Attachment #{attachment.pk} uploaded",
            user=user,
        )
        return attachment

    def list_attachments(self, *, account: Account):
        return account.attachments.filter(is_active=True).select_related("uploaded_by")

    @transaction.atomic
    def delete_attachment(self, *, attachment: AccountAttachment, user) -> None:
        attachment.is_active = False
        attachment.save(update_fields=["is_active", "updated_at"])
        self.log_activity(
            account=attachment.account,
            action="Attachment deleted",
            description=f"Attachment #{attachment.pk} deleted",
            user=user,
        )

    @transaction.atomic
    def upload_image(self, *, account: Account, image, user) -> Account:
        account.image = image
        account.save(update_fields=["image", "updated_at"])
        self.log_activity(
            account=account,
            action="Account image uploaded",
            description="Account image uploaded",
            user=user,
        )
        return account


account_service = AccountService()


def create_account_from_lead(*, lead, owner=None):
    account_name = _normalize_account_name(lead.company)
    existing_account = Account.objects.filter(
        account_name__iexact=account_name,
        is_active=True,
    ).first()
    if existing_account:
        updated_fields = []
        if not existing_account.account_owner_id and (lead.owner or owner):
            existing_account.account_owner = lead.owner or owner
            updated_fields.append("account_owner")
        for field_name, value in {
            "website": lead.website,
            "phone": lead.phone,
            "industry": lead.industry,
            "annual_revenue": lead.annual_revenue,
            "employees": lead.employee_count,
        }.items():
            if value and not getattr(existing_account, field_name):
                setattr(existing_account, field_name, value)
                updated_fields.append(field_name)
        billing_address = ", ".join(
            part for part in [lead.street, lead.city, lead.state, lead.country, lead.zip_code] if part
        ) or None
        if billing_address and not existing_account.billing_address:
            existing_account.billing_address = billing_address
            updated_fields.append("billing_address")
        if updated_fields:
            existing_account.save(update_fields=[*updated_fields, "updated_at"])
        return existing_account

    return Account.objects.create(
        account_name=account_name,
        website=lead.website,
        phone=lead.phone,
        industry=lead.industry,
        annual_revenue=lead.annual_revenue,
        employees=lead.employee_count,
        account_owner=lead.owner or owner,
        billing_address=", ".join(
            part for part in [lead.street, lead.city, lead.state, lead.country, lead.zip_code] if part
        )
        or None,
    )

