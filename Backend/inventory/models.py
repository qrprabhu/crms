from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from core.base_models import BaseModel


class ProductType(models.TextChoices):
    SOFTWARE = "software", "Software"
    SERVICE = "service", "Service"
    ADDON = "addon", "Add-on"
    BUNDLE = "bundle", "Bundle"


class DeploymentModel(models.TextChoices):
    CLOUD = "cloud", "Cloud"
    ON_PREM = "on_prem", "On-premise"
    HYBRID = "hybrid", "Hybrid"


class BillingCycle(models.TextChoices):
    ONE_TIME = "one_time", "One-time"
    MONTHLY = "monthly", "Monthly"
    QUARTERLY = "quarterly", "Quarterly"
    YEARLY = "yearly", "Yearly"
    CUSTOM = "custom", "Custom"


class LicenseType(models.TextChoices):
    NAMED = "named", "Named User"
    CONCURRENT = "concurrent", "Concurrent"
    UNLIMITED = "unlimited", "Unlimited"
    TRIAL = "trial", "Trial"


class InventoryAddressMixin(models.Model):
    billing_street = models.CharField(max_length=255, blank=True, null=True)
    billing_city = models.CharField(max_length=100, blank=True, null=True)
    billing_state = models.CharField(max_length=100, blank=True, null=True)
    billing_country = models.CharField(max_length=100, blank=True, null=True)
    billing_zip_code = models.CharField(max_length=20, blank=True, null=True)
    shipping_street = models.CharField(max_length=255, blank=True, null=True)
    shipping_city = models.CharField(max_length=100, blank=True, null=True)
    shipping_state = models.CharField(max_length=100, blank=True, null=True)
    shipping_country = models.CharField(max_length=100, blank=True, null=True)
    shipping_zip_code = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        abstract = True


class InventoryOwnedModel(BaseModel):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="%(app_label)s_%(class)s_owner",
        null=True,
        blank=True,
    )

    class Meta:
        abstract = True


class InventoryDocumentBase(InventoryOwnedModel, InventoryAddressMixin):
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    adjustment = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    grand_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    terms_and_conditions = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        abstract = True


class Vendor(BaseModel, InventoryAddressMixin):
    vendor_name = models.CharField(max_length=255, db_index=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    website = models.URLField(max_length=255, blank=True, null=True)
    vendor_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_vendors",
        null=True,
        blank=True,
    )
    category = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["vendor_name"]),
            models.Index(fields=["vendor_owner"]),
            models.Index(fields=["category"]),
            models.Index(fields=["is_active"]),
        ]

    @property
    def owner(self):
        return self.vendor_owner

    @owner.setter
    def owner(self, value):
        self.vendor_owner = value

    def __str__(self):
        return self.vendor_name


