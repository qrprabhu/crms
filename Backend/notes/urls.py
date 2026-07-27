from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import LeadNoteViewSet, NoteDetailAPIView

router = DefaultRouter()
router.register("lead-notes", LeadNoteViewSet, basename="lead-note")

urlpatterns = router.urls
urlpatterns += [
    path("notes/<int:note_id>/", NoteDetailAPIView.as_view(), name="note-detail"),
]
