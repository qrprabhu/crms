from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from accounts.models import Account
from contacts.models import Contact
from deals.models import Deal
from leads.models import Lead

from .models import (
    ConfiguratorRule,
    Invoice,
    InvoiceItem,
    InventoryActivity,
    InventoryAttachment,
    InventoryEmailLog,
    InventoryLinkedRecord,
    InventoryNote,
    PriceBook,
    PriceBookProduct,
    PriceBookRange,
    Product,
    ProductConfigurator,
    PurchaseOrder,
    PurchaseOrderItem,
    Quote,
    QuoteItem,
    SalesOrder,
    SalesOrderItem,
    Vendor,
)

User = get_user_model()


def _active_queryset(model):
    return model.objects.filter(is_active=True)


def _validate_positive_whole_number(attrs, field_name: str, *, minimum: int = 0) -> None:
    value = attrs.get(field_name)
    if value is not None and value < minimum:
        raise serializers.ValidationError(
            {field_name: [f"Ensure this value is greater than or equal to {minimum}."]}
        )


def _validate_subscription_dates(attrs) -> None:
    start = attrs.get("subscription_start_date")
    end = attrs.get("subscription_end_date")
    renewal = attrs.get("renewal_due_date")
    if start and end and end < start:
        raise serializers.ValidationError(
            {"subscription_end_date": ["Subscription end date must be on or after the start date."]}
        )
    if start and renewal and renewal < start:
        raise serializers.ValidationError(
            {"renewal_due_date": ["Renewal due date must be on or after the subscription start date."]}
        )


def _get_renewal_status(obj) -> str | None:
    renewal_due_date = getattr(obj, "renewal_due_date", None)
    billing_cycle = getattr(obj, "billing_cycle", "")
    if not renewal_due_date or billing_cycle == "one_time":
        return None
    today = timezone.localdate()
    if renewal_due_date < today:
        return "Overdue"
    if renewal_due_date == today:
        return "Due Today"
    if (renewal_due_date - today).days <= 30:
        return "Upcoming"
    return "Active"


class InventoryNoteSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = InventoryNote
        fields = ["id", "note", "created_by", "created_by_email", "created_at"]
        read_only_fields = ["created_by", "created_by_email", "created_at"]

    def validate_note(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", None) if obj.created_by else None


class InventoryActivitySerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = InventoryActivity
        fields = ["id", "action", "description", "user", "user_email", "is_closed", "created_at"]
        read_only_fields = ["user", "user_email", "created_at"]

    def get_user_email(self, obj):
        return getattr(obj.user, "email", None) if obj.user else None


class InventoryAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.SerializerMethodField()

    class Meta:
        model = InventoryAttachment
        fields = ["id", "file", "uploaded_by", "uploaded_by_email", "created_at"]
        read_only_fields = ["uploaded_by", "uploaded_by_email", "created_at"]

    def get_uploaded_by_email(self, obj):
        return getattr(obj.uploaded_by, "email", None) if obj.uploaded_by else None


class InventoryEmailLogSerializer(serializers.ModelSerializer):
    sent_by_email = serializers.SerializerMethodField()

    class Meta:
        model = InventoryEmailLog
        fields = ["id", "to_email", "subject", "body", "sent_by", "sent_by_email", "created_at"]
        read_only_fields = ["sent_by", "sent_by_email", "created_at"]

    def get_sent_by_email(self, obj):
        return getattr(obj.sent_by, "email", None) if obj.sent_by else None


class InventoryLinkedRecordSerializer(serializers.ModelSerializer):
    account_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()

    class Meta:
        model = InventoryLinkedRecord
        fields = [
            "id",
            "account",
            "account_name",
            "contact",
            "contact_name",
            "deal",
            "deal_name",
            "lead",
            "lead_name",
            "relationship_label",
            "metadata",
            "created_at",
        ]

    def validate(self, attrs):
        linked_fields = [attrs.get("account"), attrs.get("contact"), attrs.get("deal"), attrs.get("lead")]
        if not any(linked_fields):
            raise serializers.ValidationError(
                {"non_field_errors": ["At least one linked CRM record is required."]}
            )
        return attrs

    def get_account_name(self, obj):
        try:
            return obj.account.account_name if obj.account else None
        except ObjectDoesNotExist:
            return None

    def get_contact_name(self, obj):
        try:
            return f"{obj.contact.first_name} {obj.contact.last_name}".strip() if obj.contact else None
        except ObjectDoesNotExist:
            return None

    def get_deal_name(self, obj):
        try:
            return obj.deal.deal_name if obj.deal else None
        except ObjectDoesNotExist:
            return None

    def get_lead_name(self, obj):
        try:
            return f"{obj.lead.first_name} {obj.lead.last_name}".strip() if obj.lead else None
        except ObjectDoesNotExist:
            return None


class VendorLookupSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="vendor_name", read_only=True)
    label = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = ["id", "vendor_name", "name", "label", "email", "phone"]

    def get_label(self, obj):
        if obj.email:
            return f"{obj.vendor_name} ({obj.email})"
        return obj.vendor_name


class ProductLookupSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="product_name", read_only=True)
    label = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "product_name", "name", "label", "product_code", "unit_price"]

    def get_label(self, obj):
        if obj.product_code:
            return f"{obj.product_name} ({obj.product_code})"
        return obj.product_name


class VendorListSerializer(serializers.ModelSerializer):
    owner = serializers.IntegerField(source="vendor_owner_id", read_only=True)
    owner_email = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            "id",
            "vendor_name",
            "email",
            "phone",
            "website",
            "vendor_owner",
            "owner",
            "owner_email",
            "category",
            "created_at",
            "updated_at",
        ]

    def get_owner_email(self, obj):
        return getattr(obj.vendor_owner, "email", None) if obj.vendor_owner else None


class VendorWriteSerializer(serializers.ModelSerializer):
    vendor_owner = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(User),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Vendor
        fields = [
            "vendor_name",
            "email",
            "phone",
            "website",
            "vendor_owner",
            "category",
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_country",
            "billing_zip_code",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_country",
            "shipping_zip_code",
            "description",
        ]

    def validate_vendor_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value


class VendorDetailSerializer(VendorListSerializer):
    related_summary = serializers.SerializerMethodField()

    class Meta(VendorListSerializer.Meta):
        fields = VendorListSerializer.Meta.fields + [
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_country",
            "billing_zip_code",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_country",
            "shipping_zip_code",
            "description",
            "related_summary",
        ]

    def get_related_summary(self, obj):
        return {
            "products": obj.products.filter(is_active=True).count(),
            "purchase_orders": obj.purchase_orders.filter(is_active=True).count(),
            "notes": obj.notes.count(),
            "activities": obj.activities.count(),
            "attachments": obj.attachments.count(),
            "emails": obj.email_logs.count(),
            "linked_records": obj.linked_records.count(),
        }


class ProductListSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()
    vendor_name = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "owner",
            "owner_email",
            "product_name",
            "product_code",
            "vendor",
            "vendor_name",
            "manufacturer",
            "product_category",
            "product_type",
            "deployment_model",
            "billing_cycle",
            "license_type",
            "unit_price",
            "commission_rate",
            "tax",
            "quantity_in_stock",
            "quantity_in_demand",
            "reorder_level",
            "usage_unit",
            "default_user_seats",
            "subscription_term_months",
            "renewal_required",
            "implementation_required",
            "created_at",
            "updated_at",
        ]

    def get_owner_email(self, obj):
        return getattr(obj.owner, "email", None) if obj.owner else None

    def get_vendor_name(self, obj):
        return obj.vendor.vendor_name if obj.vendor else None


class ProductWriteSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(User),
        required=False,
        allow_null=True,
    )
    product_code = serializers.CharField(read_only=True)
    vendor = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Vendor),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Product
        fields = [
            "owner",
            "product_name",
            "product_code",
            "vendor",
            "manufacturer",
            "product_category",
            "product_type",
            "deployment_model",
            "billing_cycle",
            "license_type",
            "unit_price",
            "commission_rate",
            "tax",
            "quantity_in_stock",
            "quantity_in_demand",
            "reorder_level",
            "usage_unit",
            "default_user_seats",
            "subscription_term_months",
            "renewal_required",
            "implementation_required",
            "support_start_date",
            "support_expiry_date",
            "description",
        ]

    def validate(self, attrs):
        numeric_fields = [
            "unit_price",
            "commission_rate",
            "tax",
            "quantity_in_stock",
            "quantity_in_demand",
            "reorder_level",
        ]
        for field in numeric_fields:
            value = attrs.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError({field: ["Ensure this value is greater than or equal to 0."]})
        _validate_positive_whole_number(attrs, "default_user_seats", minimum=1)
        _validate_positive_whole_number(attrs, "subscription_term_months", minimum=1)
        start = attrs.get("support_start_date")
        end = attrs.get("support_expiry_date")
        if start and end and start > end:
            raise serializers.ValidationError(
                {"support_expiry_date": ["Support expiry date must be after support start date."]}
            )
        return attrs


class ProductDetailSerializer(ProductListSerializer):
    related_summary = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + [
            "support_start_date",
            "support_expiry_date",
            "description",
            "related_summary",
        ]

    def get_related_summary(self, obj):
        return {
            "price_books": obj.price_books.count(),
            "notes": obj.notes.count(),
            "activities": obj.activities.count(),
            "attachments": obj.attachments.count(),
            "emails": obj.email_logs.count(),
            "linked_records": obj.linked_records.count(),
        }


class PriceBookRangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceBookRange
        fields = ["id", "from_range", "to_range", "discount_percentage"]

    def validate(self, attrs):
        from_range = attrs.get("from_range")
        to_range = attrs.get("to_range")
        discount = attrs.get("discount_percentage")
        if from_range is not None and to_range is not None and from_range > to_range:
            raise serializers.ValidationError(
                {"to_range": ["Range end must be greater than or equal to range start."]}
            )
        if discount is not None and discount < 0:
            raise serializers.ValidationError(
                {"discount_percentage": ["Ensure this value is greater than or equal to 0."]}
            )
        return attrs


class PriceBookProductSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_code = serializers.SerializerMethodField()
    product = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(Product))

    class Meta:
        model = PriceBookProduct
        fields = ["id", "product", "product_name", "product_code", "list_price", "active"]

    def get_product_name(self, obj):
        return obj.product.product_name if obj.product else None

    def get_product_code(self, obj):
        return obj.product.product_code if obj.product else None

    def validate_list_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Ensure this value is greater than or equal to 0.")
        return value


class PriceBookListSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()

    class Meta:
        model = PriceBook
        fields = ["id", "owner", "owner_email", "name", "active", "pricing_model", "created_at", "updated_at"]

    def get_owner_email(self, obj):
        return getattr(obj.owner, "email", None) if obj.owner else None


class PriceBookWriteSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(User),
        required=False,
        allow_null=True,
    )
    ranges = PriceBookRangeSerializer(many=True, required=False)
    product_links = PriceBookProductSerializer(many=True, required=False)

    class Meta:
        model = PriceBook
        fields = ["owner", "name", "active", "pricing_model", "description", "ranges", "product_links"]

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value

    def validate(self, attrs):
        ranges = attrs.get("ranges") or []
        product_links = attrs.get("product_links") or []
        seen_products = set()
        normalized_ranges = []
        for product_link in product_links:
            product_id = product_link["product"].id
            if product_id in seen_products:
                raise serializers.ValidationError(
                    {"product_links": ["Each product can only be linked once per price book."]}
                )
            seen_products.add(product_id)
        for item in ranges:
            normalized_ranges.append((item["from_range"], item["to_range"]))
        normalized_ranges.sort()
        for index in range(1, len(normalized_ranges)):
            previous_end = normalized_ranges[index - 1][1]
            current_start = normalized_ranges[index][0]
            if current_start <= previous_end:
                raise serializers.ValidationError(
                    {"ranges": ["Pricing ranges cannot overlap."]}
                )
        return attrs


