from django.urls import re_path
from rest_framework.routers import DefaultRouter
from .views import LeadViewSet

router = DefaultRouter()
router.register(r'leads', LeadViewSet, basename='lead')

lead_import = LeadViewSet.as_view({"post": "import_records"})

urlpatterns = [
    re_path(r"^leads/import/?$", lead_import, name="lead-import"),
    *router.urls,
]
