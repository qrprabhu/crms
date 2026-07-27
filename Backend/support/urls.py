from django.urls import re_path
from rest_framework.routers import DefaultRouter

from .views import (
    SupportCaseViewSet,
    SupportLookupAPIView,
    SupportQuickCreateProductAPIView,
    SupportSolutionViewSet,
)

router = DefaultRouter()
router.register(r"cases", SupportCaseViewSet, basename="case")
router.register(r"solutions", SupportSolutionViewSet, basename="solution")
router.register(r"support/cases", SupportCaseViewSet, basename="support-case")
router.register(r"support/solutions", SupportSolutionViewSet, basename="support-solution")

urlpatterns = [
    *router.urls,
    re_path(r"^support/lookups/(?P<lookup_name>[^/]+)/?$", SupportLookupAPIView.as_view(), name="support-lookup"),
    re_path(r"^support/products/quick-create/?$", SupportQuickCreateProductAPIView.as_view(), name="support-product-quick-create"),
]
