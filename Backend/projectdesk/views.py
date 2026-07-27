from django.db.models import Prefetch
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import ProjectDeskMeeting, ProjectDeskMeetingParticipant, ProjectDeskTask
from .serializers import (
    ProjectDeskMeetingAttendanceUpdateSerializer,
    ProjectDeskMeetingSerializer,
    ProjectDeskTaskSerializer,
)


class ProjectDeskTaskViewSet(ModelViewSet):
    serializer_class = ProjectDeskTaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["project"]

    def get_queryset(self):
        return ProjectDeskTask.objects.select_related("project").all()


class ProjectDeskMeetingViewSet(ModelViewSet):
    serializer_class = ProjectDeskMeetingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["project"]

    def get_queryset(self):
        return ProjectDeskMeeting.objects.select_related("project").prefetch_related(
            Prefetch("attendance_records", queryset=ProjectDeskMeetingParticipant.objects.all())
        )

    @action(detail=True, methods=["patch"], url_path="attendance")
    def attendance(self, request, pk=None):
        meeting = self.get_object()
        serializer = ProjectDeskMeetingAttendanceUpdateSerializer(
            data=request.data,
            context={"meeting": meeting},
        )
        serializer.is_valid(raise_exception=True)

        participant = meeting.attendance_records.get(id=serializer.validated_data["participant_id"])
        current_user_email = getattr(request.user, "email", "").strip().lower()
        current_user_name = getattr(request.user, "name", "").strip().lower()
        current_user_role = getattr(request.user, "role", "").strip().lower()
        can_manage_any_attendance = current_user_role in {"admin", "sub_admin", "manager"}
        belongs_to_current_user = (
            participant.participant_email.strip().lower() == current_user_email
            or participant.participant_name.strip().lower() == current_user_name
        )

        if not can_manage_any_attendance and not belongs_to_current_user:
            return Response(
                {"detail": "You can update only your own meeting attendance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer.save()
        meeting.refresh_from_db()
        return Response(ProjectDeskMeetingSerializer(meeting).data)