class Product(InventoryOwnedModel):
    product_name = models.CharField(max_length=255, db_index=True)
    product_code = models.CharField(max_length=120, unique=True, db_index=True)
    vendor = models.ForeignKey(
        "inventory.Vendor",
        on_delete=models.SET_NULL,
        related_name="products",
        null=True,
        blank=True,
    )
    manufacturer = models.CharField(max_length=255, blank=True, null=True)
    product_category = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    product_type = models.CharField(
        max_length=20,
        choices=ProductType.choices,
        default=ProductType.SOFTWARE,
        db_index=True,
    )
    deployment_model = models.CharField(
        max_length=20,
        choices=DeploymentModel.choices,
        default=DeploymentModel.CLOUD,
    )
    billing_cycle = models.CharField(
        max_length=20,
        choices=BillingCycle.choices,
        default=BillingCycle.CUSTOM,
        db_index=True,
    )
    license_type = models.CharField(
        max_length=20,
        choices=LicenseType.choices,
        default=LicenseType.NAMED,
    )
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    commission_rate = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    quantity_in_stock = models.PositiveIntegerField(default=0)
    quantity_in_demand = models.PositiveIntegerField(default=0)
    reorder_level = models.PositiveIntegerField(default=0)
    usage_unit = models.CharField(max_length=100, blank=True, null=True)
    default_user_seats = models.PositiveIntegerField(default=1)
    subscription_term_months = models.PositiveIntegerField(default=12)
    renewal_required = models.BooleanField(default=True)
    implementation_required = models.BooleanField(default=False)
    support_start_date = models.DateField(blank=True, null=True)
    support_expiry_date = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product_name"]),
            models.Index(fields=["product_code"]),
            models.Index(fields=["product_category"]),
            models.Index(fields=["product_type"]),
            models.Index(fields=["billing_cycle"]),
            models.Index(fields=["vendor"]),
            models.Index(fields=["owner"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.product_name


class PriceBook(InventoryOwnedModel):
    class PricingModel(models.TextChoices):
        FIXED = "fixed", "Fixed"
        RANGE = "range", "Range"
        CPQ = "cpq", "CPQ"

    name = models.CharField(max_length=255, db_index=True)
    active = models.BooleanField(default=True, db_index=True)
    pricing_model = models.CharField(
        max_length=20,
        choices=PricingModel.choices,
        default=PricingModel.FIXED,
    )
    description = models.TextField(blank=True, null=True)
    products = models.ManyToManyField(
        "inventory.Product",
        through="inventory.PriceBookProduct",
        related_name="price_books",
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["owner"]),
            models.Index(fields=["active"]),
        ]

    def __str__(self):
        return self.name


class PriceBookRange(BaseModel):
    price_book = models.ForeignKey(
        "inventory.PriceBook",
        on_delete=models.CASCADE,
        related_name="ranges",
    )
    from_range = models.PositiveIntegerField()
    to_range = models.PositiveIntegerField()
    discount_percentage = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["from_range", "id"]
        indexes = [models.Index(fields=["price_book", "from_range", "to_range"])]


class PriceBookProduct(BaseModel):
    price_book = models.ForeignKey(
        "inventory.PriceBook",
        on_delete=models.CASCADE,
        related_name="product_links",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.CASCADE,
        related_name="price_book_links",
    )
    list_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["price_book", "product"],
                name="inventory_price_book_product_unique",
            ),
        ]


class Quote(InventoryDocumentBase):
    subject = models.CharField(max_length=255, db_index=True)
    quote_stage = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    team = models.CharField(max_length=100, blank=True, null=True)
    carrier = models.CharField(max_length=120, blank=True, null=True)
    price_book = models.ForeignKey(
        "inventory.PriceBook",
        on_delete=models.SET_NULL,
        related_name="quotes",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="inventory_quotes",
        null=True,
        blank=True,
    )
    valid_until = models.DateField(blank=True, null=True)
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="inventory_quotes",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="inventory_quotes",
        null=True,
        blank=True,
    )
    billing_cycle = models.CharField(
        max_length=20,
        choices=BillingCycle.choices,
        default=BillingCycle.CUSTOM,
    )
    license_type = models.CharField(
        max_length=20,
        choices=LicenseType.choices,
        default=LicenseType.NAMED,
    )
    licensed_users = models.PositiveIntegerField(default=1)
    implementation_required = models.BooleanField(default=False)
    subscription_start_date = models.DateField(blank=True, null=True)
    subscription_end_date = models.DateField(blank=True, null=True)
    renewal_due_date = models.DateField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["subject"]),
            models.Index(fields=["quote_stage"]),
            models.Index(fields=["price_book"]),
            models.Index(fields=["account"]),
            models.Index(fields=["contact"]),
            models.Index(fields=["deal"]),
            models.Index(fields=["owner"]),
        ]

    def __str__(self):
        return self.subject


