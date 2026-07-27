from typing import Any

from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth import get_user_model
from rest_framework import serializers

from core.user_display import get_user_display_name
from activities.models import LeadActivity
from contacts.models import Contact
from deals.models import Deal
from notes.models import LeadNote

from .models import Account, AccountAttachment
from .permissions import can_access_account_owner

User = get_user_model()


class AccountOwnerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    name = serializers.CharField()


class AccountListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="account_name", read_only=True)
    owner = serializers.IntegerField(source="account_owner_id", read_only=True)
    owner_email = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_details = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            "id",
            "name",
            "account_name",
            "phone",
            "website",
            "account_owner",
            "owner",
            "owner_email",
            "owner_name",
            "owner_details",
            "industry",
            "created_at",
        ]

    def get_owner_details(self, obj: Account) -> dict[str, Any] | None:
        try:
            owner = obj.account_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return AccountOwnerSerializer(
            {
                "id": obj.account_owner_id,
                "email": owner.email,
                "name": get_user_display_name(owner),
            }
        ).data

    def get_owner_email(self, obj: Account) -> str | None:
        try:
            owner = obj.account_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return owner.email

    def get_owner_name(self, obj: Account) -> str | None:
        try:
            owner = obj.account_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return get_user_display_name(owner)


class AccountDetailSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="account_name", read_only=True)
    owner = serializers.IntegerField(source="account_owner_id", read_only=True)
    owner_email = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_details = serializers.SerializerMethodField()
    employee_count = serializers.IntegerField(source="employees", read_only=True)
    street = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()
    country = serializers.SerializerMethodField()
    zip_code = serializers.SerializerMethodField()
    contacts_count = serializers.SerializerMethodField()
    deals_count = serializers.SerializerMethodField()
    activities_count = serializers.SerializerMethodField()
    notes_count = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            "id",
            "account_owner",
            "owner",
            "owner_email",
            "owner_name",
            "owner_details",
            "name",
            "account_name",
            "account_number",
            "account_type",
            "account_site",
            "parent_account",
            "industry",
            "annual_revenue",
            "employees",
            "employee_count",
            "sic_code",
            "ownership",
            "rating",
            "phone",
            "fax",
            "website",
            "ticker_symbol",
            "billing_address",
            "shipping_address",
            "description",
            "image",
            "street",
            "city",
            "state",
            "country",
            "zip_code",
            "contacts_count",
            "deals_count",
            "activities_count",
            "notes_count",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_owner_details(self, obj: Account) -> dict[str, Any] | None:
        try:
            owner = obj.account_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return AccountOwnerSerializer(
            {
                "id": obj.account_owner_id,
                "email": owner.email,
                "name": get_user_display_name(owner),
            }
        ).data

    def get_owner_email(self, obj: Account) -> str | None:
        try:
            owner = obj.account_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return owner.email

    def get_owner_name(self, obj: Account) -> str | None:
        try:
            owner = obj.account_owner
        except ObjectDoesNotExist:
            return None
        if not owner:
            return None
        return get_user_display_name(owner)

    def get_contacts_count(self, obj: Account) -> int:
        return getattr(obj, "contacts_count", None) or obj.contacts.filter(is_active=True).count()

    def get_deals_count(self, obj: Account) -> int:
        return getattr(obj, "deals_count", None) or obj.deals.count()

    def get_activities_count(self, obj: Account) -> int:
        return getattr(obj, "activities_count", None) or obj.activities.count()

    def get_notes_count(self, obj: Account) -> int:
        return getattr(obj, "notes_count", None) or obj.notes.count()

    def get_street(self, obj: Account):
        return None

    def get_city(self, obj: Account):
        return None

    def get_state(self, obj: Account):
        return None

    def get_country(self, obj: Account):
        return None

    def get_zip_code(self, obj: Account):
        return None


class AccountWriteSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="account_name", required=False)
    owner = serializers.PrimaryKeyRelatedField(
        source="account_owner",
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    employee_count = serializers.IntegerField(source="employees", required=False, allow_null=True)

    class Meta:
        model = Account
        fields = [
            "account_owner",
            "owner",
            "name",
            "account_name",
            "account_number",
            "account_type",
            "account_site",
            "parent_account",
            "industry",
            "annual_revenue",
            "employees",
            "employee_count",
            "sic_code",
            "ownership",
            "rating",
            "phone",
            "fax",
            "website",
            "ticker_symbol",
            "billing_address",
            "shipping_address",
            "description",
        ]

    def validate_account_name(self, value: str) -> str:
        if not value or not value.strip():
            raise serializers.ValidationError("account_name is required.")
        return value.strip()

    def validate(self, attrs):
        request = self.context.get("request")
        instance = getattr(self, "instance", None)
        account_name = attrs.get("account_name", getattr(instance, "account_name", None))
        if not account_name:
            raise serializers.ValidationError({"account_name": "account_name is required."})
        owner = attrs.get("account_owner", getattr(instance, "account_owner", None))
        if request and owner and not can_access_account_owner(user=request.user, owner_id=owner.id):
            raise serializers.ValidationError({"account_owner": "You cannot assign this owner."})
        return attrs


class AccountCloneResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    account_id = serializers.IntegerField()


class AccountMergeSerializer(serializers.Serializer):
    target_account_id = serializers.IntegerField()
    source_account_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
    )


class AccountNoteCreateSerializer(serializers.Serializer):
    note = serializers.CharField()


class AccountTimelineSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(source="created_at")

    class Meta:
        model = LeadActivity
        fields = ["id", "action", "description", "user", "timestamp"]

    def get_user(self, obj: LeadActivity) -> str | None:
        if not obj.user:
            return None
        return getattr(obj.user, "email", str(obj.user))


class AccountNoteSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = LeadNote
        fields = ["id", "note", "created_by", "created_at"]

    def get_created_by(self, obj: LeadNote) -> str | None:
        if not obj.created_by:
            return None
        return getattr(obj.created_by, "email", str(obj.created_by))


class RelatedContactSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = ["id", "first_name", "last_name", "name", "email", "phone", "mobile"]

    def get_name(self, obj: Contact) -> str:
        return f"{obj.first_name} {obj.last_name}".strip()


class RelatedDealSerializer(serializers.ModelSerializer):
    stage = serializers.CharField(source="stage.stage_name", read_only=True)
    value = serializers.DecimalField(source="expected_revenue", max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = Deal
        fields = ["id", "name", "stage", "value", "amount", "created_at"]


class AccountAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.SerializerMethodField()

    class Meta:
        model = AccountAttachment
        fields = ["id", "file", "uploaded_by", "uploaded_by_email", "created_at"]
        read_only_fields = ["uploaded_by", "created_at"]

    def get_uploaded_by_email(self, obj: AccountAttachment) -> str | None:
        if not obj.uploaded_by:
            return None
        return obj.uploaded_by.email


class AccountAttachmentCreateSerializer(serializers.Serializer):
    file = serializers.FileField()


class AccountImageUploadSerializer(serializers.Serializer):
    image = serializers.FileField()


class AccountActionSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, required=False, default="")


class AccountLogCallSerializer(serializers.Serializer):
    call_summary = serializers.CharField(max_length=255)
    call_outcome = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AccountMeetingSerializer(serializers.Serializer):
    meeting_subject = serializers.CharField(max_length=255)
    agenda = serializers.CharField(required=False, allow_blank=True)


class AccountSendEmailSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    body = serializers.CharField()
    to_email = serializers.EmailField(required=False, allow_blank=True)
