from copy import deepcopy

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.text import slugify

from activities.services import create_lead_activity
from accounts.models import Account
from accounts.services import create_account_from_lead
from contacts.models import Contact
from contacts.services import create_contact_from_lead
from deals.services import create_deal_from_lead
from notes.services import create_note

from .models import Lead


def _normalize_company_name(company: str | None) -> str:
    return (company or "").strip()


def _lead_display_name(lead) -> str:
    return f"{lead.first_name} {lead.last_name}".strip()


def bulk_delete_leads(lead_ids):
    with transaction.atomic():
        deleted_count, _ = Lead.objects.filter(id__in=lead_ids).delete()
    return deleted_count


def create_activity_log(*, lead, action, description="", user=None):
    return create_lead_activity(
        lead=lead,
        action=action,
        description=description,
        user=user,
    )


def create_lead_note(*, lead, note, created_by=None):
    with transaction.atomic():
        lead_note = create_note(
            lead=lead,
            note=note,
            created_by=created_by,
        )
        create_activity_log(
            lead=lead,
            action="Note Added",
            description=note,
            user=created_by,
        )
        return lead_note


def list_lead_timeline(*, lead):
    return lead.activities.select_related("user").all()


def list_lead_notes(*, lead):
    return lead.notes.select_related("created_by").all()


def create_note_for_lead(*, lead, note, user=None):
    return create_lead_note(lead=lead, note=note, created_by=user)


def get_lead_timeline(*, lead):
    return list_lead_timeline(lead=lead)


def _build_clone_email(email):
    local_part, domain_part = email.split("@", 1)
    base_local = slugify(local_part.replace("+", " ")) or "lead"
    candidate = f"{base_local}-clone@{domain_part}"
    counter = 1
    while Lead.objects.filter(email=candidate).exists():
        candidate = f"{base_local}-clone-{counter}@{domain_part}"
        counter += 1
    return candidate


def clone_lead(*, lead, user=None):
    with transaction.atomic():
        lead_data = {
            field.name: deepcopy(getattr(lead, field.name))
            for field in lead._meta.fields
            if field.name not in {"id", "created_at", "updated_at"}
        }
        lead_data["email"] = _build_clone_email(lead.email)
        cloned_lead = Lead.objects.create(**lead_data)
        create_activity_log(
            lead=cloned_lead,
            action="Lead Cloned",
            description=f"Lead cloned from lead #{lead.pk}.",
            user=user,
        )
    return cloned_lead


def convert_lead(*, lead, user=None, create_deal=False, deal_name=None, deal_value=None):
    if lead.lead_status == Lead.LeadStatus.CONVERTED:
        raise ValidationError("Lead has already been converted.")

    company_name = _normalize_company_name(lead.company)
    if not company_name:
        raise ValidationError("Account creation requires company.")

    with transaction.atomic():
        effective_owner = lead.owner or user

        account = Account.objects.filter(
            account_name__iexact=company_name,
            is_active=True,
        ).first()
        if not account:
            account = create_account_from_lead(
                lead=lead,
                owner=effective_owner,
            )

        contact = (
            lead.generated_contacts.filter(is_active=True)
            .select_related("account", "contact_owner")
            .first()
        )
        if not contact and lead.email:
            contact = (
                Contact.objects.filter(email__iexact=lead.email, is_active=True)
                .select_related("account", "contact_owner")
                .first()
            )
        if contact:
            changed_fields = []
            if contact.account_id != account.id:
                contact.account = account
                changed_fields.append("account")
            if not contact.contact_owner_id and effective_owner:
                contact.contact_owner = effective_owner
                changed_fields.append("contact_owner")
            if changed_fields:
                contact.save(update_fields=[*changed_fields, "updated_at"])
        else:
            contact = create_contact_from_lead(
                lead=lead,
                account=account,
                owner=effective_owner,
            )

        if create_deal and not deal_name:
            deal_name = f"{company_name} - {_lead_display_name(lead)} Deal".strip(" -")

        deal = lead.converted_deal if lead.converted_deal_id else None
        if deal and create_deal:
            changed_fields = []
            if deal.account_id != account.id:
                deal.account = account
                changed_fields.append("account")
            if deal.contact_id != contact.id:
                deal.contact = contact
                changed_fields.append("contact")
            if not deal.deal_owner_id and effective_owner:
                deal.deal_owner = effective_owner
                changed_fields.append("deal_owner")
            if deal_name and deal.deal_name != deal_name:
                deal.deal_name = deal_name
                changed_fields.append("deal_name")
            if deal_value is not None:
                deal.amount = deal_value
                deal.expected_revenue = deal_value
                changed_fields.extend(["amount", "expected_revenue"])
            if changed_fields:
                deduped_fields = []
                for field in changed_fields:
                    if field not in deduped_fields:
                        deduped_fields.append(field)
                deal.save(update_fields=[*deduped_fields, "updated_at"])
        elif create_deal:
            deal = create_deal_from_lead(
                lead=lead,
                account=account,
                contact=contact,
                owner=effective_owner,
                deal_name=deal_name,
                deal_value=deal_value,
            )

        if not lead.owner_id and effective_owner:
            lead.owner = effective_owner

        lead.company = company_name
        lead.lead_status = Lead.LeadStatus.CONVERTED
        lead.converted_account = account
        lead.converted_contact = contact
        lead.converted_deal = deal
        lead.save(
            update_fields=[
                "owner",
                "company",
                "lead_status",
                "converted_account",
                "converted_contact",
                "converted_deal",
                "updated_at",
            ]
        )

        create_activity_log(
            lead=lead,
            action="Lead Converted",
            description=(
                f"Lead converted to account #{account.pk}, "
                f"contact #{contact.pk}"
                + (f", and deal #{deal.pk}." if deal else ".")
            ),
            user=user,
        )

    return {
        "account": account,
        "contact": contact,
        "deal": deal,
    }
