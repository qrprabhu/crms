from django.urls import re_path
from rest_framework.routers import DefaultRouter

from .views import (
    ConfiguratorRuleViewSet,
    InventoryLookupAPIView,
    InvoiceViewSet,
    PriceBookViewSet,
    ProductConfiguratorViewSet,
    ProductViewSet,
    PurchaseOrderViewSet,
    QuoteViewSet,
    SalesOrderViewSet,
    VendorViewSet,
)

router = DefaultRouter()
router.register(r"products", ProductViewSet, basename="product")
router.register(r"vendors", VendorViewSet, basename="vendor")
router.register(r"price-books", PriceBookViewSet, basename="price-book")
router.register(r"quotes", QuoteViewSet, basename="quote")
router.register(r"sales-orders", SalesOrderViewSet, basename="sales-order")
router.register(r"purchase-orders", PurchaseOrderViewSet, basename="purchase-order")
router.register(r"invoices", InvoiceViewSet, basename="invoice")
router.register(r"inventory/products", ProductViewSet, basename="inventory-product")
router.register(r"inventory/vendors", VendorViewSet, basename="inventory-vendor")
router.register(r"inventory/price-books", PriceBookViewSet, basename="inventory-price-book")
router.register(r"inventory/quotes", QuoteViewSet, basename="inventory-quote")
router.register(r"inventory/sales-orders", SalesOrderViewSet, basename="inventory-sales-order")
router.register(r"inventory/purchase-orders", PurchaseOrderViewSet, basename="inventory-purchase-order")
router.register(r"inventory/invoices", InvoiceViewSet, basename="inventory-invoice")
router.register(r"inventory/configurator", ProductConfiguratorViewSet, basename="inventory-configurator")
router.register(r"inventory/configurator-rules", ConfiguratorRuleViewSet, basename="inventory-configurator-rule")

urlpatterns = [
    *router.urls,
    re_path(r"^inventory/lookups/(?P<lookup_name>[^/]+)/?$", InventoryLookupAPIView.as_view(), name="inventory-lookup"),
]
