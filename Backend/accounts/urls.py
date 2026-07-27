from rest_framework.routers import DefaultRouter
from django.urls import path, re_path

from .views import AccountAttachmentDetailAPIView, AccountViewSet

router = DefaultRouter()
router.register("accounts", AccountViewSet, basename="account")

account_import_view = AccountViewSet.as_view({"post": "import_records"})

urlpatterns = [
    *router.urls,
    re_path(r"^accounts/import/?$", account_import_view, name="account-import"),
    path("attachments/<int:attachment_id>/", AccountAttachmentDetailAPIView.as_view(), name="account-attachment-detail"),
]