class PriceBookDetailSerializer(PriceBookListSerializer):
    ranges = PriceBookRangeSerializer(many=True, read_only=True)
    product_links = PriceBookProductSerializer(many=True, read_only=True)
    related_summary = serializers.SerializerMethodField()

    class Meta(PriceBookListSerializer.Meta):
        fields = PriceBookListSerializer.Meta.fields + ["description", "ranges", "product_links", "related_summary"]

    def get_related_summary(self, obj):
        return {
            "products": obj.products.count(),
            "notes": obj.notes.count(),
            "activities": obj.activities.count(),
            "attachments": obj.attachments.count(),
            "emails": obj.email_logs.count(),
            "linked_records": obj.linked_records.count(),
        }


class BaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_code = serializers.SerializerMethodField()
    product = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(Product))

    def get_product_name(self, obj):
        return obj.product.product_name if obj.product else None

    def get_product_code(self, obj):
        return obj.product.product_code if obj.product else None

    def validate(self, attrs):
        quantity = attrs.get("quantity")
        list_price = attrs.get("list_price")
        discount = attrs.get("discount")
        tax = attrs.get("tax")
        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({"quantity": ["Quantity must be greater than 0."]})
        for field, value in {"list_price": list_price, "discount": discount, "tax": tax}.items():
            if value is not None and value < 0:
                raise serializers.ValidationError({field: ["Ensure this value is greater than or equal to 0."]})
        return attrs


class QuoteItemSerializer(BaseItemSerializer):
    class Meta:
        model = QuoteItem
        fields = ["id", "product", "product_name", "product_code", "quantity", "list_price", "amount", "discount", "tax", "total", "row_description"]


class SalesOrderItemSerializer(BaseItemSerializer):
    class Meta:
        model = SalesOrderItem
        fields = ["id", "product", "product_name", "product_code", "quantity", "list_price", "amount", "discount", "tax", "total", "row_description"]


class PurchaseOrderItemSerializer(BaseItemSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = ["id", "product", "product_name", "product_code", "quantity", "list_price", "amount", "discount", "tax", "total", "row_description"]


class InvoiceItemSerializer(BaseItemSerializer):
    class Meta:
        model = InvoiceItem
        fields = ["id", "product", "product_name", "product_code", "quantity", "list_price", "amount", "discount", "tax", "total", "row_description"]


class QuoteListSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()
    price_book_name = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()
    renewal_status = serializers.SerializerMethodField()

    class Meta:
        model = Quote
        fields = [
            "id",
            "owner",
            "owner_email",
            "subject",
            "quote_stage",
            "team",
            "carrier",
            "price_book",
            "price_book_name",
            "deal",
            "deal_name",
            "valid_until",
            "contact",
            "contact_name",
            "account",
            "account_name",
            "billing_cycle",
            "license_type",
            "licensed_users",
            "implementation_required",
            "subscription_start_date",
            "subscription_end_date",
            "renewal_due_date",
            "renewal_status",
            "subtotal",
            "discount",
            "tax",
            "adjustment",
            "grand_total",
            "created_at",
            "updated_at",
        ]

    def get_owner_email(self, obj):
        return getattr(obj.owner, "email", None) if obj.owner else None

    def get_price_book_name(self, obj):
        return obj.price_book.name if obj.price_book else None

    def get_account_name(self, obj):
        return obj.account.account_name if obj.account else None

    def get_contact_name(self, obj):
        return f"{obj.contact.first_name} {obj.contact.last_name}".strip() if obj.contact else None

    def get_deal_name(self, obj):
        return obj.deal.deal_name if obj.deal else None

    def get_renewal_status(self, obj):
        return _get_renewal_status(obj)


class QuoteWriteSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(User),
        required=False,
        allow_null=True,
    )
    price_book = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(PriceBook),
        required=False,
        allow_null=True,
    )
    account = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Account),
        required=False,
        allow_null=True,
    )
    contact = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Contact),
        required=False,
        allow_null=True,
    )
    deal = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Deal),
        required=False,
        allow_null=True,
    )
    items = QuoteItemSerializer(many=True, required=False)

    class Meta:
        model = Quote
        fields = [
            "owner",
            "subject",
            "quote_stage",
            "team",
            "carrier",
            "price_book",
            "deal",
            "valid_until",
            "contact",
            "account",
            "billing_cycle",
            "license_type",
            "licensed_users",
            "implementation_required",
            "subscription_start_date",
            "subscription_end_date",
            "renewal_due_date",
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_country",
            "billing_zip_code",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_country",
            "shipping_zip_code",
            "subtotal",
            "discount",
            "tax",
            "adjustment",
            "grand_total",
            "terms_and_conditions",
            "description",
            "items",
        ]

    def validate(self, attrs):
        subject = attrs.get("subject")
        if subject is not None and not str(subject).strip():
            raise serializers.ValidationError({"subject": ["This field may not be blank."]})
        account = attrs.get("account") or getattr(self.instance, "account", None)
        contact = attrs.get("contact") or getattr(self.instance, "contact", None)
        deal = attrs.get("deal") or getattr(self.instance, "deal", None)
        if not account:
            raise serializers.ValidationError({"account": ["Select an account."]})
        if not contact:
            raise serializers.ValidationError({"contact": ["Select a contact."]})
        if not deal:
            raise serializers.ValidationError({"deal": ["Select a deal."]})
        _validate_positive_whole_number(attrs, "licensed_users", minimum=1)
        _validate_subscription_dates(attrs)
        items = attrs.get("items")
        if items is not None and not items:
            raise serializers.ValidationError({"items": ["At least one line item is required."]})
        return attrs


