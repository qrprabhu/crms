from .models import LeadActivity


def create_lead_activity(*, lead, action, description="", user=None):
    return LeadActivity.objects.create(
        lead=lead,
        action=action,
        description=description,
        user=user,
    )


def create_contact_activity(*, contact, action, description="", user=None):
    return LeadActivity.objects.create(
        contact=contact,
        action=action,
        description=description,
        user=user,
    )


def create_account_activity(*, account, action, description="", user=None):
    return LeadActivity.objects.create(
        account=account,
        action=action,
        description=description,
        user=user,
    )


def create_deal_activity(*, deal, action, description="", user=None):
    return LeadActivity.objects.create(
        deal=deal,
        action=action,
        description=description,
        user=user,
    )
