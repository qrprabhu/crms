from __future__ import annotations

from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Account
from contacts.models import Contact
from deals.models import Deal
from support.models import SupportCase, SupportSolution
from support.serializers import SupportCaseListSerializer, SupportSolutionListSerializer

from .filters import (
    ConfiguratorRuleFilter,
    InvoiceFilter,
    PriceBookFilter,
    ProductConfiguratorFilter,
    ProductFilter,
    PurchaseOrderFilter,
    QuoteFilter,
    SalesOrderFilter,
    VendorFilter,
)
from .models import (
    ConfiguratorRule,
    Invoice,
    InventoryActivity,
    InventoryAttachment,
    InventoryEmailLog,
    InventoryLinkedRecord,
    InventoryNote,
    PurchaseOrder,
    Quote,
    SalesOrder,
)
from .permissions import OwnerPermission, VendorPermission
from .serializers import (
    ConfiguratorRuleSerializer,
    InventoryActivitySerializer,
    InventoryAttachmentSerializer,
    InventoryEmailLogSerializer,
    InventoryLinkedRecordSerializer,
    InventoryNoteSerializer,
    InvoiceDetailSerializer,
    InvoiceListSerializer,
    InvoiceReviewSerializer,
    InvoiceWriteSerializer,
    PriceBookDetailSerializer,
    PriceBookImportRequestSerializer,
    PriceBookListSerializer,
    PriceBookProductSerializer,
    PriceBookWriteSerializer,
    ProductConfiguratorDetailSerializer,
    ProductConfiguratorListSerializer,
    ProductConfiguratorWriteSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    ProductLookupSerializer,
    ProductWriteSerializer,
    PurchaseOrderDetailSerializer,
    PurchaseOrderListSerializer,
    PurchaseOrderWriteSerializer,
    QuoteDetailSerializer,
    QuoteListSerializer,
    QuoteWriteSerializer,
    SalesOrderDetailSerializer,
    SalesOrderListSerializer,
    SalesOrderWriteSerializer,
    VendorDetailSerializer,
    VendorListSerializer,
    VendorLookupSerializer,
    VendorWriteSerializer,
)
from .services import (
    configurator_service,
    invoice_service,
    price_book_service,
    product_service,
    purchase_order_service,
    quote_service,
    sales_order_service,
    vendor_service,
)


