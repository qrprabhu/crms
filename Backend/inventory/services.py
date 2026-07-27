from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import uuid4

from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone

from .models import (
    ConfiguratorRule,
    Invoice,
    InvoiceItem,
    InventoryLinkedRecord,
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
from .permissions import filter_queryset_for_user

MONEY_ZERO = Decimal("0.00")
PRODUCT_CODE_PREFIX = "PRD"
DEFAULT_SALES_ORDER_STATUS = "Created"
DEFAULT_PURCHASE_ORDER_STATUS = "Draft"
DEFAULT_INVOICE_STATUS = "Draft"


def as_money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception:
        return MONEY_ZERO


def calculate_line_totals(*, quantity: Any, list_price: Any, discount: Any, tax: Any) -> dict[str, Decimal]:
    qty = as_money(quantity)
    price = as_money(list_price)
    discount_value = as_money(discount)
    tax_value = as_money(tax)
    amount = (qty * price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = (amount - discount_value + tax_value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {
        "quantity": qty,
        "list_price": price,
        "amount": amount,
        "discount": discount_value,
        "tax": tax_value,
        "total": total,
    }


def calculate_document_totals(items: list[dict[str, Any]], adjustment: Any = None) -> dict[str, Decimal]:
    subtotal = sum((as_money(item.get("amount")) for item in items), MONEY_ZERO)
    discount = sum((as_money(item.get("discount")) for item in items), MONEY_ZERO)
    tax = sum((as_money(item.get("tax")) for item in items), MONEY_ZERO)
    adjustment_value = as_money(adjustment)
    grand_total = (subtotal - discount + tax + adjustment_value).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    return {
        "subtotal": subtotal,
        "discount": discount,
        "tax": tax,
        "adjustment": adjustment_value,
        "grand_total": grand_total,
    }


def generate_product_code(_product_id: int) -> str:
    return f"{PRODUCT_CODE_PREFIX}{Product.objects.count() + 1:04d}"


def _resolve_account_customer_number(account) -> str:
    if not account:
        return ""
    return str(getattr(account, "account_number", "") or "").strip()


def generate_purchase_order_number(purchase_order_id: int) -> str:
    return f"PO{purchase_order_id:04d}"


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _ensure_sales_order_defaults(data: dict[str, Any]) -> None:
    if not _clean_text(data.get("status")):
        data["status"] = DEFAULT_SALES_ORDER_STATUS


def _ensure_purchase_order_defaults(data: dict[str, Any]) -> None:
    if not _clean_text(data.get("status")):
        data["status"] = DEFAULT_PURCHASE_ORDER_STATUS
    if not data.get("po_date"):
        data["po_date"] = timezone.localdate()


def _ensure_invoice_defaults(data: dict[str, Any]) -> None:
    if not _clean_text(data.get("status")):
        data["status"] = DEFAULT_INVOICE_STATUS
    if not data.get("invoice_date"):
        data["invoice_date"] = timezone.localdate()
    if not data.get("due_date"):
        data["due_date"] = data.get("invoice_date")


def _replace_items(
    parent,
    item_model,
    relation_name: str,
    items_data: list[dict[str, Any]],
    *,
    parent_field_name: str | None = None,
) -> list:
    getattr(parent, relation_name).all().delete()
    created_items = []
    link_field_name = parent_field_name or parent._meta.model_name
    for item_data in items_data:
        calculated = calculate_line_totals(
            quantity=item_data.get("quantity"),
            list_price=item_data.get("list_price"),
            discount=item_data.get("discount"),
            tax=item_data.get("tax"),
        )
        merged = dict(item_data)
        merged.update(calculated)
        created_items.append(item_model.objects.create(**{link_field_name: parent}, **merged))
    return created_items


def _copy_inventory_address(source, target) -> None:
    for field in (
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
    ):
        value = getattr(source, field, None)
        if isinstance(target, dict):
            target.setdefault(field, value)
        else:
            setattr(target, field, value)


def _copy_software_contract_fields(source, target) -> None:
    for field in (
        "billing_cycle",
        "license_type",
        "licensed_users",
        "implementation_required",
        "subscription_start_date",
        "subscription_end_date",
        "renewal_due_date",
    ):
        value = getattr(source, field, None)
        if isinstance(target, dict):
            target.setdefault(field, value)
        else:
            setattr(target, field, value)


def _hydrate_software_defaults_from_items(data: dict[str, Any]) -> None:
    items = data.get("items") or []
    products = [item.get("product") for item in items if item.get("product")]
    first_product = products[0] if products else None
    if first_product:
        data.setdefault("billing_cycle", getattr(first_product, "billing_cycle", None))
        data.setdefault("license_type", getattr(first_product, "license_type", None))
        data.setdefault("implementation_required", getattr(first_product, "implementation_required", False))
        data.setdefault("licensed_users", sum(max(int(as_money(item.get("quantity"))), 0) for item in items) or getattr(first_product, "default_user_seats", 1))
    if data.get("subscription_end_date") and not data.get("renewal_due_date"):
        data["renewal_due_date"] = data["subscription_end_date"]


def _build_item_link_metadata(*, item, parent, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    metadata = {
        "inventory_autolink": True,
        "quantity": str(item.quantity),
        "list_price": str(item.list_price),
        "total": str(item.total),
    }
    if extra:
        metadata.update(extra)
    return metadata


def _sync_document_links(*, parent, parent_field_name: str, relationship_label: str, items, account=None, contact=None, deal=None, vendor=None, price_book=None) -> None:
    filter_kwargs = {parent_field_name: parent}
    InventoryLinkedRecord.objects.filter(**filter_kwargs).delete()

    direct_record = {
        parent_field_name: parent,
        "account": account,
        "contact": contact,
        "deal": deal,
        "vendor": vendor,
        "price_book": price_book,
        "relationship_label": relationship_label,
        "metadata": {"inventory_autolink": True, "scope": "document"},
    }
    InventoryLinkedRecord.objects.create(**direct_record)

    for item in items:
        InventoryLinkedRecord.objects.create(
            **filter_kwargs,
            product=item.product,
            vendor=vendor or getattr(item.product, "vendor", None),
            price_book=price_book,
            account=account,
            contact=contact,
            deal=deal,
            relationship_label=relationship_label,
            metadata=_build_item_link_metadata(item=item, parent=parent),
        )


@dataclass
class ProductService:
    def list_products(self, *, user):
        queryset = Product.objects.filter(is_active=True).select_related("owner", "vendor")
        return filter_queryset_for_user(queryset, user)

    def get_product(self, *, product_id: int, user):
        return self.list_products(user=user).get(pk=product_id)

    @transaction.atomic
    def create_product(self, *, data: dict[str, Any], user):
        if not data.get("owner"):
            data["owner"] = user
        temp_code = f"TEMP{uuid4().hex[:12].upper()}"
        product = Product.objects.create(**data, product_code=temp_code)
        product.product_code = generate_product_code(product.pk)
        product.save(update_fields=["product_code", "updated_at"])
        return product

    @transaction.atomic
    def update_product(self, *, product: Product, data: dict[str, Any]):
        for field, value in data.items():
            setattr(product, field, value)
        product.save()
        return product

    @transaction.atomic
    def delete_product(self, *, product: Product):
        product.is_active = False
        product.save(update_fields=["is_active", "updated_at"])
        return product


@dataclass
class VendorService:
    def list_vendors(self, *, user):
        queryset = Vendor.objects.filter(is_active=True).select_related("vendor_owner")
        return filter_queryset_for_user(queryset, user, owner_field="vendor_owner")

    def get_vendor(self, *, vendor_id: int, user):
        return self.list_vendors(user=user).get(pk=vendor_id)

    @transaction.atomic
    def create_vendor(self, *, data: dict[str, Any], user):
        if not data.get("vendor_owner"):
            data["vendor_owner"] = user
        return Vendor.objects.create(**data)

    @transaction.atomic
    def update_vendor(self, *, vendor: Vendor, data: dict[str, Any]):
        for field, value in data.items():
            setattr(vendor, field, value)
        vendor.save()
        return vendor

    @transaction.atomic
    def delete_vendor(self, *, vendor: Vendor):
        vendor.is_active = False
        vendor.save(update_fields=["is_active", "updated_at"])
        return vendor


@dataclass
class PriceBookService:
    def list_price_books(self, *, user):
        queryset = PriceBook.objects.filter(is_active=True).select_related("owner").prefetch_related("ranges", "product_links__product")
        return filter_queryset_for_user(queryset, user)

    def get_price_book(self, *, price_book_id: int, user):
        return self.list_price_books(user=user).get(pk=price_book_id)

    @transaction.atomic
    def create_price_book(self, *, data: dict[str, Any], user):
        ranges = data.pop("ranges", [])
        product_links = data.pop("product_links", [])
        if not data.get("owner"):
            data["owner"] = user
        price_book = PriceBook.objects.create(**data)
        self._sync_ranges(price_book=price_book, ranges=ranges)
        self._sync_products(price_book=price_book, product_links=product_links)
        return price_book

    @transaction.atomic
    def update_price_book(self, *, price_book: PriceBook, data: dict[str, Any]):
        ranges = data.pop("ranges", None)
        product_links = data.pop("product_links", None)
        for field, value in data.items():
            setattr(price_book, field, value)
        price_book.save()
        if ranges is not None:
            self._sync_ranges(price_book=price_book, ranges=ranges)
        if product_links is not None:
            self._sync_products(price_book=price_book, product_links=product_links)
        return price_book

    def _sync_ranges(self, *, price_book: PriceBook, ranges: list[dict[str, Any]]):
        price_book.ranges.all().delete()
        for item in ranges:
            PriceBookRange.objects.create(price_book=price_book, **item)

    def _sync_products(self, *, price_book: PriceBook, product_links: list[dict[str, Any]]):
        price_book.product_links.all().delete()
        for item in product_links:
            PriceBookProduct.objects.create(price_book=price_book, **item)


@dataclass
class QuoteService:
    def list_quotes(self, *, user):
        queryset = Quote.objects.filter(is_active=True).select_related(
            "owner",
            "price_book",
            "account",
            "contact",
            "deal",
        ).prefetch_related(
            Prefetch("items", queryset=QuoteItem.objects.select_related("product").filter(is_active=True))
        )
        return filter_queryset_for_user(queryset, user)

    def get_quote(self, *, quote_id: int, user):
        return self.list_quotes(user=user).get(pk=quote_id)

    @transaction.atomic
    def create_quote(self, *, data: dict[str, Any], user):
        items = data.pop("items", [])
        self._hydrate_quote_relationships(data)
        if not data.get("owner"):
            data["owner"] = user
        quote = Quote.objects.create(**data)
        created_items = _replace_items(
            quote,
            QuoteItem,
            "items",
            self._prepare_items(items=items, price_book=quote.price_book),
            parent_field_name="quote",
        )
        self._apply_totals(quote, created_items)
        _sync_document_links(
            parent=quote,
            parent_field_name="quote",
            relationship_label="Quote Item",
            items=created_items,
            account=quote.account,
            contact=quote.contact,
            deal=quote.deal,
            price_book=quote.price_book,
        )
        return quote

    @transaction.atomic
    def update_quote(self, *, quote: Quote, data: dict[str, Any]):
        items = data.pop("items", None)
        self._hydrate_quote_relationships(data)
        for field, value in data.items():
            setattr(quote, field, value)
        quote.save()
        line_items = list(quote.items.all())
        if items is not None:
            line_items = _replace_items(
                quote,
                QuoteItem,
                "items",
                self._prepare_items(items=items, price_book=quote.price_book),
                parent_field_name="quote",
            )
        self._apply_totals(quote, line_items)
        _sync_document_links(
            parent=quote,
            parent_field_name="quote",
            relationship_label="Quote Item",
            items=line_items,
            account=quote.account,
            contact=quote.contact,
            deal=quote.deal,
            price_book=quote.price_book,
        )
        return quote

    def _apply_totals(self, quote: Quote, items):
        totals = calculate_document_totals([{"amount": item.amount, "discount": item.discount, "tax": item.tax} for item in items], quote.adjustment)
        for key, value in totals.items():
            setattr(quote, key, value)
        quote.save(update_fields=["subtotal", "discount", "tax", "adjustment", "grand_total", "updated_at"])

    def _hydrate_quote_relationships(self, data: dict[str, Any]) -> None:
        deal = data.get("deal")
        if deal:
            data.setdefault("account", getattr(deal, "account", None))
            data.setdefault("contact", getattr(deal, "contact", None))
        _hydrate_software_defaults_from_items(data)

    def _resolve_price_book_price(self, *, price_book: PriceBook | None, product: Product, quantity: Any) -> tuple[Decimal, Decimal]:
        list_price = product.unit_price
        discount_value = MONEY_ZERO
        if price_book:
            product_link = (
                PriceBookProduct.objects.filter(price_book=price_book, product=product, active=True)
                .only("list_price")
                .first()
            )
            if product_link:
                list_price = product_link.list_price
            quantity_value = max(int(as_money(quantity)), 0)
            if price_book.pricing_model == PriceBook.PricingModel.RANGE and quantity_value > 0:
                discount_range = (
                    price_book.ranges.filter(from_range__lte=quantity_value, to_range__gte=quantity_value)
                    .order_by("from_range")
                    .first()
                )
                if discount_range:
                    line_amount = as_money(quantity) * as_money(list_price)
                    discount_value = (
                        line_amount * as_money(discount_range.discount_percentage) / Decimal("100.00")
                    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return as_money(list_price), discount_value

    def _prepare_items(self, *, items: list[dict[str, Any]], price_book: PriceBook | None) -> list[dict[str, Any]]:
        prepared = []
        for item in items:
            merged = dict(item)
            product = merged.get("product")
            if product:
                list_price, computed_discount = self._resolve_price_book_price(
                    price_book=price_book,
                    product=product,
                    quantity=merged.get("quantity"),
                )
                if as_money(merged.get("list_price")) <= MONEY_ZERO:
                    merged["list_price"] = list_price
                if as_money(merged.get("tax")) <= MONEY_ZERO:
                    merged["tax"] = product.tax
                if as_money(merged.get("discount")) <= MONEY_ZERO and computed_discount > MONEY_ZERO:
                    merged["discount"] = computed_discount
            prepared.append(merged)
        return prepared

    @transaction.atomic
    def convert_to_sales_order(self, *, quote: Quote, user):
        sales_order = SalesOrder.objects.create(
            owner=quote.owner or user,
            subject=quote.subject,
            status=DEFAULT_SALES_ORDER_STATUS,
            customer_no=_resolve_account_customer_number(quote.account),
            quote=quote,
            account=quote.account,
            contact=quote.contact,
            deal=quote.deal,
            billing_street=quote.billing_street,
            billing_city=quote.billing_city,
            billing_state=quote.billing_state,
            billing_country=quote.billing_country,
            billing_zip_code=quote.billing_zip_code,
            shipping_street=quote.shipping_street,
            shipping_city=quote.shipping_city,
            shipping_state=quote.shipping_state,
            shipping_country=quote.shipping_country,
            shipping_zip_code=quote.shipping_zip_code,
            billing_cycle=quote.billing_cycle,
            license_type=quote.license_type,
            licensed_users=quote.licensed_users,
            implementation_required=quote.implementation_required,
            subscription_start_date=quote.subscription_start_date,
            subscription_end_date=quote.subscription_end_date,
            renewal_due_date=quote.renewal_due_date,
            terms_and_conditions=quote.terms_and_conditions,
            description=quote.description,
            subtotal=quote.subtotal,
            discount=quote.discount,
            tax=quote.tax,
            adjustment=quote.adjustment,
            grand_total=quote.grand_total,
        )
        created_items = []
        for item in quote.items.all():
            created_items.append(SalesOrderItem.objects.create(
                sales_order=sales_order,
                product=item.product,
                quantity=item.quantity,
                list_price=item.list_price,
                amount=item.amount,
                discount=item.discount,
                tax=item.tax,
                total=item.total,
                row_description=item.row_description,
            ))
        _sync_document_links(
            parent=sales_order,
            parent_field_name="sales_order",
            relationship_label="Sales Order Item",
            items=created_items,
            account=sales_order.account,
            contact=sales_order.contact,
            deal=sales_order.deal,
        )
        return sales_order


@dataclass
class SalesOrderService:
    def list_sales_orders(self, *, user):
        queryset = SalesOrder.objects.filter(is_active=True).select_related(
            "owner",
            "quote",
            "account",
            "contact",
            "deal",
        ).prefetch_related(
            Prefetch("items", queryset=SalesOrderItem.objects.select_related("product").filter(is_active=True))
        )
        return filter_queryset_for_user(queryset, user)

    def get_sales_order(self, *, sales_order_id: int, user):
        return self.list_sales_orders(user=user).get(pk=sales_order_id)

    @transaction.atomic
    def create_sales_order(self, *, data: dict[str, Any], user):
        items = data.pop("items", [])
        self._hydrate_sales_order_relationships(data)
        _ensure_sales_order_defaults(data)
        items = data.pop("items", items)
        if not data.get("owner"):
            data["owner"] = user
        sales_order = SalesOrder.objects.create(**data)
        created_items = _replace_items(
            sales_order,
            SalesOrderItem,
            "items",
            self._prepare_items(items=items),
            parent_field_name="sales_order",
        )
        self._apply_totals(sales_order, created_items)
        _sync_document_links(
            parent=sales_order,
            parent_field_name="sales_order",
            relationship_label="Sales Order Item",
            items=created_items,
            account=sales_order.account,
            contact=sales_order.contact,
            deal=sales_order.deal,
        )
        return sales_order

    @transaction.atomic
    def update_sales_order(self, *, sales_order: SalesOrder, data: dict[str, Any]):
        items = data.pop("items", None)
        self._hydrate_sales_order_relationships(data)
        _ensure_sales_order_defaults(data)
        items = data.pop("items", items)
        for field, value in data.items():
            setattr(sales_order, field, value)
        sales_order.save()
        line_items = list(sales_order.items.all())
        if items is not None:
            line_items = _replace_items(
                sales_order,
                SalesOrderItem,
                "items",
                self._prepare_items(items=items),
                parent_field_name="sales_order",
            )
        self._apply_totals(sales_order, line_items)
        _sync_document_links(
            parent=sales_order,
            parent_field_name="sales_order",
            relationship_label="Sales Order Item",
            items=line_items,
            account=sales_order.account,
            contact=sales_order.contact,
            deal=sales_order.deal,
        )
        return sales_order

    def _apply_totals(self, sales_order: SalesOrder, items):
        totals = calculate_document_totals([{"amount": item.amount, "discount": item.discount, "tax": item.tax} for item in items], sales_order.adjustment)
        for key, value in totals.items():
            setattr(sales_order, key, value)
        sales_order.save(update_fields=["subtotal", "discount", "tax", "adjustment", "grand_total", "updated_at"])

    def _hydrate_sales_order_relationships(self, data: dict[str, Any]) -> None:
        quote = data.get("quote")
        if not quote:
            account = data.get("account")
            if account and not str(data.get("customer_no") or "").strip():
                data["customer_no"] = _resolve_account_customer_number(account)
            _hydrate_software_defaults_from_items(data)
            return
        data.setdefault("account", quote.account)
        data.setdefault("contact", quote.contact)
        data.setdefault("deal", quote.deal)
        if not str(data.get("customer_no") or "").strip():
            data["customer_no"] = _resolve_account_customer_number(data.get("account"))
        for field in ("subject", "terms_and_conditions", "description", "adjustment"):
            data.setdefault(field, getattr(quote, field, None))
        _copy_software_contract_fields(quote, data)
        if not data.get("items"):
            data["items"] = [
                {
                    "product": item.product,
                    "quantity": item.quantity,
                    "list_price": item.list_price,
                    "discount": item.discount,
                    "tax": item.tax,
                    "row_description": item.row_description,
                }
                for item in quote.items.filter(is_active=True)
            ]
        _copy_inventory_address(quote, data)
        _hydrate_software_defaults_from_items(data)

    def _prepare_items(self, *, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        prepared = []
        for item in items:
            merged = dict(item)
            product = merged.get("product")
            if product and as_money(merged.get("tax")) <= MONEY_ZERO:
                merged["tax"] = product.tax
            if product and as_money(merged.get("list_price")) <= MONEY_ZERO:
                merged["list_price"] = product.unit_price
            prepared.append(merged)
        return prepared

    @transaction.atomic
    def convert_to_invoice(self, *, sales_order: SalesOrder, user):
        invoice = Invoice.objects.create(
            owner=sales_order.owner or user,
            subject=sales_order.subject,
            invoice_date=timezone.localdate(),
            due_date=sales_order.due_date or timezone.localdate(),
            status=DEFAULT_INVOICE_STATUS,
            account=sales_order.account,
            contact=sales_order.contact,
            deal=sales_order.deal,
            sales_order=sales_order,
            billing_street=sales_order.billing_street,
            billing_city=sales_order.billing_city,
            billing_state=sales_order.billing_state,
            billing_country=sales_order.billing_country,
            billing_zip_code=sales_order.billing_zip_code,
            shipping_street=sales_order.shipping_street,
            shipping_city=sales_order.shipping_city,
            shipping_state=sales_order.shipping_state,
            shipping_country=sales_order.shipping_country,
            shipping_zip_code=sales_order.shipping_zip_code,
            billing_cycle=sales_order.billing_cycle,
            license_type=sales_order.license_type,
            licensed_users=sales_order.licensed_users,
            implementation_required=sales_order.implementation_required,
            subscription_start_date=sales_order.subscription_start_date,
            subscription_end_date=sales_order.subscription_end_date,
            renewal_due_date=sales_order.renewal_due_date,
            terms_and_conditions=sales_order.terms_and_conditions,
            description=sales_order.description,
            subtotal=sales_order.subtotal,
            discount=sales_order.discount,
            tax=sales_order.tax,
            adjustment=sales_order.adjustment,
            grand_total=sales_order.grand_total,
        )
        created_items = []
        for item in sales_order.items.all():
            created_items.append(InvoiceItem.objects.create(
                invoice=invoice,
                product=item.product,
                quantity=item.quantity,
                list_price=item.list_price,
                amount=item.amount,
                discount=item.discount,
                tax=item.tax,
                total=item.total,
                row_description=item.row_description,
            ))
        _sync_document_links(
            parent=invoice,
            parent_field_name="invoice",
            relationship_label="Invoice Item",
            items=created_items,
            account=invoice.account,
            contact=invoice.contact,
            deal=invoice.deal,
        )
        return invoice


@dataclass
class PurchaseOrderService:
    def list_purchase_orders(self, *, user):
        queryset = PurchaseOrder.objects.filter(is_active=True).select_related(
            "owner",
            "vendor",
            "contact",
        ).prefetch_related(
            Prefetch("items", queryset=PurchaseOrderItem.objects.select_related("product").filter(is_active=True))
        )
        return filter_queryset_for_user(queryset, user)

    def get_purchase_order(self, *, purchase_order_id: int, user):
        return self.list_purchase_orders(user=user).get(pk=purchase_order_id)

    @transaction.atomic
    def create_purchase_order(self, *, data: dict[str, Any], user):
        items = data.pop("items", [])
        self._hydrate_purchase_order_relationships(data)
        _ensure_purchase_order_defaults(data)
        items = data.pop("items", items)
        if not data.get("owner"):
            data["owner"] = user
        purchase_order = PurchaseOrder.objects.create(**data)
        if not str(purchase_order.po_number or "").strip():
            purchase_order.po_number = generate_purchase_order_number(purchase_order.id)
            purchase_order.save(update_fields=["po_number", "updated_at"])
        created_items = _replace_items(
            purchase_order,
            PurchaseOrderItem,
            "items",
            self._prepare_items(items=items),
            parent_field_name="purchase_order",
        )
        self._apply_totals(purchase_order, created_items)
        _sync_document_links(
            parent=purchase_order,
            parent_field_name="purchase_order",
            relationship_label="Purchase Order Item",
            items=created_items,
            contact=purchase_order.contact,
            vendor=purchase_order.vendor,
        )
        return purchase_order

    @transaction.atomic
    def update_purchase_order(self, *, purchase_order: PurchaseOrder, data: dict[str, Any]):
        items = data.pop("items", None)
        self._hydrate_purchase_order_relationships(data)
        _ensure_purchase_order_defaults(data)
        items = data.pop("items", items)
        for field, value in data.items():
            setattr(purchase_order, field, value)
        if not str(purchase_order.po_number or "").strip():
            purchase_order.po_number = generate_purchase_order_number(purchase_order.id)
        purchase_order.save()
        line_items = list(purchase_order.items.all())
        if items is not None:
            line_items = _replace_items(
                purchase_order,
                PurchaseOrderItem,
                "items",
                self._prepare_items(items=items),
                parent_field_name="purchase_order",
            )
        self._apply_totals(purchase_order, line_items)
        _sync_document_links(
            parent=purchase_order,
            parent_field_name="purchase_order",
            relationship_label="Purchase Order Item",
            items=line_items,
            contact=purchase_order.contact,
            vendor=purchase_order.vendor,
        )
        return purchase_order

    def _apply_totals(self, purchase_order: PurchaseOrder, items):
        totals = calculate_document_totals([{"amount": item.amount, "discount": item.discount, "tax": item.tax} for item in items], purchase_order.adjustment)
        for key, value in totals.items():
            setattr(purchase_order, key, value)
        purchase_order.save(update_fields=["subtotal", "discount", "tax", "adjustment", "grand_total", "updated_at"])

    def _hydrate_purchase_order_relationships(self, data: dict[str, Any]) -> None:
        vendor = data.get("vendor")
        if vendor:
            for field in (
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
            ):
                data.setdefault(field, getattr(vendor, field, None))

    def _prepare_items(self, *, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        prepared = []
        for item in items:
            merged = dict(item)
            product = merged.get("product")
            if product and as_money(merged.get("tax")) <= MONEY_ZERO:
                merged["tax"] = product.tax
            prepared.append(merged)
        return prepared


@dataclass
class InvoiceService:
    def list_invoices(self, *, user):
        queryset = Invoice.objects.filter(is_active=True).select_related(
            "owner",
            "account",
            "contact",
            "deal",
            "sales_order",
            "purchase_order",
        ).prefetch_related(
            Prefetch("items", queryset=InvoiceItem.objects.select_related("product").filter(is_active=True))
        )
        return filter_queryset_for_user(queryset, user)

    def get_invoice(self, *, invoice_id: int, user):
        return self.list_invoices(user=user).get(pk=invoice_id)

    @transaction.atomic
    def create_invoice(self, *, data: dict[str, Any], user):
        items = data.pop("items", [])
        self._hydrate_invoice_relationships(data)
        _ensure_invoice_defaults(data)
        items = data.pop("items", items)
        if not data.get("owner"):
            data["owner"] = user
        invoice = Invoice.objects.create(**data)
        created_items = _replace_items(
            invoice,
            InvoiceItem,
            "items",
            self._prepare_items(items=items),
            parent_field_name="invoice",
        )
        self._apply_totals(invoice, created_items)
        _sync_document_links(
            parent=invoice,
            parent_field_name="invoice",
            relationship_label="Invoice Item",
            items=created_items,
            account=invoice.account,
            contact=invoice.contact,
            deal=invoice.deal,
        )
        return invoice

    @transaction.atomic
    def update_invoice(self, *, invoice: Invoice, data: dict[str, Any]):
        items = data.pop("items", None)
        self._hydrate_invoice_relationships(data)
        _ensure_invoice_defaults(data)
        items = data.pop("items", items)
        for field, value in data.items():
            setattr(invoice, field, value)
        invoice.save()
        line_items = list(invoice.items.all())
        if items is not None:
            line_items = _replace_items(
                invoice,
                InvoiceItem,
                "items",
                self._prepare_items(items=items),
                parent_field_name="invoice",
            )
        self._apply_totals(invoice, line_items)
        _sync_document_links(
            parent=invoice,
            parent_field_name="invoice",
            relationship_label="Invoice Item",
            items=line_items,
            account=invoice.account,
            contact=invoice.contact,
            deal=invoice.deal,
        )
        return invoice

    def _apply_totals(self, invoice: Invoice, items):
        totals = calculate_document_totals([{"amount": item.amount, "discount": item.discount, "tax": item.tax} for item in items], invoice.adjustment)
        for key, value in totals.items():
            setattr(invoice, key, value)
        invoice.save(update_fields=["subtotal", "discount", "tax", "adjustment", "grand_total", "updated_at"])

    def _hydrate_invoice_relationships(self, data: dict[str, Any]) -> None:
        sales_order = data.get("sales_order")
        purchase_order = data.get("purchase_order")
        source = sales_order or purchase_order
        if sales_order:
            data.setdefault("account", sales_order.account)
            data.setdefault("contact", sales_order.contact)
            data.setdefault("deal", sales_order.deal)
            data.setdefault("due_date", sales_order.due_date)
        elif purchase_order:
            data.setdefault("contact", purchase_order.contact)
            data.setdefault("due_date", purchase_order.due_date)
        if source:
            for field in ("subject", "terms_and_conditions", "description", "adjustment"):
                data.setdefault(field, getattr(source, field, None))
            _copy_software_contract_fields(source, data)
            if not data.get("items"):
                data["items"] = [
                    {
                        "product": item.product,
                        "quantity": item.quantity,
                        "list_price": item.list_price,
                        "discount": item.discount,
                        "tax": item.tax,
                        "row_description": item.row_description,
                    }
                    for item in source.items.filter(is_active=True)
                ]
            _copy_inventory_address(source, data)
        _hydrate_software_defaults_from_items(data)

    def _prepare_items(self, *, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        prepared = []
        for item in items:
            merged = dict(item)
            product = merged.get("product")
            if product and as_money(merged.get("tax")) <= MONEY_ZERO:
                merged["tax"] = product.tax
            if product and as_money(merged.get("list_price")) <= MONEY_ZERO:
                merged["list_price"] = product.unit_price
            prepared.append(merged)
        return prepared

    def review_changes(self, *, items: list[dict[str, Any]], adjustment: Any):
        calculated_items = []
        for item in items:
            merged = dict(item)
            merged.update(calculate_line_totals(
                quantity=item.get("quantity"),
                list_price=item.get("list_price"),
                discount=item.get("discount"),
                tax=item.get("tax"),
            ))
            calculated_items.append(merged)
        totals = calculate_document_totals(calculated_items, adjustment)
        return {"items": calculated_items, **totals}


@dataclass
class ConfiguratorService:
    def list_configurators(self):
        return ProductConfigurator.objects.filter(is_active=True).prefetch_related(
            Prefetch("rules", queryset=ConfiguratorRule.objects.filter(is_active=True).select_related("target_product"))
        )

    @transaction.atomic
    def create_configurator(self, *, data: dict[str, Any]):
        rules = data.pop("rules", [])
        configurator = ProductConfigurator.objects.create(**data)
        self._sync_rules(configurator=configurator, rules=rules)
        return configurator

    @transaction.atomic
    def update_configurator(self, *, configurator: ProductConfigurator, data: dict[str, Any]):
        rules = data.pop("rules", None)
        for field, value in data.items():
            setattr(configurator, field, value)
        configurator.save()
        if rules is not None:
            self._sync_rules(configurator=configurator, rules=rules)
        return configurator

    def _sync_rules(self, *, configurator: ProductConfigurator, rules: list[dict[str, Any]]):
        configurator.rules.all().delete()
        for item in rules:
            ConfiguratorRule.objects.create(configurator=configurator, **item)


product_service = ProductService()
vendor_service = VendorService()
price_book_service = PriceBookService()
quote_service = QuoteService()
sales_order_service = SalesOrderService()
purchase_order_service = PurchaseOrderService()
invoice_service = InvoiceService()
configurator_service = ConfiguratorService()