class QuoteDetailSerializer(QuoteListSerializer):
    items = QuoteItemSerializer(many=True, read_only=True)
    related_summary = serializers.SerializerMethodField()

    class Meta(QuoteListSerializer.Meta):
        fields = QuoteListSerializer.Meta.fields + [
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_country",
            "billing_zip_code",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_country",
            "shipping_zip_code",
            "terms_and_conditions",
            "description",
            "items",
            "related_summary",
        ]

    def get_related_summary(self, obj):
        return {
            "sales_orders": obj.sales_orders.count(),
            "notes": obj.notes.count(),
            "activities": obj.activities.count(),
            "attachments": obj.attachments.count(),
            "emails": obj.email_logs.count(),
            "linked_records": obj.linked_records.count(),
        }


class SalesOrderListSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()
    renewal_status = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrder
        fields = [
            "id",
            "owner",
            "owner_email",
            "subject",
            "customer_no",
            "quote",
            "pending",
            "carrier",
            "sales_commission",
            "account",
            "account_name",
            "deal",
            "deal_name",
            "due_date",
            "contact",
            "contact_name",
            "billing_cycle",
            "license_type",
            "licensed_users",
            "implementation_required",
            "subscription_start_date",
            "subscription_end_date",
            "renewal_due_date",
            "renewal_status",
            "excise_duty",
            "status",
            "subtotal",
            "discount",
            "tax",
            "adjustment",
            "grand_total",
            "created_at",
            "updated_at",
        ]

    def get_owner_email(self, obj):
        return getattr(obj.owner, "email", None) if obj.owner else None

    def get_account_name(self, obj):
        return obj.account.account_name if obj.account else None

    def get_contact_name(self, obj):
        return f"{obj.contact.first_name} {obj.contact.last_name}".strip() if obj.contact else None

    def get_deal_name(self, obj):
        return obj.deal.deal_name if obj.deal else None

    def get_renewal_status(self, obj):
        return _get_renewal_status(obj)


class SalesOrderWriteSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(User),
        required=False,
        allow_null=True,
    )
    quote = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Quote),
        required=False,
        allow_null=True,
    )
    account = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Account),
        required=False,
        allow_null=True,
    )
    contact = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Contact),
        required=False,
        allow_null=True,
    )
    deal = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Deal),
        required=False,
        allow_null=True,
    )
    items = SalesOrderItemSerializer(many=True, required=False)

    class Meta:
        model = SalesOrder
        fields = [
            "owner",
            "subject",
            "customer_no",
            "quote",
            "pending",
            "carrier",
            "sales_commission",
            "account",
            "deal",
            "due_date",
            "contact",
            "billing_cycle",
            "license_type",
            "licensed_users",
            "implementation_required",
            "subscription_start_date",
            "subscription_end_date",
            "renewal_due_date",
            "excise_duty",
            "status",
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_country",
            "billing_zip_code",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_country",
            "shipping_zip_code",
            "subtotal",
            "discount",
            "tax",
            "adjustment",
            "grand_total",
            "terms_and_conditions",
            "description",
            "items",
        ]

    def validate(self, attrs):
        subject = attrs.get("subject")
        if subject is not None and not str(subject).strip():
            raise serializers.ValidationError({"subject": ["This field may not be blank."]})
        quote = attrs.get("quote") or getattr(self.instance, "quote", None)
        account = attrs.get("account") or getattr(self.instance, "account", None)
        contact = attrs.get("contact") or getattr(self.instance, "contact", None)
        deal = attrs.get("deal") or getattr(self.instance, "deal", None)
        if not quote and not (account and contact and deal):
            raise serializers.ValidationError(
                {"non_field_errors": ["Select a quote or provide account, contact, and deal."]}
            )
        _validate_positive_whole_number(attrs, "licensed_users", minimum=1)
        _validate_subscription_dates(attrs)
        items = attrs.get("items")
        if items is not None and not items:
            raise serializers.ValidationError({"items": ["At least one line item is required."]})
        return attrs


class SalesOrderDetailSerializer(SalesOrderListSerializer):
    items = SalesOrderItemSerializer(many=True, read_only=True)
    related_summary = serializers.SerializerMethodField()

    class Meta(SalesOrderListSerializer.Meta):
        fields = SalesOrderListSerializer.Meta.fields + [
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_country",
            "billing_zip_code",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_country",
            "shipping_zip_code",
            "terms_and_conditions",
            "description",
            "items",
            "related_summary",
        ]

    def get_related_summary(self, obj):
        return {
            "invoices": obj.invoices.count(),
            "notes": obj.notes.count(),
            "activities": obj.activities.count(),
            "attachments": obj.attachments.count(),
            "emails": obj.email_logs.count(),
            "linked_records": obj.linked_records.count(),
        }


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()
    vendor_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "owner",
            "owner_email",
            "subject",
            "requisition_number",
            "contact",
            "contact_name",
            "due_date",
            "excise_duty",
            "status",
            "po_number",
            "vendor",
            "vendor_name",
            "tracking_number",
            "po_date",
            "carrier",
            "sales_commission",
            "subtotal",
            "discount",
            "tax",
            "adjustment",
            "grand_total",
            "created_at",
            "updated_at",
        ]

    def get_owner_email(self, obj):
        return getattr(obj.owner, "email", None) if obj.owner else None

    def get_vendor_name(self, obj):
        return obj.vendor.vendor_name if obj.vendor else None

    def get_contact_name(self, obj):
        return f"{obj.contact.first_name} {obj.contact.last_name}".strip() if obj.contact else None


class PurchaseOrderWriteSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(User),
        required=False,
        allow_null=True,
    )
    contact = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Contact),
        required=False,
        allow_null=True,
    )
    vendor = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Vendor),
        required=False,
        allow_null=True,
    )
    items = PurchaseOrderItemSerializer(many=True, required=False)

    class Meta:
        model = PurchaseOrder
        fields = [
            "owner",
            "subject",
            "requisition_number",
            "contact",
            "due_date",
            "excise_duty",
            "status",
            "po_number",
            "vendor",
            "tracking_number",
            "po_date",
            "carrier",
            "sales_commission",
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_country",
            "billing_zip_code",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_country",
            "shipping_zip_code",
            "subtotal",
            "discount",
            "tax",
            "adjustment",
            "grand_total",
            "terms_and_conditions",
            "description",
            "items",
        ]

    def validate(self, attrs):
        subject = attrs.get("subject")
        if subject is not None and not str(subject).strip():
            raise serializers.ValidationError({"subject": ["This field may not be blank."]})
        vendor = attrs.get("vendor") or getattr(self.instance, "vendor", None)
        if not vendor:
            raise serializers.ValidationError({"vendor": ["Select a vendor."]})
        items = attrs.get("items")
        if items is not None and not items:
            raise serializers.ValidationError({"items": ["At least one line item is required."]})
        return attrs