class SalesOrder(InventoryDocumentBase):
    subject = models.CharField(max_length=255, db_index=True)
    customer_no = models.CharField(max_length=100, blank=True, null=True)
    quote = models.ForeignKey(
        "inventory.Quote",
        on_delete=models.SET_NULL,
        related_name="sales_orders",
        null=True,
        blank=True,
    )
    pending = models.BooleanField(default=False)
    carrier = models.CharField(max_length=120, blank=True, null=True)
    sales_commission = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="inventory_sales_orders",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="inventory_sales_orders",
        null=True,
        blank=True,
    )
    due_date = models.DateField(blank=True, null=True)
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="inventory_sales_orders",
        null=True,
        blank=True,
    )
    billing_cycle = models.CharField(
        max_length=20,
        choices=BillingCycle.choices,
        default=BillingCycle.CUSTOM,
    )
    license_type = models.CharField(
        max_length=20,
        choices=LicenseType.choices,
        default=LicenseType.NAMED,
    )
    licensed_users = models.PositiveIntegerField(default=1)
    implementation_required = models.BooleanField(default=False)
    subscription_start_date = models.DateField(blank=True, null=True)
    subscription_end_date = models.DateField(blank=True, null=True)
    renewal_due_date = models.DateField(blank=True, null=True)
    excise_duty = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=100, blank=True, null=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["subject"]),
            models.Index(fields=["status"]),
            models.Index(fields=["account"]),
            models.Index(fields=["contact"]),
            models.Index(fields=["deal"]),
            models.Index(fields=["quote"]),
            models.Index(fields=["owner"]),
        ]

    def __str__(self):
        return self.subject


class PurchaseOrder(InventoryDocumentBase):
    subject = models.CharField(max_length=255, db_index=True)
    requisition_number = models.CharField(max_length=120, blank=True, null=True)
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="inventory_purchase_orders",
        null=True,
        blank=True,
    )
    due_date = models.DateField(blank=True, null=True)
    excise_duty = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    po_number = models.CharField(max_length=120, blank=True, null=True, db_index=True)
    vendor = models.ForeignKey(
        "inventory.Vendor",
        on_delete=models.SET_NULL,
        related_name="purchase_orders",
        null=True,
        blank=True,
    )
    tracking_number = models.CharField(max_length=120, blank=True, null=True)
    po_date = models.DateField(blank=True, null=True)
    carrier = models.CharField(max_length=120, blank=True, null=True)
    sales_commission = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["subject"]),
            models.Index(fields=["status"]),
            models.Index(fields=["vendor"]),
            models.Index(fields=["contact"]),
            models.Index(fields=["po_number"]),
            models.Index(fields=["owner"]),
        ]

    def __str__(self):
        return self.subject


class Invoice(InventoryDocumentBase):
    subject = models.CharField(max_length=255, db_index=True)
    invoice_date = models.DateField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    sales_commission = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="inventory_invoices",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="inventory_invoices",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="inventory_invoices",
        null=True,
        blank=True,
    )
    sales_order = models.ForeignKey(
        "inventory.SalesOrder",
        on_delete=models.SET_NULL,
        related_name="invoices",
        null=True,
        blank=True,
    )
    purchase_order = models.ForeignKey(
        "inventory.PurchaseOrder",
        on_delete=models.SET_NULL,
        related_name="invoices",
        null=True,
        blank=True,
    )
    billing_cycle = models.CharField(
        max_length=20,
        choices=BillingCycle.choices,
        default=BillingCycle.CUSTOM,
    )
    license_type = models.CharField(
        max_length=20,
        choices=LicenseType.choices,
        default=LicenseType.NAMED,
    )
    licensed_users = models.PositiveIntegerField(default=1)
    implementation_required = models.BooleanField(default=False)
    subscription_start_date = models.DateField(blank=True, null=True)
    subscription_end_date = models.DateField(blank=True, null=True)
    renewal_due_date = models.DateField(blank=True, null=True)
    excise_duty = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=100, blank=True, null=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["subject"]),
            models.Index(fields=["status"]),
            models.Index(fields=["account"]),
            models.Index(fields=["contact"]),
            models.Index(fields=["deal"]),
            models.Index(fields=["sales_order"]),
            models.Index(fields=["purchase_order"]),
            models.Index(fields=["owner"]),
        ]

    def __str__(self):
        return self.subject


