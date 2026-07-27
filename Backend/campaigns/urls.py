from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CampaignAttachmentDetailAPIView,
    CampaignPublicSubmitAPIView,
    CampaignSubmissionConvertAPIView,
    CampaignViewSet,
)

router = DefaultRouter()
router.register("campaigns", CampaignViewSet, basename="campaign")

urlpatterns = [
    *router.urls,
    path("attachments/<int:attachment_id>/", CampaignAttachmentDetailAPIView.as_view(), name="campaign-attachment-detail"),
    path(
        "campaign-attachments/<int:attachment_id>/",
        CampaignAttachmentDetailAPIView.as_view(),
        name="campaign-attachment-detail-alt",
    ),
    # Single submission convert (authenticated)
    path(
        "campaign-submissions/<int:submission_id>/convert-to-lead/",
        CampaignSubmissionConvertAPIView.as_view(),
        name="campaign-submission-convert",
    ),
    # Public form submission (no auth required)
    path(
        "public/campaigns/<int:campaign_id>/submit-form/",
        CampaignPublicSubmitAPIView.as_view(),
        name="campaign-public-submit",
    ),
]