class PurchaseOrderDetailSerializer(PurchaseOrderListSerializer):
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    related_summary = serializers.SerializerMethodField()

    class Meta(PurchaseOrderListSerializer.Meta):
        fields = PurchaseOrderListSerializer.Meta.fields + [
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_country",
            "billing_zip_code",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_country",
            "shipping_zip_code",
            "terms_and_conditions",
            "description",
            "items",
            "related_summary",
        ]

    def get_related_summary(self, obj):
        return {
            "invoices": obj.invoices.count(),
            "notes": obj.notes.count(),
            "activities": obj.activities.count(),
            "attachments": obj.attachments.count(),
            "emails": obj.email_logs.count(),
            "linked_records": obj.linked_records.count(),
        }


class InvoiceListSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()
    renewal_status = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id",
            "owner",
            "owner_email",
            "subject",
            "invoice_date",
            "due_date",
            "sales_commission",
            "account",
            "account_name",
            "contact",
            "contact_name",
            "deal",
            "deal_name",
            "sales_order",
            "purchase_order",
            "billing_cycle",
            "license_type",
            "licensed_users",
            "implementation_required",
            "subscription_start_date",
            "subscription_end_date",
            "renewal_due_date",
            "renewal_status",
            "excise_duty",
            "status",
            "subtotal",
            "discount",
            "tax",
            "adjustment",
            "grand_total",
            "created_at",
            "updated_at",
        ]

    def get_owner_email(self, obj):
        return getattr(obj.owner, "email", None) if obj.owner else None

    def get_account_name(self, obj):
        return obj.account.account_name if obj.account else None

    def get_contact_name(self, obj):
        return f"{obj.contact.first_name} {obj.contact.last_name}".strip() if obj.contact else None

    def get_deal_name(self, obj):
        return obj.deal.deal_name if obj.deal else None

    def get_renewal_status(self, obj):
        return _get_renewal_status(obj)


class InvoiceWriteSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(User),
        required=False,
        allow_null=True,
    )
    account = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Account),
        required=False,
        allow_null=True,
    )
    contact = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Contact),
        required=False,
        allow_null=True,
    )
    deal = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Deal),
        required=False,
        allow_null=True,
    )
    sales_order = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(SalesOrder),
        required=False,
        allow_null=True,
    )
    purchase_order = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(PurchaseOrder),
        required=False,
        allow_null=True,
    )
    items = InvoiceItemSerializer(many=True, required=False)

    class Meta:
        model = Invoice
        fields = [
            "owner",
            "subject",
            "invoice_date",
            "due_date",
            "sales_commission",
            "account",
            "contact",
            "deal",
            "sales_order",
            "purchase_order",
            "billing_cycle",
            "license_type",
            "licensed_users",
            "implementation_required",
            "subscription_start_date",
            "subscription_end_date",
            "renewal_due_date",
            "excise_duty",
            "status",
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_country",
            "billing_zip_code",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_country",
            "shipping_zip_code",
            "subtotal",
            "discount",
            "tax",
            "adjustment",
            "grand_total",
            "terms_and_conditions",
            "description",
            "items",
        ]

    def validate(self, attrs):
        subject = attrs.get("subject")
        if subject is not None and not str(subject).strip():
            raise serializers.ValidationError({"subject": ["This field may not be blank."]})
        due_date = attrs.get("due_date")
        invoice_date = attrs.get("invoice_date")
        if invoice_date and due_date and due_date < invoice_date:
            raise serializers.ValidationError(
                {"due_date": ["Due date must be on or after invoice date."]}
            )
        account = attrs.get("account") or getattr(self.instance, "account", None)
        contact = attrs.get("contact") or getattr(self.instance, "contact", None)
        sales_order = attrs.get("sales_order") or getattr(self.instance, "sales_order", None)
        purchase_order = attrs.get("purchase_order") or getattr(self.instance, "purchase_order", None)
        if not account and not sales_order:
            raise serializers.ValidationError({"account": ["Select an account."]})
        if not contact and not purchase_order and not sales_order:
            raise serializers.ValidationError({"contact": ["Select a contact."]})
        _validate_positive_whole_number(attrs, "licensed_users", minimum=1)
        _validate_subscription_dates(attrs)
        items = attrs.get("items")
        if (items is None or not items) and not sales_order and not purchase_order:
            raise serializers.ValidationError({"items": ["At least one line item is required."]})
        return attrs