class ProductConfigurator(BaseModel):
    name = models.CharField(max_length=255, db_index=True)
    target_module = models.CharField(max_length=100, db_index=True)
    layout = models.CharField(max_length=100, blank=True, null=True)
    subform = models.CharField(max_length=100, blank=True, null=True)
    lookup_field = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["target_module"]),
            models.Index(fields=["active"]),
        ]

    def __str__(self):
        return self.name


class ConfiguratorRule(BaseModel):
    class ActionType(models.TextChoices):
        MANDATORY_PRODUCT = "mandatory_product", "Mandatory Product"
        SUGGEST_PRODUCT = "suggest_product", "Suggest Product"
        FIELD_UPDATE = "field_update", "Field Update"

    configurator = models.ForeignKey(
        "inventory.ProductConfigurator",
        on_delete=models.CASCADE,
        related_name="rules",
    )
    criteria = models.JSONField(default=dict, blank=True)
    action_type = models.CharField(max_length=50, choices=ActionType.choices, db_index=True)
    target_product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.SET_NULL,
        related_name="configurator_rules",
        null=True,
        blank=True,
    )
    field_name = models.CharField(max_length=100, blank=True, null=True)
    field_value = models.CharField(max_length=255, blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at", "id"]


class QuoteItem(BaseModel):
    quote = models.ForeignKey(
        "inventory.Quote",
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="quote_items",
    )
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    list_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    row_description = models.TextField(blank=True, null=True)


class SalesOrderItem(BaseModel):
    sales_order = models.ForeignKey(
        "inventory.SalesOrder",
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="sales_order_items",
    )
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    list_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    row_description = models.TextField(blank=True, null=True)


class PurchaseOrderItem(BaseModel):
    purchase_order = models.ForeignKey(
        "inventory.PurchaseOrder",
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="purchase_order_items",
    )
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    list_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    row_description = models.TextField(blank=True, null=True)


class InvoiceItem(BaseModel):
    invoice = models.ForeignKey(
        "inventory.Invoice",
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="invoice_items",
    )
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    list_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    row_description = models.TextField(blank=True, null=True)


class InventoryNote(BaseModel):
    note = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="inventory_notes",
        null=True,
        blank=True,
    )
    product = models.ForeignKey("inventory.Product", on_delete=models.CASCADE, related_name="notes", null=True, blank=True)
    vendor = models.ForeignKey("inventory.Vendor", on_delete=models.CASCADE, related_name="notes", null=True, blank=True)
    price_book = models.ForeignKey("inventory.PriceBook", on_delete=models.CASCADE, related_name="notes", null=True, blank=True)
    quote = models.ForeignKey("inventory.Quote", on_delete=models.CASCADE, related_name="notes", null=True, blank=True)
    sales_order = models.ForeignKey("inventory.SalesOrder", on_delete=models.CASCADE, related_name="notes", null=True, blank=True)
    purchase_order = models.ForeignKey("inventory.PurchaseOrder", on_delete=models.CASCADE, related_name="notes", null=True, blank=True)
    invoice = models.ForeignKey("inventory.Invoice", on_delete=models.CASCADE, related_name="notes", null=True, blank=True)


class InventoryActivity(BaseModel):
    action = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="inventory_activities",
        null=True,
        blank=True,
    )
    is_closed = models.BooleanField(default=False)
    product = models.ForeignKey("inventory.Product", on_delete=models.CASCADE, related_name="activities", null=True, blank=True)
    vendor = models.ForeignKey("inventory.Vendor", on_delete=models.CASCADE, related_name="activities", null=True, blank=True)
    price_book = models.ForeignKey("inventory.PriceBook", on_delete=models.CASCADE, related_name="activities", null=True, blank=True)
    quote = models.ForeignKey("inventory.Quote", on_delete=models.CASCADE, related_name="activities", null=True, blank=True)
    sales_order = models.ForeignKey("inventory.SalesOrder", on_delete=models.CASCADE, related_name="activities", null=True, blank=True)
    purchase_order = models.ForeignKey("inventory.PurchaseOrder", on_delete=models.CASCADE, related_name="activities", null=True, blank=True)
    invoice = models.ForeignKey("inventory.Invoice", on_delete=models.CASCADE, related_name="activities", null=True, blank=True)


