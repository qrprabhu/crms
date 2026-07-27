from django.urls import re_path
from rest_framework.routers import DefaultRouter

from .views import DealViewSet

router = DefaultRouter()
router.register("deals", DealViewSet, basename="deal")

deal_import_view = DealViewSet.as_view({"post": "import_records"})

urlpatterns = [
    re_path(r"^deals/import/?$", deal_import_view, name="deal-import"),
    *router.urls,
]
