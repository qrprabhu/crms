from __future__ import annotations

from pathlib import Path

from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.models import Account
from contacts.models import Contact
from deals.models import Deal
from inventory.models import Product, Vendor
from leads.models import Lead

from .models import (
    SupportActivity,
    SupportAttachment,
    SupportCase,
    SupportComment,
    SupportEmailLog,
    SupportImportJob,
    SupportLinkedRecord,
    SupportNote,
    SupportSolution,
    SupportTimelineEntry,
)
from .services import list_timeline

User = get_user_model()


def _active_queryset(model):
    # Some related models (e.g., Lead) do not have an `is_active` flag.
    if any(field.name == "is_active" for field in model._meta.fields):
        return model.objects.filter(is_active=True)
    return model.objects.all()


class SupportUserSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()


class SupportNoteSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = SupportNote
        fields = ["id", "note", "created_by", "created_by_email", "created_at", "updated_at"]
        read_only_fields = ["created_by", "created_by_email", "created_at", "updated_at"]

    def validate_note(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", None) if obj.created_by else None


class SupportCommentSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = SupportComment
        fields = ["id", "comment", "created_by", "created_by_email", "created_at", "updated_at"]
        read_only_fields = ["created_by", "created_by_email", "created_at", "updated_at"]

    def validate_comment(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", None) if obj.created_by else None


class SupportAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = SupportAttachment
        fields = [
            "id",
            "file",
            "file_name",
            "original_name",
            "file_type",
            "uploaded_by",
            "uploaded_by_email",
            "created_at",
        ]
        read_only_fields = ["uploaded_by", "uploaded_by_email", "created_at", "original_name", "file_type"]

    def get_uploaded_by_email(self, obj):
        return getattr(obj.uploaded_by, "email", None) if obj.uploaded_by else None

    def get_file_name(self, obj):
        return Path(obj.file.name).name if obj.file else obj.original_name


class SupportTimelineSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = SupportTimelineEntry
        fields = ["id", "module_type", "record_id", "action_type", "message", "metadata", "created_by", "created_by_email", "timestamp"]

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", None) if obj.created_by else None


class SupportLinkedRecordSerializer(serializers.ModelSerializer):
    account_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    vendor_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()

    class Meta:
        model = SupportLinkedRecord
        fields = [
            "id",
            "account",
            "account_name",
            "contact",
            "contact_name",
            "deal",
            "deal_name",
            "product",
            "product_name",
            "vendor",
            "vendor_name",
            "lead",
            "lead_name",
            "relationship_label",
            "metadata",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        targets = [
            attrs.get("account"),
            attrs.get("contact"),
            attrs.get("deal"),
            attrs.get("product"),
            attrs.get("vendor"),
            attrs.get("lead"),
        ]
        if not any(targets):
            raise serializers.ValidationError({"non_field_errors": ["At least one linked record is required."]})
        return attrs

    def get_account_name(self, obj):
        return obj.account.account_name if obj.account else None

    def get_contact_name(self, obj):
        return f"{obj.contact.first_name} {obj.contact.last_name}".strip() if obj.contact else None

    def get_deal_name(self, obj):
        return obj.deal.deal_name if obj.deal else None

    def get_product_name(self, obj):
        return obj.product.product_name if obj.product else None

    def get_vendor_name(self, obj):
        return obj.vendor.vendor_name if obj.vendor else None

    def get_lead_name(self, obj):
        return f"{obj.lead.first_name} {obj.lead.last_name}".strip() if obj.lead else None


class SupportActivitySerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = SupportActivity
        fields = ["id", "action", "description", "is_closed", "created_by", "created_by_email", "created_at", "updated_at"]
        read_only_fields = ["created_by", "created_by_email", "created_at", "updated_at"]

    def validate_action(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", None) if obj.created_by else None


class SupportEmailLogSerializer(serializers.ModelSerializer):
    sent_by_email = serializers.SerializerMethodField()

    class Meta:
        model = SupportEmailLog
        fields = ["id", "to_email", "subject", "body", "sent_by", "sent_by_email", "created_at", "updated_at"]
        read_only_fields = ["sent_by", "sent_by_email", "created_at", "updated_at"]

    def get_sent_by_email(self, obj):
        return getattr(obj.sent_by, "email", None) if obj.sent_by else None


class SupportCaseListSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    related_contact_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()

    class Meta:
        model = SupportCase
        fields = [
            "id",
            "case_number",
            "subject",
            "status",
            "priority",
            "case_origin",
            "case_reason",
            "type",
            "owner",
            "owner_email",
            "product",
            "product_name",
            "related_contact",
            "related_contact_name",
            "lead",
            "lead_name",
            "account",
            "account_name",
            "deal",
            "deal_name",
            "company",
            "country",
            "email",
            "phone",
            "created_at",
            "updated_at",
            "last_activity_at",
        ]

    def get_owner_email(self, obj):
        return getattr(obj.owner, "email", None) if obj.owner else None

    def get_account_name(self, obj):
        return obj.account.account_name if obj.account else None

    def get_related_contact_name(self, obj):
        return f"{obj.related_contact.first_name} {obj.related_contact.last_name}".strip() if obj.related_contact else None

    def get_deal_name(self, obj):
        return obj.deal.deal_name if obj.deal else None

    def get_product_name(self, obj):
        return obj.product.product_name if obj.product else None

    def get_lead_name(self, obj):
        if obj.lead:
            return f"{obj.lead.first_name} {obj.lead.last_name}".strip()
        return obj.lead_name


class SupportCaseWriteSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(User), required=False, allow_null=True)
    product = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(Product), required=False, allow_null=True)
    related_contact = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(Contact), required=False, allow_null=True)
    account = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(Account), required=False, allow_null=True)
    deal = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(Deal), required=False, allow_null=True)
    lead = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(Lead), required=False, allow_null=True)

    class Meta:
        model = SupportCase
        fields = [
            "subject",
            "status",
            "priority",
            "case_origin",
            "case_reason",
            "type",
            "description",
            "internal_comments",
            "solution_text",
            "reported_by",
            "email",
            "company",
            "country",
            "phone",
            "lead_name",
            "lead_source",
            "owner",
            "product",
            "related_contact",
            "account",
            "deal",
            "lead",
        ]

    def validate_subject(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Subject is required.")
        return value


class SupportCaseDetailSerializer(SupportCaseListSerializer):
    notes = SupportNoteSerializer(many=True, read_only=True)
    comments = SupportCommentSerializer(many=True, read_only=True)
    attachments = SupportAttachmentSerializer(many=True, read_only=True)
    timeline = serializers.SerializerMethodField()
    linked_records = SupportLinkedRecordSerializer(many=True, read_only=True)
    open_activities = serializers.SerializerMethodField()
    closed_activities = serializers.SerializerMethodField()
    emails = SupportEmailLogSerializer(many=True, read_only=True, source="email_logs")
    related_summary = serializers.SerializerMethodField()

    class Meta(SupportCaseListSerializer.Meta):
        fields = SupportCaseListSerializer.Meta.fields + [
            "description",
            "internal_comments",
            "solution_text",
            "reported_by",
            "lead_name",
            "lead_source",
            "no_of_comments",
            "created_by",
            "updated_by",
            "notes",
            "comments",
            "attachments",
            "timeline",
            "linked_records",
            "open_activities",
            "closed_activities",
            "emails",
            "related_summary",
            "is_active",
        ]

    def get_timeline(self, obj):
        entries = list_timeline("case", obj.pk)
        return SupportTimelineSerializer(entries, many=True).data

    def get_open_activities(self, obj):
        return SupportActivitySerializer(obj.activities.filter(is_closed=False), many=True).data

    def get_closed_activities(self, obj):
        return SupportActivitySerializer(obj.activities.filter(is_closed=True), many=True).data

    def get_related_summary(self, obj):
        return {
            "notes": obj.notes.count(),
            "comments": obj.comments.count(),
            "attachments": obj.attachments.count(),
            "timeline": list_timeline("case", obj.pk).count(),
            "linked_records": obj.linked_records.count(),
            "open_activities": obj.activities.filter(is_closed=False).count(),
            "closed_activities": obj.activities.filter(is_closed=True).count(),
            "emails": obj.email_logs.count(),
        }


class SupportSolutionListSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    source_case_number = serializers.SerializerMethodField()

    class Meta:
        model = SupportSolution
        fields = [
            "id",
            "solution_number",
            "solution_title",
            "status",
            "question",
            "owner",
            "owner_email",
            "source_case",
            "source_case_number",
            "product",
            "product_name",
            "no_of_comments",
            "created_at",
            "updated_at",
            "last_activity_at",
        ]

    def get_owner_email(self, obj):
        return getattr(obj.owner, "email", None) if obj.owner else None

    def get_source_case_number(self, obj):
        return obj.source_case.case_number if obj.source_case else None

    def get_product_name(self, obj):
        return obj.product.product_name if obj.product else None


class SupportSolutionWriteSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(User), required=False, allow_null=True)
    source_case = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(SupportCase), required=False, allow_null=True)
    product = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(Product), required=False, allow_null=True)

    class Meta:
        model = SupportSolution
        fields = ["solution_title", "status", "question", "answer", "resolution_steps", "owner", "source_case", "product"]

    def validate_solution_title(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Solution title is required.")
        return value

    def validate_question(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Question is required.")
        return value

    def validate_answer(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Answer is required.")
        return value

    def validate_resolution_steps(self, value):
        value = (value or "").strip()
        return value or None


class SupportSolutionDetailSerializer(SupportSolutionListSerializer):
    answer = serializers.CharField(read_only=True)
    resolution_steps = serializers.CharField(read_only=True)
    notes = SupportNoteSerializer(many=True, read_only=True)
    comments = SupportCommentSerializer(many=True, read_only=True)
    attachments = SupportAttachmentSerializer(many=True, read_only=True)
    timeline = serializers.SerializerMethodField()
    linked_records = SupportLinkedRecordSerializer(many=True, read_only=True)
    related_summary = serializers.SerializerMethodField()

    class Meta(SupportSolutionListSerializer.Meta):
        fields = SupportSolutionListSerializer.Meta.fields + [
            "answer",
            "resolution_steps",
            "created_by",
            "updated_by",
            "notes",
            "comments",
            "attachments",
            "timeline",
            "linked_records",
            "related_summary",
            "is_active",
        ]

    def get_timeline(self, obj):
        entries = list_timeline("solution", obj.pk)
        return SupportTimelineSerializer(entries, many=True).data

    def get_related_summary(self, obj):
        return {
            "notes": obj.notes.count(),
            "comments": obj.comments.count(),
            "attachments": obj.attachments.count(),
            "timeline": list_timeline("solution", obj.pk).count(),
            "linked_records": obj.linked_records.count(),
        }


class SupportImportUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    operation = serializers.ChoiceField(choices=["add", "update", "both"], required=False, default="add")
    duplicate_check_field = serializers.CharField(required=False, allow_blank=True)


class SupportImportInspectSerializer(serializers.Serializer):
    job_id = serializers.IntegerField()


class SupportImportExecuteSerializer(serializers.Serializer):
    job_id = serializers.IntegerField()
    operation = serializers.ChoiceField(choices=["add", "update", "both"])
    field_mapping = serializers.DictField(child=serializers.CharField(), allow_empty=False)
    default_values = serializers.DictField(required=False, default=dict)
    duplicate_check_field = serializers.CharField(required=False, allow_blank=True)
    automation_enabled = serializers.BooleanField(required=False, default=False)


class SupportImportJobSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.SerializerMethodField()

    class Meta:
        model = SupportImportJob
        fields = [
            "id",
            "module_type",
            "original_name",
            "file_type",
            "operation",
            "duplicate_check_field",
            "status",
            "uploaded_by",
            "uploaded_by_email",
            "headers",
            "sample_rows",
            "field_mapping",
            "default_values",
            "automation_enabled",
            "validation_errors",
            "imported_count",
            "updated_count",
            "skipped_count",
            "error_count",
            "result_summary",
            "created_at",
            "updated_at",
        ]

    def get_uploaded_by_email(self, obj):
        return getattr(obj.uploaded_by, "email", None) if obj.uploaded_by else None


class SupportLookupSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    label = serializers.CharField()
    email = serializers.EmailField(required=False, allow_null=True)
    phone = serializers.CharField(required=False, allow_null=True)
    account_id = serializers.IntegerField(required=False, allow_null=True)
    account_name = serializers.CharField(required=False, allow_null=True)
    product_code = serializers.CharField(required=False, allow_null=True)
    unit_price = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)


class SupportQuickCreateProductSerializer(serializers.ModelSerializer):
    vendor = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(Vendor), required=False, allow_null=True)
    owner = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(User), required=False, allow_null=True)

    class Meta:
        model = Product
        fields = ["product_name", "product_code", "vendor", "unit_price", "tax", "owner"]

    def validate_product_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def validate_product_code(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value