class InventoryAttachment(BaseModel):
    file = models.FileField(upload_to="inventory/")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="inventory_attachments",
        null=True,
        blank=True,
    )
    product = models.ForeignKey("inventory.Product", on_delete=models.CASCADE, related_name="attachments", null=True, blank=True)
    vendor = models.ForeignKey("inventory.Vendor", on_delete=models.CASCADE, related_name="attachments", null=True, blank=True)
    price_book = models.ForeignKey("inventory.PriceBook", on_delete=models.CASCADE, related_name="attachments", null=True, blank=True)
    quote = models.ForeignKey("inventory.Quote", on_delete=models.CASCADE, related_name="attachments", null=True, blank=True)
    sales_order = models.ForeignKey("inventory.SalesOrder", on_delete=models.CASCADE, related_name="attachments", null=True, blank=True)
    purchase_order = models.ForeignKey("inventory.PurchaseOrder", on_delete=models.CASCADE, related_name="attachments", null=True, blank=True)
    invoice = models.ForeignKey("inventory.Invoice", on_delete=models.CASCADE, related_name="attachments", null=True, blank=True)


class InventoryEmailLog(BaseModel):
    to_email = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField(blank=True, null=True)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="inventory_email_logs",
        null=True,
        blank=True,
    )
    product = models.ForeignKey("inventory.Product", on_delete=models.CASCADE, related_name="email_logs", null=True, blank=True)
    vendor = models.ForeignKey("inventory.Vendor", on_delete=models.CASCADE, related_name="email_logs", null=True, blank=True)
    price_book = models.ForeignKey("inventory.PriceBook", on_delete=models.CASCADE, related_name="email_logs", null=True, blank=True)
    quote = models.ForeignKey("inventory.Quote", on_delete=models.CASCADE, related_name="email_logs", null=True, blank=True)
    sales_order = models.ForeignKey("inventory.SalesOrder", on_delete=models.CASCADE, related_name="email_logs", null=True, blank=True)
    purchase_order = models.ForeignKey("inventory.PurchaseOrder", on_delete=models.CASCADE, related_name="email_logs", null=True, blank=True)
    invoice = models.ForeignKey("inventory.Invoice", on_delete=models.CASCADE, related_name="email_logs", null=True, blank=True)


class InventoryLinkedRecord(BaseModel):
    product = models.ForeignKey("inventory.Product", on_delete=models.CASCADE, related_name="linked_records", null=True, blank=True)
    vendor = models.ForeignKey("inventory.Vendor", on_delete=models.CASCADE, related_name="linked_records", null=True, blank=True)
    price_book = models.ForeignKey("inventory.PriceBook", on_delete=models.CASCADE, related_name="linked_records", null=True, blank=True)
    quote = models.ForeignKey("inventory.Quote", on_delete=models.CASCADE, related_name="linked_records", null=True, blank=True)
    sales_order = models.ForeignKey("inventory.SalesOrder", on_delete=models.CASCADE, related_name="linked_records", null=True, blank=True)
    purchase_order = models.ForeignKey("inventory.PurchaseOrder", on_delete=models.CASCADE, related_name="linked_records", null=True, blank=True)
    invoice = models.ForeignKey("inventory.Invoice", on_delete=models.CASCADE, related_name="linked_records", null=True, blank=True)
    account = models.ForeignKey("accounts.Account", on_delete=models.CASCADE, related_name="inventory_links", null=True, blank=True)
    contact = models.ForeignKey("contacts.Contact", on_delete=models.CASCADE, related_name="inventory_links", null=True, blank=True)
    deal = models.ForeignKey("deals.Deal", on_delete=models.CASCADE, related_name="inventory_links", null=True, blank=True)
    lead = models.ForeignKey("leads.Lead", on_delete=models.CASCADE, related_name="inventory_links", null=True, blank=True)
    relationship_label = models.CharField(max_length=100, blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
