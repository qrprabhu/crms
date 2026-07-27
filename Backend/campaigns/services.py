from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from django.db import transaction
from django.db.models import Sum

from activities.models import LeadActivity
from notes.models import LeadNote

from .models import (
    Campaign,
    CampaignActivity,
    CampaignAttachment,
    CampaignContact,
    CampaignDeal,
    CampaignLead,
    CampaignNote,
)
from .permissions import filter_queryset_for_user


@dataclass
class TimelineService:
    def log_event(self, *, campaign: Campaign, action: str, description: str = "", user=None, is_closed=False):
        activity = LeadActivity.objects.create(
            action=action,
            description=description,
            user=user,
        )
        CampaignActivity.objects.create(
            campaign=campaign,
            activity=activity,
            is_closed=is_closed,
        )
        return activity

    def list_events(self, *, campaign: Campaign):
        return LeadActivity.objects.filter(campaign_activity_links__campaign=campaign).select_related("user")


@dataclass
class NotesService:
    def create_note(self, *, campaign: Campaign, note: str, user=None):
        note_obj = LeadNote.objects.create(note=note, created_by=user)
        CampaignNote.objects.create(campaign=campaign, note=note_obj)
        return note_obj

    def list_notes(self, *, campaign: Campaign):
        return LeadNote.objects.filter(campaign_note_links__campaign=campaign).select_related("created_by")


@dataclass
class ActivityService:
    def log_activity(self, *, campaign: Campaign, action: str, description: str = "", user=None, is_closed=False):
        activity = LeadActivity.objects.create(
            action=action,
            description=description,
            user=user,
        )
        CampaignActivity.objects.create(campaign=campaign, activity=activity, is_closed=is_closed)
        return activity


@dataclass
class CampaignService:
    timeline_service: TimelineService = field(default_factory=TimelineService)
    notes_service: NotesService = field(default_factory=NotesService)
    activity_service: ActivityService = field(default_factory=ActivityService)

    def list_campaigns(self, *, user):
        queryset = Campaign.objects.filter(is_active=True).select_related(
            "campaign_owner",
            "parent_campaign",
        )
        return filter_queryset_for_user(queryset, user)

    def get_campaign_detail(self, *, campaign_id: int, user):
        return self.list_campaigns(user=user).get(pk=campaign_id)

    @transaction.atomic
    def create_campaign(self, *, data: dict[str, Any], user) -> Campaign:
        if not data.get("campaign_owner"):
            data["campaign_owner"] = user
        campaign = Campaign.objects.create(**data)
        self.log_activity(
            campaign=campaign,
            action="Campaign created",
            description="Campaign created",
            user=user,
        )
        return campaign

    @transaction.atomic
    def update_campaign(self, *, campaign: Campaign, data: dict[str, Any], user) -> Campaign:
        for field, value in data.items():
            setattr(campaign, field, value)
        campaign.save()
        self.log_activity(
            campaign=campaign,
            action="Campaign updated",
            description="Campaign updated",
            user=user,
        )
        return campaign

    @transaction.atomic
    def delete_campaign(self, *, campaign: Campaign, user) -> Campaign:
        campaign.is_active = False
        campaign.save(update_fields=["is_active", "updated_at"])
        self.log_activity(
            campaign=campaign,
            action="Campaign deleted",
            description="Campaign deleted",
            user=user,
        )
        return campaign

    def get_campaign_stats(self, *, campaign: Campaign) -> dict[str, Any]:
        won_revenue = (
            campaign.campaign_deals.filter(deal__stage__stage_name="Closed Won", is_active=True)
            .aggregate(total=Sum("deal__amount"))
            .get("total")
            or 0
        )
        pipeline = (
            campaign.campaign_deals.exclude(deal__stage__stage_name="Closed Won")
            .filter(is_active=True)
            .aggregate(total=Sum("deal__amount"))
            .get("total")
            or 0
        )
        return {
            "total_leads": CampaignLead.objects.filter(campaign=campaign, is_active=True).count(),
            "total_contacts": CampaignContact.objects.filter(campaign=campaign, is_active=True).count(),
            "revenue": won_revenue,
            "in_pipeline": pipeline,
        }

    @transaction.atomic
    def create_child_campaign(self, *, parent: Campaign, data: dict[str, Any], user) -> Campaign:
        payload = dict(data)
        payload["parent_campaign"] = parent
        if not payload.get("campaign_owner"):
            payload["campaign_owner"] = parent.campaign_owner or user
        child = Campaign.objects.create(**payload)
        self.log_activity(
            campaign=parent,
            action="Campaign updated",
            description=f"Child campaign created: {child.campaign_name}",
            user=user,
        )
        self.log_activity(
            campaign=child,
            action="Campaign created",
            description="Child campaign created",
            user=user,
        )
        return child

    def list_related_leads(self, *, campaign: Campaign):
        return campaign.campaign_leads.select_related("lead").filter(is_active=True)

    def list_related_contacts(self, *, campaign: Campaign):
        return campaign.campaign_contacts.select_related("contact").filter(is_active=True)

    def list_related_deals(self, *, campaign: Campaign):
        return campaign.campaign_deals.select_related("deal", "deal__stage").filter(is_active=True)

    def list_related_activities(self, *, campaign: Campaign):
        return campaign.campaign_activities.select_related("activity", "activity__user").filter(is_active=True)

    @transaction.atomic
    def add_attachment(self, *, campaign: Campaign, file, user) -> CampaignAttachment:
        attachment = CampaignAttachment.objects.create(
            campaign=campaign,
            file=file,
            uploaded_by=user,
        )
        self.log_activity(
            campaign=campaign,
            action="Campaign updated",
            description=f"Attachment uploaded #{attachment.pk}",
            user=user,
        )
        return attachment

    def list_attachments(self, *, campaign: Campaign):
        return campaign.attachments.filter(is_active=True).select_related("uploaded_by")

    @transaction.atomic
    def delete_attachment(self, *, attachment: CampaignAttachment, user):
        attachment.is_active = False
        attachment.save(update_fields=["is_active", "updated_at"])
        self.log_activity(
            campaign=attachment.campaign,
            action="Campaign updated",
            description=f"Attachment deleted #{attachment.pk}",
            user=user,
        )

    def log_activity(self, *, campaign: Campaign, action: str, description: str = "", user=None, is_closed=False):
        return self.activity_service.log_activity(
            campaign=campaign,
            action=action,
            description=description,
            user=user,
            is_closed=is_closed,
        )


campaign_service = CampaignService()
