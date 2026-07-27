import django_filters

from .models import (
    ConfiguratorRule,
    Invoice,
    PriceBook,
    Product,
    ProductConfigurator,
    PurchaseOrder,
    Quote,
    SalesOrder,
    Vendor,
)


class ProductFilter(django_filters.FilterSet):
    owner = django_filters.NumberFilter(field_name="owner_id")
    vendor = django_filters.NumberFilter(field_name="vendor_id")
    product_category = django_filters.CharFilter(field_name="product_category", lookup_expr="iexact")
    product_name = django_filters.CharFilter(field_name="product_name", lookup_expr="icontains")
    product_code = django_filters.CharFilter(field_name="product_code", lookup_expr="icontains")

    class Meta:
        model = Product
        fields = ["owner", "vendor", "product_category", "product_name", "product_code"]


class VendorFilter(django_filters.FilterSet):
    owner = django_filters.NumberFilter(field_name="vendor_owner_id")
    vendor_name = django_filters.CharFilter(field_name="vendor_name", lookup_expr="icontains")
    category = django_filters.CharFilter(field_name="category", lookup_expr="iexact")

    class Meta:
        model = Vendor
        fields = ["owner", "vendor_name", "category"]


class PriceBookFilter(django_filters.FilterSet):
    owner = django_filters.NumberFilter(field_name="owner_id")
    active = django_filters.BooleanFilter(field_name="active")
    pricing_model = django_filters.CharFilter(field_name="pricing_model", lookup_expr="iexact")
    name = django_filters.CharFilter(field_name="name", lookup_expr="icontains")

    class Meta:
        model = PriceBook
        fields = ["owner", "active", "pricing_model", "name"]


class QuoteFilter(django_filters.FilterSet):
    owner = django_filters.NumberFilter(field_name="owner_id")
    price_book = django_filters.NumberFilter(field_name="price_book_id")
    account = django_filters.NumberFilter(field_name="account_id")
    contact = django_filters.NumberFilter(field_name="contact_id")
    deal = django_filters.NumberFilter(field_name="deal_id")
    quote_stage = django_filters.CharFilter(field_name="quote_stage", lookup_expr="iexact")
    valid_until = django_filters.DateFromToRangeFilter(field_name="valid_until")

    class Meta:
        model = Quote
        fields = ["owner", "price_book", "account", "contact", "deal", "quote_stage", "valid_until"]


class SalesOrderFilter(django_filters.FilterSet):
    owner = django_filters.NumberFilter(field_name="owner_id")
    account = django_filters.NumberFilter(field_name="account_id")
    contact = django_filters.NumberFilter(field_name="contact_id")
    deal = django_filters.NumberFilter(field_name="deal_id")
    quote = django_filters.NumberFilter(field_name="quote_id")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    due_date = django_filters.DateFromToRangeFilter(field_name="due_date")

    class Meta:
        model = SalesOrder
        fields = ["owner", "account", "contact", "deal", "quote", "status", "due_date"]


class PurchaseOrderFilter(django_filters.FilterSet):
    owner = django_filters.NumberFilter(field_name="owner_id")
    vendor = django_filters.NumberFilter(field_name="vendor_id")
    contact = django_filters.NumberFilter(field_name="contact_id")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    due_date = django_filters.DateFromToRangeFilter(field_name="due_date")
    po_number = django_filters.CharFilter(field_name="po_number", lookup_expr="icontains")

    class Meta:
        model = PurchaseOrder
        fields = ["owner", "vendor", "contact", "status", "due_date", "po_number"]


class InvoiceFilter(django_filters.FilterSet):
    owner = django_filters.NumberFilter(field_name="owner_id")
    account = django_filters.NumberFilter(field_name="account_id")
    contact = django_filters.NumberFilter(field_name="contact_id")
    deal = django_filters.NumberFilter(field_name="deal_id")
    sales_order = django_filters.NumberFilter(field_name="sales_order_id")
    purchase_order = django_filters.NumberFilter(field_name="purchase_order_id")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    due_date = django_filters.DateFromToRangeFilter(field_name="due_date")
    invoice_date = django_filters.DateFromToRangeFilter(field_name="invoice_date")

    class Meta:
        model = Invoice
        fields = [
            "owner",
            "account",
            "contact",
            "deal",
            "sales_order",
            "purchase_order",
            "status",
            "due_date",
            "invoice_date",
        ]


class ProductConfiguratorFilter(django_filters.FilterSet):
    target_module = django_filters.CharFilter(field_name="target_module", lookup_expr="iexact")
    active = django_filters.BooleanFilter(field_name="active")
    name = django_filters.CharFilter(field_name="name", lookup_expr="icontains")

    class Meta:
        model = ProductConfigurator
        fields = ["target_module", "active", "name"]


class ConfiguratorRuleFilter(django_filters.FilterSet):
    configurator = django_filters.NumberFilter(field_name="configurator_id")
    action_type = django_filters.CharFilter(field_name="action_type", lookup_expr="iexact")

    class Meta:
        model = ConfiguratorRule
        fields = ["configurator", "action_type"]
