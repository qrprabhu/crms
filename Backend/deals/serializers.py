from typing import Any

from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth import get_user_model
from rest_framework import serializers

from core.user_display import get_user_display_name
from activities.models import LeadActivity
from inventory.models import Product
from notes.models import LeadNote

from .models import Deal, DealProduct, DealStage
from .permissions import can_access_deal_owner

User = get_user_model()


class DealStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = DealStage
        fields = ["id", "stage_name", "probability", "order", "is_closed_stage"]


class DealOwnerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField(allow_blank=True, allow_null=True)
    name = serializers.CharField()


class DealRelationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class DealListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="deal_name", read_only=True)
    owner = serializers.IntegerField(source="deal_owner_id", read_only=True)
    owner_email = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_details = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    account_info = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    contact_info = serializers.SerializerMethodField()
    stage = serializers.CharField(source="stage.stage_name", read_only=True)
    value = serializers.DecimalField(source="expected_revenue", max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = Deal
        fields = [
            "id",
            "name",
            "deal_name",
            "account",
            "account_name",
            "contact",
            "contact_name",
            "deal_owner",
            "owner",
            "owner_email",
            "owner_name",
            "owner_details",
            "amount",
            "expected_revenue",
            "value",
            "stage",
            "probability",
            "closing_date",
            "campaign_source",
            "account_info",
            "contact_info",
            "is_closed",
            "is_won",
            "created_at",
        ]

    def get_owner_email(self, obj: Deal) -> str | None:
        try:
            owner = obj.deal_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return owner.email

    def get_owner_name(self, obj: Deal) -> str | None:
        try:
            owner = obj.deal_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return get_user_display_name(owner)

    def get_owner_details(self, obj: Deal) -> dict[str, Any] | None:
        try:
            owner = obj.deal_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return DealOwnerSerializer(
            {
                "id": obj.deal_owner_id,
                "email": getattr(owner, "email", "") or "",
                "name": get_user_display_name(owner),
            }
        ).data

    def get_account_name(self, obj: Deal) -> str | None:
        try:
            account = obj.account
        except ObjectDoesNotExist:
            return None
        if not account:
            return None
        return account.account_name

    def get_account_info(self, obj: Deal) -> dict[str, Any] | None:
        try:
            account = obj.account
        except ObjectDoesNotExist:
            return None
        if not account:
            return None
        return DealRelationSerializer({"id": obj.account_id, "name": account.account_name}).data

    def get_contact_name(self, obj: Deal) -> str | None:
        try:
            contact = obj.contact
        except ObjectDoesNotExist:
            return None
        if not contact:
            return None
        return f"{contact.first_name} {contact.last_name}".strip()

    def get_contact_info(self, obj: Deal) -> dict[str, Any] | None:
        try:
            contact = obj.contact
        except ObjectDoesNotExist:
            return None
        if not contact:
            return None
        return DealRelationSerializer(
            {"id": obj.contact_id, "name": f"{contact.first_name} {contact.last_name}".strip()}
        ).data


class DealTimelineSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(source="created_at")

    class Meta:
        model = LeadActivity
        fields = ["id", "action", "description", "user", "timestamp"]

    def get_user(self, obj: LeadActivity) -> str | None:
        if not obj.user:
            return None
        return getattr(obj.user, "email", str(obj.user))


class DealNoteSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = LeadNote
        fields = ["id", "note", "created_by", "created_at"]

    def get_created_by(self, obj: LeadNote) -> str | None:
        if not obj.created_by:
            return None
        return getattr(obj.created_by, "email", str(obj.created_by))


class DealDetailSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="deal_name", read_only=True)
    owner = serializers.IntegerField(source="deal_owner_id", read_only=True)
    owner_email = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_details = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    account_info = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    contact_info = serializers.SerializerMethodField()
    stage = serializers.CharField(source="stage.stage_name", read_only=True)
    value = serializers.DecimalField(source="expected_revenue", max_digits=15, decimal_places=2, read_only=True)
    timeline = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    activities = serializers.SerializerMethodField()

    class Meta:
        model = Deal
        fields = [
            "id",
            "name",
            "deal_name",
            "account",
            "account_name",
            "contact",
            "contact_name",
            "lead",
            "deal_owner",
            "owner",
            "owner_email",
            "owner_name",
            "owner_details",
            "amount",
            "expected_revenue",
            "value",
            "stage",
            "probability",
            "closing_date",
            "type",
            "lead_source",
            "campaign_source",
            "next_step",
            "forecast_category",
            "description",
            "account_info",
            "contact_info",
            "is_closed",
            "is_won",
            "timeline",
            "notes",
            "activities",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_owner_email(self, obj: Deal) -> str | None:
        try:
            owner = obj.deal_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return owner.email

    def get_owner_name(self, obj: Deal) -> str | None:
        try:
            owner = obj.deal_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return get_user_display_name(owner)

    def get_owner_details(self, obj: Deal) -> dict[str, Any] | None:
        try:
            owner = obj.deal_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return DealOwnerSerializer(
            {
                "id": obj.deal_owner_id,
                "email": getattr(owner, "email", "") or "",
                "name": get_user_display_name(owner),
            }
        ).data

    def get_account_name(self, obj: Deal) -> str | None:
        try:
            account = obj.account
        except ObjectDoesNotExist:
            return None
        if not account:
            return None
        return account.account_name

    def get_account_info(self, obj: Deal) -> dict[str, Any] | None:
        try:
            account = obj.account
        except ObjectDoesNotExist:
            return None
        if not account:
            return None
        return DealRelationSerializer({"id": obj.account_id, "name": account.account_name}).data

    def get_contact_name(self, obj: Deal) -> str | None:
        try:
            contact = obj.contact
        except ObjectDoesNotExist:
            return None
        if not contact:
            return None
        return f"{contact.first_name} {contact.last_name}".strip()

    def get_contact_info(self, obj: Deal) -> dict[str, Any] | None:
        try:
            contact = obj.contact
        except ObjectDoesNotExist:
            return None
        if not contact:
            return None
        return DealRelationSerializer(
            {"id": obj.contact_id, "name": f"{contact.first_name} {contact.last_name}".strip()}
        ).data

    def get_timeline(self, obj: Deal):
        activities = getattr(obj, "_prefetched_objects_cache", {}).get("activities")
        if activities is None:
            activities = obj.activities.select_related("user").all()
        return DealTimelineSerializer(activities, many=True).data

    def get_notes(self, obj: Deal):
        notes = getattr(obj, "_prefetched_objects_cache", {}).get("notes")
        if notes is None:
            notes = obj.notes.select_related("created_by").all()
        return DealNoteSerializer(notes, many=True).data

    def get_activities(self, obj: Deal):
        activities = getattr(obj, "_prefetched_objects_cache", {}).get("activities")
        if activities is None:
            activities = obj.activities.select_related("user").all()
        return DealTimelineSerializer(activities, many=True).data


class DealWriteSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="deal_name", required=False)
    owner = serializers.PrimaryKeyRelatedField(
        source="deal_owner",
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    value = serializers.DecimalField(
        source="expected_revenue",
        max_digits=15,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    stage = serializers.SlugRelatedField(
        slug_field="stage_name",
        queryset=DealStage.objects.all(),
        required=False,
    )

    class Meta:
        model = Deal
        fields = [
            "deal_owner",
            "owner",
            "deal_name",
            "name",
            "account",
            "contact",
            "lead",
            "amount",
            "expected_revenue",
            "value",
            "stage",
            "probability",
            "closing_date",
            "type",
            "lead_source",
            "campaign_source",
            "next_step",
            "forecast_category",
            "description",
        ]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        request = self.context.get("request")
        instance = getattr(self, "instance", None)

        deal_name = attrs.get("deal_name", getattr(instance, "deal_name", None))
        if not deal_name:
            raise serializers.ValidationError({"deal_name": "deal_name is required."})

        account = attrs.get("account", getattr(instance, "account", None))
        if not account:
            raise serializers.ValidationError({"account": "account is required."})

        contact = attrs.get("contact", getattr(instance, "contact", None))
        if not contact:
            raise serializers.ValidationError({"contact": "contact is required."})
        if contact.account_id and contact.account_id != account.id:
            raise serializers.ValidationError(
                {"contact": "Selected contact must belong to the selected account."}
            )

        owner = attrs.get("deal_owner", getattr(instance, "deal_owner", None))
        if request and owner and not can_access_deal_owner(user=request.user, owner_id=owner.id):
            raise serializers.ValidationError({"deal_owner": "You cannot assign this owner."})

        probability = attrs.get("probability")
        if probability is not None and (probability < 0 or probability > 100):
            raise serializers.ValidationError({"probability": "Probability must be between 0 and 100."})
        return attrs


class DealStageUpdateSerializer(serializers.Serializer):
    stage = serializers.SlugRelatedField(
        slug_field="stage_name",
        queryset=DealStage.objects.all(),
    )


class DealMassDeleteSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class DealMassUpdateSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    payload = serializers.DictField()


class DealActionSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, required=False, default="")


class DealCallSerializer(serializers.Serializer):
    call_summary = serializers.CharField(max_length=255)
    call_outcome = serializers.CharField(max_length=255, required=False, allow_blank=True)


class DealMeetingSerializer(serializers.Serializer):
    meeting_subject = serializers.CharField(max_length=255)
    agenda = serializers.CharField(required=False, allow_blank=True)


class DealPipelineCardSerializer(serializers.Serializer):
    deal_id = serializers.IntegerField()
    deal_name = serializers.CharField()
    account_name = serializers.CharField(allow_null=True)
    contact_name = serializers.CharField(allow_null=True)
    owner = serializers.CharField(allow_null=True)
    amount = serializers.DecimalField(max_digits=15, decimal_places=2, allow_null=True)
    closing_date = serializers.DateField(allow_null=True)
    stage = serializers.CharField()
    probability = serializers.IntegerField(allow_null=True)


class DealNoteCreateSerializer(serializers.Serializer):
    note = serializers.CharField()


class DealProductSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.product_name", read_only=True)
    product_code = serializers.CharField(source="product.product_code", read_only=True)

    class Meta:
        model = DealProduct
        fields = [
            "id",
            "product",
            "product_name",
            "product_code",
            "quantity",
            "unit_price",
            "discount",
            "total_price",
            "created_at",
        ]
        read_only_fields = ["total_price", "created_at"]


class DealProductCreateSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(is_active=True))

    class Meta:
        model = DealProduct
        fields = ["product", "quantity", "unit_price", "discount"]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0.")
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit price must be 0 or more.")
        return value

    def validate_discount(self, value):
        if value < 0:
            raise serializers.ValidationError("Discount must be 0 or more.")
        return value
