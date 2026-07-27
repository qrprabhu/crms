from django.conf import settings
from django.db import models

from core.base_models import BaseModel


class Campaign(BaseModel):
    campaign_name = models.CharField(max_length=255, db_index=True)
    campaign_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_campaigns",
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=100, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True, db_index=True)
    end_date = models.DateField(blank=True, null=True)
    expected_revenue = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    budgeted_cost = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    actual_cost = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    expected_response = models.PositiveIntegerField(blank=True, null=True)
    numbers_sent = models.PositiveIntegerField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    parent_campaign = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="child_campaigns",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["campaign_name"]),
            models.Index(fields=["campaign_owner"]),
            models.Index(fields=["start_date"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.campaign_name


class CampaignLead(BaseModel):
    campaign = models.ForeignKey("campaigns.Campaign", on_delete=models.CASCADE, related_name="campaign_leads")
    lead = models.ForeignKey("leads.Lead", on_delete=models.CASCADE, related_name="lead_campaign_links")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["campaign", "lead"], name="campaign_lead_unique"),
        ]


class CampaignContact(BaseModel):
    campaign = models.ForeignKey("campaigns.Campaign", on_delete=models.CASCADE, related_name="campaign_contacts")
    contact = models.ForeignKey("contacts.Contact", on_delete=models.CASCADE, related_name="contact_campaign_links")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["campaign", "contact"], name="campaign_contact_unique"),
        ]


class CampaignDeal(BaseModel):
    campaign = models.ForeignKey("campaigns.Campaign", on_delete=models.CASCADE, related_name="campaign_deals")
    deal = models.ForeignKey("deals.Deal", on_delete=models.CASCADE, related_name="deal_campaign_links")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["campaign", "deal"], name="campaign_deal_unique"),
        ]


class CampaignNote(BaseModel):
    campaign = models.ForeignKey("campaigns.Campaign", on_delete=models.CASCADE, related_name="campaign_notes")
    note = models.ForeignKey("notes.LeadNote", on_delete=models.CASCADE, related_name="campaign_note_links")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["campaign", "note"], name="campaign_note_unique"),
        ]


class CampaignActivity(BaseModel):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        on_delete=models.CASCADE,
        related_name="campaign_activities",
    )
    activity = models.ForeignKey(
        "activities.LeadActivity",
        on_delete=models.CASCADE,
        related_name="campaign_activity_links",
    )
    is_closed = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["campaign", "activity"], name="campaign_activity_unique"),
        ]


class CampaignAttachment(BaseModel):
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to="campaigns/")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="campaign_attachments",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["campaign", "created_at"]),
        ]


class CampaignSubmission(models.Model):
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True, null=True)
    company = models.CharField(max_length=255, blank=True, null=True)
    website = models.URLField(max_length=500, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    source = models.CharField(max_length=100, blank=True, null=True)
    is_converted = models.BooleanField(default=False, db_index=True)
    converted_lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaign_submissions",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["campaign", "submitted_at"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"

