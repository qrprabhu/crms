from rest_framework.routers import DefaultRouter
from django.urls import re_path

from .views import ContactViewSet

router = DefaultRouter()
router.register("contacts", ContactViewSet, basename="contact")

contact_import_view = ContactViewSet.as_view({"post": "import_records"})

urlpatterns = [
    *router.urls,
    re_path(r"^contact/import/?$", contact_import_view),
    re_path(r"^contacts/import/?$", contact_import_view),
]
