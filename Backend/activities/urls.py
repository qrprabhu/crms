from rest_framework.routers import DefaultRouter

from .views import LeadActivityViewSet, TaskViewSet, MeetingViewSet, CallViewSet

router = DefaultRouter()
router.register("lead-activities", LeadActivityViewSet, basename="lead-activity")
router.register("tasks", TaskViewSet, basename="task")
router.register("meetings", MeetingViewSet, basename="meeting")
router.register("calls", CallViewSet, basename="call")

urlpatterns = router.urls
