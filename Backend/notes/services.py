from .models import LeadNote
from contacts.permissions import can_access_contact_owner
from accounts.permissions import can_access_account_owner
from deals.permissions import can_access_deal_owner


def create_note(*, lead, note, created_by=None):
    return LeadNote.objects.create(
        lead=lead,
        note=note,
        created_by=created_by,
    )


def create_contact_note(*, contact, note, created_by=None):
    return LeadNote.objects.create(
        contact=contact,
        note=note,
        created_by=created_by,
    )


def list_contact_notes(*, contact):
    return contact.notes.select_related("created_by").all()


def update_contact_note(*, note_id, note, user):
    contact_note = LeadNote.objects.select_related("contact").get(
        pk=note_id,
        contact__isnull=False,
    )
    if contact_note.contact and not can_access_contact_owner(
        user=user,
        owner_id=contact_note.contact.contact_owner_id,
    ):
        raise LeadNote.DoesNotExist
    contact_note.note = note
    contact_note.save(update_fields=["note"])
    return contact_note


def delete_contact_note(*, note_id, user):
    contact_note = LeadNote.objects.select_related("contact").get(
        pk=note_id,
        contact__isnull=False,
    )
    if contact_note.contact and not can_access_contact_owner(
        user=user,
        owner_id=contact_note.contact.contact_owner_id,
    ):
        raise LeadNote.DoesNotExist
    contact_note.delete()


def create_account_note(*, account, note, created_by=None):
    return LeadNote.objects.create(
        account=account,
        note=note,
        created_by=created_by,
    )


def list_account_notes(*, account):
    return account.notes.select_related("created_by").all()


def update_account_note(*, note_id, note, user):
    account_note = LeadNote.objects.select_related("account").get(
        pk=note_id,
        account__isnull=False,
    )
    if account_note.account and not can_access_account_owner(
        user=user,
        owner_id=account_note.account.account_owner_id,
    ):
        raise LeadNote.DoesNotExist
    account_note.note = note
    account_note.save(update_fields=["note"])
    return account_note


def delete_account_note(*, note_id, user):
    account_note = LeadNote.objects.select_related("account").get(
        pk=note_id,
        account__isnull=False,
    )
    if account_note.account and not can_access_account_owner(
        user=user,
        owner_id=account_note.account.account_owner_id,
    ):
        raise LeadNote.DoesNotExist
    account_note.delete()


def create_deal_note(*, deal, note, created_by=None):
    return LeadNote.objects.create(
        deal=deal,
        note=note,
        created_by=created_by,
    )


def list_deal_notes(*, deal):
    return deal.notes.select_related("created_by").all()


def update_deal_note(*, note_id, note, user):
    deal_note = LeadNote.objects.select_related("deal").get(
        pk=note_id,
        deal__isnull=False,
    )
    if deal_note.deal and not can_access_deal_owner(
        user=user,
        owner_id=deal_note.deal.deal_owner_id,
    ):
        raise LeadNote.DoesNotExist
    deal_note.note = note
    deal_note.save(update_fields=["note"])
    return deal_note


def delete_deal_note(*, note_id, user):
    deal_note = LeadNote.objects.select_related("deal").get(
        pk=note_id,
        deal__isnull=False,
    )
    if deal_note.deal and not can_access_deal_owner(
        user=user,
        owner_id=deal_note.deal.deal_owner_id,
    ):
        raise LeadNote.DoesNotExist
    deal_note.delete()