class InvoiceDetailSerializer(InvoiceListSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    related_summary = serializers.SerializerMethodField()

    class Meta(InvoiceListSerializer.Meta):
        fields = InvoiceListSerializer.Meta.fields + [
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_country",
            "billing_zip_code",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_country",
            "shipping_zip_code",
            "terms_and_conditions",
            "description",
            "items",
            "related_summary",
        ]

    def get_related_summary(self, obj):
        return {
            "notes": obj.notes.count(),
            "activities": obj.activities.count(),
            "attachments": obj.attachments.count(),
            "emails": obj.email_logs.count(),
            "linked_records": obj.linked_records.count(),
        }


class ConfiguratorRuleSerializer(serializers.ModelSerializer):
    target_product_name = serializers.SerializerMethodField()
    target_product = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Product),
        required=False,
        allow_null=True,
    )
    configurator = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(ProductConfigurator),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ConfiguratorRule
        fields = [
            "id",
            "configurator",
            "criteria",
            "action_type",
            "target_product",
            "target_product_name",
            "field_name",
            "field_value",
            "metadata",
            "created_at",
            "updated_at",
        ]

    def get_target_product_name(self, obj):
        return obj.target_product.product_name if obj.target_product else None

    def validate(self, attrs):
        action_type = attrs.get("action_type") or getattr(self.instance, "action_type", None)
        target_product = attrs.get("target_product") or getattr(self.instance, "target_product", None)
        field_name = attrs.get("field_name") or getattr(self.instance, "field_name", None)
        if action_type in {
            ConfiguratorRule.ActionType.MANDATORY_PRODUCT,
            ConfiguratorRule.ActionType.SUGGEST_PRODUCT,
        } and not target_product:
            raise serializers.ValidationError(
                {"target_product": ["A target product is required for this action type."]}
            )
        if action_type == ConfiguratorRule.ActionType.FIELD_UPDATE and not field_name:
            raise serializers.ValidationError(
                {"field_name": ["A field name is required for field update rules."]}
            )
        return attrs


class ProductConfiguratorListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductConfigurator
        fields = ["id", "name", "target_module", "layout", "subform", "lookup_field", "active", "created_at", "updated_at"]


class ProductConfiguratorWriteSerializer(serializers.ModelSerializer):
    rules = ConfiguratorRuleSerializer(many=True, required=False)

    class Meta:
        model = ProductConfigurator
        fields = ["name", "target_module", "layout", "subform", "lookup_field", "description", "active", "rules"]

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value


class ProductConfiguratorDetailSerializer(ProductConfiguratorListSerializer):
    rules = ConfiguratorRuleSerializer(many=True, read_only=True)

    class Meta(ProductConfiguratorListSerializer.Meta):
        fields = ProductConfiguratorListSerializer.Meta.fields + ["description", "rules"]


class PriceBookImportRequestSerializer(serializers.Serializer):
    operation = serializers.ChoiceField(choices=["add_new", "update_existing", "both"])
    file_name = serializers.CharField(required=False, allow_blank=True)
    scheduled_for = serializers.DateTimeField(required=False, allow_null=True)
    field_mapping = serializers.JSONField(required=False)


class InvoiceReviewSerializer(serializers.Serializer):
    adjustment = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True)
    items = serializers.ListField(child=serializers.DictField(), allow_empty=True)

    def validate_items(self, value):
        validated = []
        for index, item in enumerate(value, start=1):
            if "product" not in item:
                raise serializers.ValidationError(f"Item {index}: product is required.")
            if Decimal(str(item.get("quantity", "0"))) <= 0:
                raise serializers.ValidationError(f"Item {index}: quantity must be greater than 0.")
            validated.append(item)
        return validated
