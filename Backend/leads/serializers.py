from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from core.user_display import get_user_display_name
from integrations.models import IntegrationLeadSourceEvent, SyncedEmailMessage
from .permissions import can_access_lead_owner

from .models import Lead


class LeadOwnerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField(allow_blank=True, allow_null=True)
    name = serializers.CharField()


class LeadLinkedRecordSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class LeadListSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_details = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    latest_activity = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            "id",
            "first_name",
            "last_name",
            "lead_name",
            "company",
            "email",
            "phone",
            "lead_source",
            "owner",
            "owner_email",
            "owner_name",
            "owner_details",
            "created_at",
            "latest_activity",
        ]

    def get_owner_email(self, obj):
        try:
            owner = obj.owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return getattr(owner, "email", str(owner))

    def get_owner_name(self, obj):
        try:
            owner = obj.owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return get_user_display_name(owner)

    def get_owner_details(self, obj):
        try:
            owner = obj.owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return LeadOwnerSerializer(
            {
                "id": obj.owner_id,
                "email": getattr(owner, "email", "") or "",
                "name": get_user_display_name(owner),
            }
        ).data

    def get_lead_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

    def get_latest_activity(self, obj):
        allowed_actions = {"Call logged", "Task created", "Meeting scheduled"}
        activity = next((a for a in obj.activities.all() if a.action in allowed_actions), None)
        if not activity:
            return None
        action = activity.action.lower()
        if "call" in action:
            activity_type = "call"
        elif "task" in action:
            activity_type = "task"
        else:
            activity_type = "meeting"
        return {
            "date": f"{activity.created_at.strftime('%b')} {activity.created_at.day}",
            "type": activity_type,
            "action": activity.action,
        }


class LeadDetailSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_details = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    converted_account_info = serializers.SerializerMethodField()
    converted_contact_info = serializers.SerializerMethodField()
    converted_deal_info = serializers.SerializerMethodField()
    converted_account_name = serializers.SerializerMethodField()
    converted_contact_name = serializers.SerializerMethodField()
    converted_deal_name = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            "id",
            "first_name",
            "last_name",
            "lead_name",
            "company",
            "title",
            "email",
            "phone",
            "mobile",
            "website",
            "lead_source",
            "lead_status",
            "industry",
            "annual_revenue",
            "employee_count",
            "rating",
            "owner",
            "owner_email",
            "owner_name",
            "owner_details",
            "converted_account",
            "converted_account_info",
            "converted_contact",
            "converted_contact_info",
            "converted_deal",
            "converted_deal_info",
            "converted_account_name",
            "converted_contact_name",
            "converted_deal_name",
            "street",
            "city",
            "state",
            "country",
            "zip_code",
            "skype_id",
            "secondary_email",
            "description",
            "tags",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        instance = getattr(self, "instance", None)
        owner = attrs.get("owner", getattr(instance, "owner", None))
        if request and owner and not can_access_lead_owner(user=request.user, owner_id=owner.id):
            raise serializers.ValidationError({"owner": "You cannot assign this owner."})
        return attrs

    def get_owner_email(self, obj):
        try:
            owner = obj.owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return getattr(owner, "email", str(owner))

    def get_owner_name(self, obj):
        try:
            owner = obj.owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return get_user_display_name(owner)

    def get_owner_details(self, obj):
        try:
            owner = obj.owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return LeadOwnerSerializer(
            {
                "id": obj.owner_id,
                "email": getattr(owner, "email", "") or "",
                "name": get_user_display_name(owner),
            }
        ).data

    def get_lead_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

    def get_converted_account_info(self, obj):
        try:
            account = obj.converted_account
        except ObjectDoesNotExist:
            return None
        if not account:
            return None
        return LeadLinkedRecordSerializer({"id": account.id, "name": account.account_name}).data

    def get_converted_contact_info(self, obj):
        try:
            contact = obj.converted_contact
        except ObjectDoesNotExist:
            return None
        if not contact:
            return None
        return LeadLinkedRecordSerializer(
            {"id": contact.id, "name": f"{contact.first_name} {contact.last_name}".strip()}
        ).data

    def get_converted_deal_info(self, obj):
        try:
            deal = obj.converted_deal
        except ObjectDoesNotExist:
            return None
        if not deal:
            return None
        return LeadLinkedRecordSerializer({"id": deal.id, "name": deal.deal_name}).data

    def get_converted_account_name(self, obj):
        if not obj.converted_account:
            return None
        return obj.converted_account.account_name

    def get_converted_contact_name(self, obj):
        if not obj.converted_contact:
            return None
        return f"{obj.converted_contact.first_name} {obj.converted_contact.last_name}".strip()

    def get_converted_deal_name(self, obj):
        if not obj.converted_deal:
            return None
        return obj.converted_deal.deal_name


class LeadCloneResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    lead_id = serializers.IntegerField()


class LeadNoteCreateSerializer(serializers.Serializer):
    note = serializers.CharField()


class LeadConvertRequestSerializer(serializers.Serializer):
    create_deal = serializers.BooleanField(default=False, required=False)
    deal_name = serializers.CharField(required=False, allow_blank=True)
    deal_value = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        required=False,
        allow_null=True,
    )


class LeadConvertResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    account_id = serializers.IntegerField()
    contact_id = serializers.IntegerField()
    deal_id = serializers.IntegerField(allow_null=True, required=False)


class LeadActionSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, required=False, default="")


class LeadCallSerializer(serializers.Serializer):
    call_summary = serializers.CharField(max_length=255)
    call_outcome = serializers.CharField(max_length=255, required=False, allow_blank=True)
    call_type = serializers.ChoiceField(choices=["Outbound", "Inbound"], required=False, default="Outbound")
    call_start_time = serializers.DateTimeField(required=False, allow_null=True, default=None)
    reminder = serializers.CharField(max_length=64, required=False, allow_blank=True, default="None")
    duration_minutes = serializers.IntegerField(required=False, default=0, min_value=0)
    duration_seconds = serializers.IntegerField(required=False, default=0, min_value=0, max_value=59)
    voice_recording = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class LeadMeetingSerializer(serializers.Serializer):
    meeting_subject = serializers.CharField(max_length=255)
    agenda = serializers.CharField(required=False, allow_blank=True)


class LeadSendEmailSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    body = serializers.CharField()
    to_email = serializers.EmailField(required=False, allow_blank=True)


class LeadEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncedEmailMessage
        fields = [
            "id",
            "subject",
            "from_email",
            "to_emails",
            "direction",
            "status",
            "received_at",
            "sent_at",
            "is_read",
        ]


class LeadConnectedRecordSerializer(serializers.ModelSerializer):
    source_label = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationLeadSourceEvent
        fields = [
            "id",
            "source_type",
            "source_label",
            "source_reference",
            "created_at",
        ]

    def get_source_label(self, obj):
        payload = obj.payload or {}
        if obj.source_type == IntegrationLeadSourceEvent.SourceType.EMAIL:
            subject = payload.get("subject")
            from_email = payload.get("from_email")
            direction = payload.get("direction")
            if subject and from_email:
                suffix = "sent" if direction == "outgoing" else "received"
                return f"{subject} ({from_email}, {suffix})"
            if subject:
                return subject
            if from_email:
                return from_email
        return payload.get("source_label") or obj.source_reference


class LeadAddTagsSerializer(serializers.Serializer):
    tags = serializers.ListField(child=serializers.CharField(max_length=50), min_length=1)
