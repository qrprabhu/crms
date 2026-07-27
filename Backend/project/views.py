import re
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import (
    Project, ProjectTask, ProjectPhase, ProjectIssue,
    ProjectMember, ProjectFile, ProjectNote, ProjectTimeLog,
)
from .serializers import (
    ProjectListSerializer, ProjectDetailSerializer, ProjectCreateUpdateSerializer,
    ProjectTaskSerializer, ProjectPhaseSerializer, ProjectIssueSerializer,
    ProjectMemberSerializer, ProjectFileSerializer, ProjectNoteSerializer,
    ProjectTimeLogSerializer,
)
from . import services


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'owner']
    search_fields = ['name', 'project_code', 'account_name', 'owner']
    ordering_fields = ['created_at', 'name', 'due_date', 'priority', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        return services.get_project_queryset()

    @action(detail=False, methods=["get"], url_path="next-code")
    def next_code(self, request):
        codes = Project.objects.values_list("project_code", flat=True)
        max_num = 0
        for code in codes:
            m = re.match(r"PRJ-?(\d+)$", code, re.IGNORECASE)
            if m:
                max_num = max(max_num, int(m.group(1)))
        next_num = max_num + 1
        return Response({"project_code": f"PRJ{next_num:04d}"})

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ProjectCreateUpdateSerializer
        if self.action == 'retrieve':
            return ProjectDetailSerializer
        return ProjectListSerializer

    def create(self, request, *args, **kwargs):
        serializer = ProjectCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = services.create_project(serializer.validated_data)
        return Response(ProjectDetailSerializer(project).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        project = self.get_object()
        serializer = ProjectCreateUpdateSerializer(project, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        project = services.update_project(project, serializer.validated_data)
        return Response(ProjectDetailSerializer(project).data)

    def destroy(self, request, *args, **kwargs):
        project = self.get_object()
        services.delete_project(project)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Tasks ──────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='tasks')
    def tasks(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            serializer = ProjectTaskSerializer(project.tasks.all(), many=True)
            return Response(serializer.data)
        serializer = ProjectTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = services.add_task(project, serializer.validated_data)
        return Response(ProjectTaskSerializer(task).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path='tasks/(?P<task_id>[^/.]+)')
    def task_detail(self, request, pk=None, task_id=None):
        project = self.get_object()
        try:
            task = project.tasks.get(pk=task_id)
        except ProjectTask.DoesNotExist:
            return Response({'detail': 'Task not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            task.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = ProjectTaskSerializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        task = services.update_task(task, serializer.validated_data)
        return Response(ProjectTaskSerializer(task).data)

    # ── Phases ─────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='phases')
    def phases(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            serializer = ProjectPhaseSerializer(project.phases.all(), many=True)
            return Response(serializer.data)
        serializer = ProjectPhaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phase = services.add_phase(project, serializer.validated_data)
        return Response(ProjectPhaseSerializer(phase).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path='phases/(?P<phase_id>[^/.]+)')
    def phase_detail(self, request, pk=None, phase_id=None):
        project = self.get_object()
        try:
            phase = project.phases.get(pk=phase_id)
        except ProjectPhase.DoesNotExist:
            return Response({'detail': 'Phase not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            phase.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = ProjectPhaseSerializer(phase, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        phase = services.update_phase(phase, serializer.validated_data)
        return Response(ProjectPhaseSerializer(phase).data)

    # ── Issues ─────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='issues')
    def issues(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            serializer = ProjectIssueSerializer(project.issues.all(), many=True)
            return Response(serializer.data)
        serializer = ProjectIssueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        issue = services.add_issue(project, serializer.validated_data)
        return Response(ProjectIssueSerializer(issue).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path='issues/(?P<issue_id>[^/.]+)')
    def issue_detail(self, request, pk=None, issue_id=None):
        project = self.get_object()
        try:
            issue = project.issues.get(pk=issue_id)
        except ProjectIssue.DoesNotExist:
            return Response({'detail': 'Issue not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            issue.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = ProjectIssueSerializer(issue, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        issue = services.update_issue(issue, serializer.validated_data)
        return Response(ProjectIssueSerializer(issue).data)

    # ── Members ────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='members')
    def members(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            serializer = ProjectMemberSerializer(project.members.all(), many=True)
            return Response(serializer.data)
        serializer = ProjectMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = services.add_member(project, serializer.validated_data)
        return Response(ProjectMemberSerializer(member).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='members/(?P<member_id>[^/.]+)')
    def member_detail(self, request, pk=None, member_id=None):
        project = self.get_object()
        try:
            member = project.members.get(pk=member_id)
        except ProjectMember.DoesNotExist:
            return Response({'detail': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Files ──────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='files')
    def files(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            serializer = ProjectFileSerializer(project.files.all(), many=True)
            return Response(serializer.data)
        serializer = ProjectFileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file_obj = services.add_file(project, serializer.validated_data)
        return Response(ProjectFileSerializer(file_obj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='files/(?P<file_id>[^/.]+)')
    def file_detail(self, request, pk=None, file_id=None):
        project = self.get_object()
        try:
            file_obj = project.files.get(pk=file_id)
        except ProjectFile.DoesNotExist:
            return Response({'detail': 'File not found.'}, status=status.HTTP_404_NOT_FOUND)
        file_obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Notes ──────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='notes')
    def notes(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            serializer = ProjectNoteSerializer(project.notes.all(), many=True)
            return Response(serializer.data)
        serializer = ProjectNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = services.add_note(project, serializer.validated_data)
        return Response(ProjectNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path='notes/(?P<note_id>[^/.]+)')
    def note_detail(self, request, pk=None, note_id=None):
        project = self.get_object()
        try:
            note = project.notes.get(pk=note_id)
        except ProjectNote.DoesNotExist:
            return Response({'detail': 'Note not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'PATCH':
            serializer = ProjectNoteSerializer(note, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Time Logs ──────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='time-logs')
    def time_logs(self, request, pk=None):
        project = self.get_object()
        if request.method == 'GET':
            serializer = ProjectTimeLogSerializer(project.time_logs.all(), many=True)
            return Response(serializer.data)
        serializer = ProjectTimeLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        log = services.add_time_log(project, serializer.validated_data)
        return Response(ProjectTimeLogSerializer(log).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='time-logs/(?P<log_id>[^/.]+)')
    def time_log_detail(self, request, pk=None, log_id=None):
        project = self.get_object()
        try:
            log = project.time_logs.get(pk=log_id)
        except ProjectTimeLog.DoesNotExist:
            return Response({'detail': 'Time log not found.'}, status=status.HTTP_404_NOT_FOUND)
        log.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
