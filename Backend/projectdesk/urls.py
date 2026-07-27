from rest_framework.routers import DefaultRouter

from .views import ProjectDeskMeetingViewSet, ProjectDeskTaskViewSet

router = DefaultRouter()
router.register(r"projectdesk/tasks", ProjectDeskTaskViewSet, basename="projectdesk-task")
router.register(r"projectdesk/meetings", ProjectDeskMeetingViewSet, basename="projectdesk-meeting")

urlpatterns = router.urls

