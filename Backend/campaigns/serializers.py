from typing import Any

from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework import serializers

from activities.models import LeadActivity
from contacts.models import Contact
from deals.models import Deal
from leads.models import Lead
from notes.models import LeadNote

from .models import (
    Campaign,
    CampaignActivity,
    CampaignAttachment,
    CampaignContact,
    CampaignDeal,
    CampaignLead,
    CampaignNote,
    CampaignSubmission,
)
from .permissions import can_access_campaign_owner

User = get_user_model()


class CampaignOwnerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()


class CampaignListSerializer(serializers.ModelSerializer):
    owner = serializers.IntegerField(source="campaign_owner_id", read_only=True)
    owner_email = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id",
            "campaign_name",
            "type",
            "status",
            "start_date",
            "end_date",
            "campaign_owner",
            "owner",
            "owner_email",
            "created_at",
        ]

    def get_owner_email(self, obj: Campaign) -> str | None:
        try:
            owner = obj.campaign_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return owner.email


class CampaignStatsSerializer(serializers.Serializer):
    total_leads = serializers.IntegerField()
    total_contacts = serializers.IntegerField()
    revenue = serializers.DecimalField(max_digits=15, decimal_places=2)
    in_pipeline = serializers.DecimalField(max_digits=15, decimal_places=2)


class CampaignDetailSerializer(serializers.ModelSerializer):
    owner = serializers.IntegerField(source="campaign_owner_id", read_only=True)
    owner_info = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id",
            "campaign_name",
            "campaign_owner",
            "owner",
            "owner_info",
            "type",
            "status",
            "start_date",
            "end_date",
            "expected_revenue",
            "budgeted_cost",
            "actual_cost",
            "expected_response",
            "numbers_sent",
            "description",
            "parent_campaign",
            "is_active",
            "created_at",
            "updated_at",
            "stats",
        ]

    def get_owner_info(self, obj: Campaign) -> dict[str, Any] | None:
        try:
            owner = obj.campaign_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return CampaignOwnerSerializer({"id": obj.campaign_owner_id, "email": owner.email}).data

    def get_stats(self, obj: Campaign) -> dict[str, Any]:
        won_total = (
            Deal.objects.filter(deal_campaign_links__campaign=obj, stage__stage_name="Closed Won", is_active=True)
            .aggregate(total=Sum("amount"))
            .get("total")
            or 0
        )
        pipeline_total = (
            Deal.objects.filter(deal_campaign_links__campaign=obj, is_active=True)
            .exclude(stage__stage_name="Closed Won")
            .aggregate(total=Sum("amount"))
            .get("total")
            or 0
        )
        return CampaignStatsSerializer(
            {
                "total_leads": CampaignLead.objects.filter(campaign=obj, is_active=True).count(),
                "total_contacts": CampaignContact.objects.filter(campaign=obj, is_active=True).count(),
                "revenue": won_total,
                "in_pipeline": pipeline_total,
            }
        ).data


class CampaignWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            "campaign_owner",
            "campaign_name",
            "type",
            "status",
            "start_date",
            "end_date",
            "expected_revenue",
            "budgeted_cost",
            "actual_cost",
            "expected_response",
            "numbers_sent",
            "description",
            "parent_campaign",
        ]

    def validate_campaign_name(self, value: str) -> str:
        if not value or not value.strip():
            raise serializers.ValidationError("campaign_name is required.")
        return value.strip()

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        request = self.context.get("request")
        instance = getattr(self, "instance", None)
        start_date = attrs.get("start_date", getattr(instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "end_date must be on or after start_date."})

        owner = attrs.get("campaign_owner", getattr(instance, "campaign_owner", None))
        if request and owner and not can_access_campaign_owner(user=request.user, owner_id=owner.id):
            raise serializers.ValidationError({"campaign_owner": "You cannot assign this owner."})
        return attrs


class CampaignCreateChildSerializer(serializers.Serializer):
    campaign_name = serializers.CharField(max_length=255)
    type = serializers.CharField(max_length=100, required=False, allow_blank=True)
    status = serializers.CharField(max_length=100, required=False, allow_blank=True)
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)


class CampaignNoteCreateSerializer(serializers.Serializer):
    note = serializers.CharField()


class CampaignTimelineSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(source="created_at")

    class Meta:
        model = LeadActivity
        fields = ["id", "action", "description", "user", "timestamp"]

    def get_user(self, obj: LeadActivity) -> str | None:
        if not obj.user:
            return None
        return obj.user.email


class CampaignNoteSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = LeadNote
        fields = ["id", "note", "created_by", "created_at"]

    def get_created_by(self, obj: LeadNote) -> str | None:
        if not obj.created_by:
            return None
        return obj.created_by.email


class CampaignLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = ["id", "first_name", "last_name", "company", "email", "phone", "lead_status", "created_at"]


class CampaignContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ["id", "first_name", "last_name", "email", "phone", "mobile", "created_at"]


class CampaignDealSerializer(serializers.ModelSerializer):
    stage = serializers.CharField(source="stage.stage_name", read_only=True)

    class Meta:
        model = Deal
        fields = ["id", "deal_name", "amount", "expected_revenue", "stage", "closing_date", "created_at"]


class CampaignAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.SerializerMethodField()

    class Meta:
        model = CampaignAttachment
        fields = ["id", "file", "uploaded_by", "uploaded_by_email", "created_at"]

    def get_uploaded_by_email(self, obj: CampaignAttachment) -> str | None:
        if not obj.uploaded_by:
            return None
        return obj.uploaded_by.email


class CampaignAttachmentCreateSerializer(serializers.Serializer):
    file = serializers.FileField()


class CampaignActivityActionSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)


class CampaignLogCallSerializer(serializers.Serializer):
    call_summary = serializers.CharField(max_length=255)
    call_outcome = serializers.CharField(max_length=255, required=False, allow_blank=True)


class CampaignScheduleMeetingSerializer(serializers.Serializer):
    meeting_subject = serializers.CharField(max_length=255)
    agenda = serializers.CharField(required=False, allow_blank=True)


# ── Campaign Submission serializers ────────────────────────────────────────

class CampaignSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignSubmission
        fields = [
            "id",
            "campaign",
            "first_name",
            "last_name",
            "email",
            "phone",
            "company",
            "website",
            "notes",
            "source",
            "is_converted",
            "converted_lead",
            "submitted_at",
        ]
        read_only_fields = ["id", "campaign", "is_converted", "converted_lead", "submitted_at"]


class CampaignPublicSubmitSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    company = serializers.CharField(max_length=255, required=False, allow_blank=True)
    website = serializers.URLField(required=False, allow_blank=True, max_length=500)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_phone(self, value: str) -> str:
        if not value:
            return value
        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")
        return value


class BulkConvertSerializer(serializers.Serializer):
    submission_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
    )