class InventoryRelatedMixin:
    related_parent_field = ""
    ordering_fields: list[str] = []

    def _parent_filter(self, pk: int) -> dict:
        return {self.related_parent_field: pk}

    def _apply_sort(self, queryset):
        sort = self.request.query_params.get("sort")
        if not sort:
            return queryset
        allowed = set(getattr(self, "ordering_fields", []))
        normalized = sort[1:] if sort.startswith("-") else sort
        if normalized in allowed:
            return queryset.order_by(sort)
        return queryset

    def _get_support_case_queryset(self, obj):
        return SupportCase.objects.none()

    def _get_support_solution_queryset(self, obj):
        return SupportSolution.objects.none()

    @action(detail=True, methods=["get", "post"], url_path="notes")
    def notes(self, request, pk=None):
        if request.method == "GET":
            queryset = InventoryNote.objects.filter(**self._parent_filter(pk)).select_related("created_by")
            return Response(InventoryNoteSerializer(queryset, many=True).data)
        serializer = InventoryNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = InventoryNote.objects.create(
            **self._parent_filter(pk),
            created_by=request.user,
            note=serializer.validated_data["note"],
        )
        return Response(InventoryNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="activities")
    def activities(self, request, pk=None):
        if request.method == "GET":
            queryset = InventoryActivity.objects.filter(**self._parent_filter(pk)).select_related("user")
            activity_status = (request.query_params.get("status") or "").strip().lower()
            if activity_status == "open":
                queryset = queryset.filter(is_closed=False)
            elif activity_status == "closed":
                queryset = queryset.filter(is_closed=True)
            return Response(InventoryActivitySerializer(queryset, many=True).data)
        serializer = InventoryActivitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        activity = InventoryActivity.objects.create(**self._parent_filter(pk), user=request.user, **serializer.validated_data)
        return Response(InventoryActivitySerializer(activity).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="open-activities")
    def open_activities(self, request, pk=None):
        queryset = InventoryActivity.objects.filter(
            **self._parent_filter(pk),
            is_closed=False,
        ).select_related("user")
        return Response(InventoryActivitySerializer(queryset, many=True).data)

    @action(detail=True, methods=["get"], url_path="closed-activities")
    def closed_activities(self, request, pk=None):
        queryset = InventoryActivity.objects.filter(
            **self._parent_filter(pk),
            is_closed=True,
        ).select_related("user")
        return Response(InventoryActivitySerializer(queryset, many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, pk=None):
        if request.method == "GET":
            queryset = InventoryAttachment.objects.filter(**self._parent_filter(pk)).select_related("uploaded_by")
            return Response(InventoryAttachmentSerializer(queryset, many=True).data)
        if "file" not in request.data:
            return Response({"file": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        attachment = InventoryAttachment.objects.create(**self._parent_filter(pk), uploaded_by=request.user, file=request.data["file"])
        return Response(InventoryAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="emails")
    def emails(self, request, pk=None):
        if request.method == "GET":
            queryset = InventoryEmailLog.objects.filter(**self._parent_filter(pk)).select_related("sent_by")
            return Response(InventoryEmailLogSerializer(queryset, many=True).data)
        serializer = InventoryEmailLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_log = InventoryEmailLog.objects.create(**self._parent_filter(pk), sent_by=request.user, **serializer.validated_data)
        return Response(InventoryEmailLogSerializer(email_log).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="related-records")
    def related_records(self, request, pk=None):
        if request.method == "GET":
            queryset = InventoryLinkedRecord.objects.filter(**self._parent_filter(pk)).select_related("account", "contact", "deal", "lead")
            return Response(InventoryLinkedRecordSerializer(queryset, many=True).data)
        serializer = InventoryLinkedRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        linked = InventoryLinkedRecord.objects.create(**self._parent_filter(pk), **serializer.validated_data)
        return Response(InventoryLinkedRecordSerializer(linked).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="cases")
    def cases(self, request, pk=None):
        obj = self.get_object()
        queryset = self._get_support_case_queryset(obj)
        return Response(SupportCaseListSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get"], url_path="solutions")
    def solutions(self, request, pk=None):
        obj = self.get_object()
        queryset = self._get_support_solution_queryset(obj)
        return Response(SupportSolutionListSerializer(queryset, many=True).data)


class ProductViewSet(InventoryRelatedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, OwnerPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ProductFilter
    search_fields = ["product_name", "product_code", "manufacturer", "product_category", "vendor__vendor_name"]
    ordering_fields = ["created_at", "updated_at", "product_name", "product_code", "quantity_in_stock", "unit_price"]
    ordering = ["-created_at"]
    related_parent_field = "product_id"

    def _get_support_case_queryset(self, obj):
        return (
            SupportCase.objects.filter(is_active=True)
            .filter(Q(product=obj) | Q(linked_records__product=obj))
            .select_related("owner", "product", "related_contact", "account", "deal")
            .distinct()
        )

    def _get_support_solution_queryset(self, obj):
        return (
            SupportSolution.objects.filter(is_active=True)
            .filter(Q(product=obj) | Q(linked_records__product=obj))
            .select_related("owner", "product")
            .distinct()
        )

    def get_queryset(self):
        return self._apply_sort(product_service.list_products(user=self.request.user))

    def get_serializer_class(self):
        if self.action == "list":
            return ProductListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return ProductWriteSerializer
        return ProductDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = product_service.create_product(data=serializer.validated_data, user=request.user)
        return Response(ProductDetailSerializer(product).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        product = self.get_object()
        serializer = self.get_serializer(product, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        updated = product_service.update_product(product=product, data=serializer.validated_data)
        return Response(ProductDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        product_service.delete_product(product=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request):
        queryset = self.get_queryset()
        term = (request.query_params.get("q") or "").strip()
        if term:
            queryset = queryset.filter(Q(product_name__icontains=term) | Q(product_code__icontains=term))
        return Response(ProductLookupSerializer(queryset[:25], many=True).data)

    @action(detail=True, methods=["get"], url_path="price-books")
    def price_books(self, request, pk=None):
        product = self.get_object()
        return Response(PriceBookListSerializer(product.price_books.filter(is_active=True), many=True).data)

    @action(detail=True, methods=["get"], url_path="quotes")
    def quotes(self, request, pk=None):
        product = self.get_object()
        queryset = Quote.objects.filter(is_active=True, items__product=product).distinct()
        return Response(QuoteListSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get"], url_path="sales-orders")
    def sales_orders(self, request, pk=None):
        product = self.get_object()
        queryset = SalesOrder.objects.filter(is_active=True, items__product=product).distinct()
        return Response(SalesOrderListSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get"], url_path="purchase-orders")
    def purchase_orders(self, request, pk=None):
        product = self.get_object()
        queryset = PurchaseOrder.objects.filter(is_active=True, items__product=product).distinct()
        return Response(PurchaseOrderListSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get"], url_path="invoices")
    def invoices(self, request, pk=None):
        product = self.get_object()
        queryset = Invoice.objects.filter(is_active=True, items__product=product).distinct()
        return Response(InvoiceListSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get"], url_path="vendors")
    def vendors(self, request, pk=None):
        product = self.get_object()
        vendors = [product.vendor] if product.vendor and product.vendor.is_active else []
        return Response(VendorListSerializer(vendors, many=True).data)


class VendorViewSet(InventoryRelatedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, VendorPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = VendorFilter
    search_fields = ["vendor_name", "email", "phone", "website", "category"]
    ordering_fields = ["created_at", "updated_at", "vendor_name"]
    ordering = ["-created_at"]
    related_parent_field = "vendor_id"

    def _get_support_case_queryset(self, obj):
        return (
            SupportCase.objects.filter(is_active=True)
            .filter(
                Q(linked_records__vendor=obj)
                | Q(product__vendor=obj)
                | Q(linked_records__product__vendor=obj)
            )
            .select_related("owner", "product", "related_contact", "account", "deal")
            .distinct()
        )

    def _get_support_solution_queryset(self, obj):
        return (
            SupportSolution.objects.filter(is_active=True)
            .filter(
                Q(linked_records__vendor=obj)
                | Q(product__vendor=obj)
                | Q(linked_records__product__vendor=obj)
            )
            .select_related("owner", "product")
            .distinct()
        )

    def get_queryset(self):
        return self._apply_sort(vendor_service.list_vendors(user=self.request.user))

    def get_serializer_class(self):
        if self.action == "list":
            return VendorListSerializer
        if self.action in {"create", "update", "partial_update", "quick_create"}:
            return VendorWriteSerializer
        return VendorDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vendor = vendor_service.create_vendor(data=serializer.validated_data, user=request.user)
        return Response(VendorDetailSerializer(vendor).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        vendor = self.get_object()
        serializer = self.get_serializer(vendor, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        updated = vendor_service.update_vendor(vendor=vendor, data=serializer.validated_data)
        return Response(VendorDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        vendor_service.delete_vendor(vendor=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="quick-create")
    def quick_create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vendor = vendor_service.create_vendor(data=serializer.validated_data, user=request.user)
        return Response(VendorLookupSerializer(vendor).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request):
        queryset = self.get_queryset()
        term = (request.query_params.get("q") or "").strip()
        if term:
            queryset = queryset.filter(Q(vendor_name__icontains=term) | Q(email__icontains=term))
        return Response(VendorLookupSerializer(queryset[:25], many=True).data)

    @action(detail=True, methods=["get"], url_path="products")
    def products(self, request, pk=None):
        vendor = self.get_object()
        return Response(ProductListSerializer(vendor.products.filter(is_active=True), many=True).data)

    @action(detail=True, methods=["get"], url_path="purchase-orders")
    def purchase_orders(self, request, pk=None):
        vendor = self.get_object()
        return Response(PurchaseOrderListSerializer(vendor.purchase_orders.filter(is_active=True), many=True).data)


class PriceBookViewSet(InventoryRelatedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, OwnerPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PriceBookFilter
    search_fields = ["name", "pricing_model", "description"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["-created_at"]
    related_parent_field = "price_book_id"

    def _get_support_case_queryset(self, obj):
        return (
            SupportCase.objects.filter(is_active=True)
            .filter(Q(product__price_books=obj) | Q(linked_records__product__price_books=obj))
            .select_related("owner", "product", "related_contact", "account", "deal")
            .distinct()
        )

    def _get_support_solution_queryset(self, obj):
        return (
            SupportSolution.objects.filter(is_active=True)
            .filter(Q(product__price_books=obj) | Q(linked_records__product__price_books=obj))
            .select_related("owner", "product")
            .distinct()
        )

    def get_queryset(self):
        return self._apply_sort(price_book_service.list_price_books(user=self.request.user))

    def get_serializer_class(self):
        if self.action == "list":
            return PriceBookListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return PriceBookWriteSerializer
        if self.action in {"import_init", "import_schedule"}:
            return PriceBookImportRequestSerializer
        return PriceBookDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        price_book = price_book_service.create_price_book(data=serializer.validated_data, user=request.user)
        return Response(PriceBookDetailSerializer(price_book).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        price_book = self.get_object()
        serializer = self.get_serializer(price_book, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        updated = price_book_service.update_price_book(price_book=price_book, data=serializer.validated_data)
        return Response(PriceBookDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        price_book = self.get_object()
        price_book.is_active = False
        price_book.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="import-init")
    def import_init(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"message": "Price Book import initialized.", "status": "pending_configuration", "payload": serializer.validated_data}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="import-schedule")
    def import_schedule(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"message": "Price Book import schedule placeholder created.", "status": "scheduled", "payload": serializer.validated_data}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="products")
    def products(self, request, pk=None):
        price_book = self.get_object()
        return Response(ProductLookupSerializer(price_book.products.filter(is_active=True), many=True).data)

    @products.mapping.post
    def add_product(self, request, pk=None):
        price_book = self.get_object()
        serializer = PriceBookProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        link, _ = price_book.product_links.update_or_create(
            product=serializer.validated_data["product"],
            defaults={
                "list_price": serializer.validated_data["list_price"],
                "active": serializer.validated_data.get("active", True),
            },
        )
        return Response(PriceBookProductSerializer(link).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="quotes")
    def quotes(self, request, pk=None):
        price_book = self.get_object()
        return Response(QuoteListSerializer(price_book.quotes.filter(is_active=True), many=True).data)


class QuoteViewSet(InventoryRelatedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, OwnerPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = QuoteFilter
    search_fields = ["subject", "quote_stage", "team", "price_book__name", "account__account_name", "contact__first_name", "contact__last_name", "deal__deal_name"]
    ordering_fields = ["created_at", "updated_at", "subject", "valid_until", "grand_total"]
    ordering = ["-created_at"]
    related_parent_field = "quote_id"

    def _get_support_case_queryset(self, obj):
        product_ids = list(obj.items.filter(is_active=True).values_list("product_id", flat=True))
        return (
            SupportCase.objects.filter(is_active=True)
            .filter(
                Q(account=obj.account)
                | Q(related_contact=obj.contact)
                | Q(deal=obj.deal)
                | Q(product_id__in=product_ids)
                | Q(linked_records__account=obj.account)
                | Q(linked_records__contact=obj.contact)
                | Q(linked_records__deal=obj.deal)
                | Q(linked_records__product_id__in=product_ids)
            )
            .select_related("owner", "product", "related_contact", "account", "deal")
            .distinct()
        )

    def _get_support_solution_queryset(self, obj):
        product_ids = list(obj.items.filter(is_active=True).values_list("product_id", flat=True))
        return (
            SupportSolution.objects.filter(is_active=True)
            .filter(
                Q(product_id__in=product_ids)
                | Q(linked_records__account=obj.account)
                | Q(linked_records__contact=obj.contact)
                | Q(linked_records__deal=obj.deal)
                | Q(linked_records__product_id__in=product_ids)
            )
            .select_related("owner", "product")
            .distinct()
        )

    def get_queryset(self):
        return self._apply_sort(quote_service.list_quotes(user=self.request.user))

    def get_serializer_class(self):
        if self.action == "list":
            return QuoteListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return QuoteWriteSerializer
        return QuoteDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quote = quote_service.create_quote(data=serializer.validated_data, user=request.user)
        return Response(QuoteDetailSerializer(quote).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        quote = self.get_object()
        serializer = self.get_serializer(quote, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        updated = quote_service.update_quote(quote=quote, data=serializer.validated_data)
        return Response(QuoteDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        quote = self.get_object()
        quote.is_active = False
        quote.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="convert-to-sales-order")
    def convert_to_sales_order(self, request, pk=None):
        sales_order = quote_service.convert_to_sales_order(quote=self.get_object(), user=request.user)
        return Response(SalesOrderDetailSerializer(sales_order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="sales-orders")
    def sales_orders(self, request, pk=None):
        quote = self.get_object()
        return Response(SalesOrderListSerializer(quote.sales_orders.filter(is_active=True), many=True).data)


class SalesOrderViewSet(InventoryRelatedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, OwnerPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SalesOrderFilter
    search_fields = ["subject", "customer_no", "status", "account__account_name", "contact__first_name", "contact__last_name"]
    ordering_fields = ["created_at", "updated_at", "subject", "due_date", "grand_total"]
    ordering = ["-created_at"]
    related_parent_field = "sales_order_id"

    def _get_support_case_queryset(self, obj):
        product_ids = list(obj.items.filter(is_active=True).values_list("product_id", flat=True))
        return (
            SupportCase.objects.filter(is_active=True)
            .filter(
                Q(account=obj.account)
                | Q(related_contact=obj.contact)
                | Q(deal=obj.deal)
                | Q(product_id__in=product_ids)
                | Q(linked_records__account=obj.account)
                | Q(linked_records__contact=obj.contact)
                | Q(linked_records__deal=obj.deal)
                | Q(linked_records__product_id__in=product_ids)
            )
            .select_related("owner", "product", "related_contact", "account", "deal")
            .distinct()
        )

    def _get_support_solution_queryset(self, obj):
        product_ids = list(obj.items.filter(is_active=True).values_list("product_id", flat=True))
        return (
            SupportSolution.objects.filter(is_active=True)
            .filter(
                Q(product_id__in=product_ids)
                | Q(linked_records__account=obj.account)
                | Q(linked_records__contact=obj.contact)
                | Q(linked_records__deal=obj.deal)
                | Q(linked_records__product_id__in=product_ids)
            )
            .select_related("owner", "product")
            .distinct()
        )

    def get_queryset(self):
        return self._apply_sort(sales_order_service.list_sales_orders(user=self.request.user))

    def get_serializer_class(self):
        if self.action == "list":
            return SalesOrderListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return SalesOrderWriteSerializer
        return SalesOrderDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sales_order = sales_order_service.create_sales_order(data=serializer.validated_data, user=request.user)
        return Response(SalesOrderDetailSerializer(sales_order).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        sales_order = self.get_object()
        serializer = self.get_serializer(sales_order, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        updated = sales_order_service.update_sales_order(sales_order=sales_order, data=serializer.validated_data)
        return Response(SalesOrderDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        sales_order = self.get_object()
        sales_order.is_active = False
        sales_order.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="convert-to-invoice")
    def convert_to_invoice(self, request, pk=None):
        invoice = sales_order_service.convert_to_invoice(sales_order=self.get_object(), user=request.user)
        return Response(InvoiceDetailSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="invoices")
    def invoices(self, request, pk=None):
        sales_order = self.get_object()
        return Response(InvoiceListSerializer(sales_order.invoices.filter(is_active=True), many=True).data)


class PurchaseOrderViewSet(InventoryRelatedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, OwnerPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PurchaseOrderFilter
    search_fields = ["subject", "po_number", "requisition_number", "status", "vendor__vendor_name"]
    ordering_fields = ["created_at", "updated_at", "subject", "due_date", "grand_total"]
    ordering = ["-created_at"]
    related_parent_field = "purchase_order_id"

    def _get_support_case_queryset(self, obj):
        product_ids = list(obj.items.filter(is_active=True).values_list("product_id", flat=True))
        return (
            SupportCase.objects.filter(is_active=True)
            .filter(
                Q(related_contact=obj.contact)
                | Q(product_id__in=product_ids)
                | Q(linked_records__vendor=obj.vendor)
                | Q(linked_records__contact=obj.contact)
                | Q(linked_records__product_id__in=product_ids)
            )
            .select_related("owner", "product", "related_contact", "account", "deal")
            .distinct()
        )

    def _get_support_solution_queryset(self, obj):
        product_ids = list(obj.items.filter(is_active=True).values_list("product_id", flat=True))
        return (
            SupportSolution.objects.filter(is_active=True)
            .filter(
                Q(product_id__in=product_ids)
                | Q(linked_records__vendor=obj.vendor)
                | Q(linked_records__contact=obj.contact)
                | Q(linked_records__product_id__in=product_ids)
            )
            .select_related("owner", "product")
            .distinct()
        )

    def get_queryset(self):
        return self._apply_sort(purchase_order_service.list_purchase_orders(user=self.request.user))

    def get_serializer_class(self):
        if self.action == "list":
            return PurchaseOrderListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return PurchaseOrderWriteSerializer
        return PurchaseOrderDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = purchase_order_service.create_purchase_order(data=serializer.validated_data, user=request.user)
        return Response(PurchaseOrderDetailSerializer(purchase_order).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        purchase_order = self.get_object()
        serializer = self.get_serializer(purchase_order, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        updated = purchase_order_service.update_purchase_order(purchase_order=purchase_order, data=serializer.validated_data)
        return Response(PurchaseOrderDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        purchase_order = self.get_object()
        purchase_order.is_active = False
        purchase_order.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="invoices")
    def invoices(self, request, pk=None):
        purchase_order = self.get_object()
        return Response(InvoiceListSerializer(purchase_order.invoices.filter(is_active=True), many=True).data)


class InvoiceViewSet(InventoryRelatedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, OwnerPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = InvoiceFilter
    search_fields = ["subject", "status", "account__account_name", "contact__first_name", "contact__last_name"]
    ordering_fields = ["created_at", "updated_at", "subject", "invoice_date", "due_date", "grand_total"]
    ordering = ["-created_at"]
    related_parent_field = "invoice_id"

    def _get_support_case_queryset(self, obj):
        product_ids = list(obj.items.filter(is_active=True).values_list("product_id", flat=True))
        return (
            SupportCase.objects.filter(is_active=True)
            .filter(
                Q(account=obj.account)
                | Q(related_contact=obj.contact)
                | Q(deal=obj.deal)
                | Q(product_id__in=product_ids)
                | Q(linked_records__account=obj.account)
                | Q(linked_records__contact=obj.contact)
                | Q(linked_records__deal=obj.deal)
                | Q(linked_records__product_id__in=product_ids)
            )
            .select_related("owner", "product", "related_contact", "account", "deal")
            .distinct()
        )

    def _get_support_solution_queryset(self, obj):
        product_ids = list(obj.items.filter(is_active=True).values_list("product_id", flat=True))
        return (
            SupportSolution.objects.filter(is_active=True)
            .filter(
                Q(product_id__in=product_ids)
                | Q(linked_records__account=obj.account)
                | Q(linked_records__contact=obj.contact)
                | Q(linked_records__deal=obj.deal)
                | Q(linked_records__product_id__in=product_ids)
            )
            .select_related("owner", "product")
            .distinct()
        )

    def get_queryset(self):
        return self._apply_sort(invoice_service.list_invoices(user=self.request.user))

    def get_serializer_class(self):
        if self.action == "list":
            return InvoiceListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return InvoiceWriteSerializer
        if self.action == "review_changes":
            return InvoiceReviewSerializer
        return InvoiceDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = invoice_service.create_invoice(data=serializer.validated_data, user=request.user)
        return Response(InvoiceDetailSerializer(invoice).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        invoice = self.get_object()
        serializer = self.get_serializer(invoice, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        updated = invoice_service.update_invoice(invoice=invoice, data=serializer.validated_data)
        return Response(InvoiceDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        invoice = self.get_object()
        invoice.is_active = False
        invoice.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="review-changes")
    def review_changes(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(invoice_service.review_changes(items=serializer.validated_data.get("items", []), adjustment=serializer.validated_data.get("adjustment")))


class ProductConfiguratorViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ProductConfiguratorFilter
    search_fields = ["name", "target_module", "layout", "subform", "lookup_field"]
    ordering_fields = ["created_at", "updated_at", "name", "target_module"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = configurator_service.list_configurators()
        sort = self.request.query_params.get("sort")
        if sort:
            allowed = set(self.ordering_fields)
            normalized = sort[1:] if sort.startswith("-") else sort
            if normalized in allowed:
                queryset = queryset.order_by(sort)
        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return ProductConfiguratorListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return ProductConfiguratorWriteSerializer
        return ProductConfiguratorDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        configurator = configurator_service.create_configurator(data=serializer.validated_data)
        return Response(ProductConfiguratorDetailSerializer(configurator).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        configurator = self.get_object()
        serializer = self.get_serializer(configurator, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        updated = configurator_service.update_configurator(configurator=configurator, data=serializer.validated_data)
        return Response(ProductConfiguratorDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        configurator = self.get_object()
        configurator.is_active = False
        configurator.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConfiguratorRuleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ConfiguratorRuleFilter
    search_fields = ["field_name", "field_value", "action_type"]
    ordering_fields = ["created_at", "updated_at", "action_type"]
    ordering = ["created_at"]
    serializer_class = ConfiguratorRuleSerializer

    def get_queryset(self):
        queryset = ConfiguratorRule.objects.filter(
            is_active=True,
            configurator__is_active=True,
        ).select_related("configurator", "target_product")
        sort = self.request.query_params.get("sort")
        if sort:
            allowed = set(self.ordering_fields)
            normalized = sort[1:] if sort.startswith("-") else sort
            if normalized in allowed:
                queryset = queryset.order_by(sort)
        return queryset

    def destroy(self, request, *args, **kwargs):
        rule = self.get_object()
        rule.is_active = False
        rule.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class InventoryLookupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, lookup_name: str):
        query = (request.query_params.get("q") or "").strip()
        if lookup_name == "products":
            queryset = product_service.list_products(user=request.user)
            if query:
                queryset = queryset.filter(Q(product_name__icontains=query) | Q(product_code__icontains=query))
            return Response(ProductLookupSerializer(queryset[:25], many=True).data)
        if lookup_name == "vendors":
            queryset = vendor_service.list_vendors(user=request.user)
            if query:
                queryset = queryset.filter(Q(vendor_name__icontains=query) | Q(email__icontains=query))
            return Response(VendorLookupSerializer(queryset[:25], many=True).data)
        if lookup_name == "accounts":
            queryset = Account.objects.filter(is_active=True)
            if query:
                queryset = queryset.filter(account_name__icontains=query)
            return Response([{"id": obj.id, "name": obj.account_name, "label": obj.account_name} for obj in queryset[:25]])
        if lookup_name == "contacts":
            queryset = Contact.objects.filter(is_active=True)
            account_id = request.query_params.get("account_id")
            if account_id:
                queryset = queryset.filter(account_id=account_id)
            if query:
                queryset = queryset.filter(
                    Q(first_name__icontains=query) | Q(last_name__icontains=query) | Q(email__icontains=query)
                )
            return Response(
                [
                    {
                        "id": obj.id,
                        "name": f"{obj.first_name} {obj.last_name}".strip(),
                        "label": f"{obj.first_name} {obj.last_name}".strip(),
                        "email": obj.email,
                        "account_id": obj.account_id,
                    }
                    for obj in queryset[:25]
                ]
            )
        if lookup_name == "deals":
            queryset = Deal.objects.filter(is_active=True)
            if query:
                queryset = queryset.filter(deal_name__icontains=query)
            return Response(
                [
                    {
                        "id": obj.id,
                        "name": obj.deal_name,
                        "label": obj.deal_name,
                        "account_id": obj.account_id,
                        "contact_id": obj.contact_id,
                    }
                    for obj in queryset[:25]
                ]
            )
        if lookup_name == "price-books":
            queryset = price_book_service.list_price_books(user=request.user)
            if query:
                queryset = queryset.filter(name__icontains=query)
            return Response(
                [
                    {"id": obj.id, "name": obj.name, "label": obj.name, "pricing_model": obj.pricing_model}
                    for obj in queryset[:25]
                ]
            )
        if lookup_name == "quotes":
            queryset = quote_service.list_quotes(user=request.user)
            if query:
                queryset = queryset.filter(subject__icontains=query)
            return Response(
                [
                    {
                        "id": obj.id,
                        "name": obj.subject,
                        "label": obj.subject,
                        "account_id": obj.account_id,
                        "contact_id": obj.contact_id,
                        "deal_id": obj.deal_id,
                        "price_book_id": obj.price_book_id,
                    }
                    for obj in queryset[:25]
                ]
            )
        if lookup_name == "sales-orders":
            queryset = sales_order_service.list_sales_orders(user=request.user)
            if query:
                queryset = queryset.filter(subject__icontains=query)
            return Response(
                [
                    {
                        "id": obj.id,
                        "name": obj.subject,
                        "label": obj.subject,
                        "account_id": obj.account_id,
                        "contact_id": obj.contact_id,
                        "deal_id": obj.deal_id,
                        "quote_id": obj.quote_id,
                    }
                    for obj in queryset[:25]
                ]
            )
        if lookup_name == "invoices":
            queryset = invoice_service.list_invoices(user=request.user)
            if query:
                queryset = queryset.filter(subject__icontains=query)
            return Response(
                [
                    {
                        "id": obj.id,
                        "name": obj.subject,
                        "label": obj.subject,
                        "account_id": obj.account_id,
                        "contact_id": obj.contact_id,
                        "deal_id": obj.deal_id,
                        "sales_order_id": obj.sales_order_id,
                    }
                    for obj in queryset[:25]
                ]
            )
        if lookup_name == "purchase-orders":
            queryset = purchase_order_service.list_purchase_orders(user=request.user)
            if query:
                queryset = queryset.filter(subject__icontains=query)
            return Response(
                [
                    {
                        "id": obj.id,
                        "name": obj.subject,
                        "label": obj.subject,
                        "vendor_id": obj.vendor_id,
                        "contact_id": obj.contact_id,
                    }
                    for obj in queryset[:25]
                ]
            )
        return Response({"detail": "Lookup not found."}, status=status.HTTP_404_NOT_FOUND)
