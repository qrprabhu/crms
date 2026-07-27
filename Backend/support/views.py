from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from integrations.models import SyncedEmailMessage
from integrations.services import create_outgoing_crm_email, get_user_default_email_provider

from .filters import SupportCaseFilter, SupportSolutionFilter
from .models import SupportImportJob
from .serializers import (
    SupportActivitySerializer,
    SupportAttachmentSerializer,
    SupportCaseDetailSerializer,
    SupportCaseListSerializer,
    SupportCaseWriteSerializer,
    SupportCommentSerializer,
    SupportEmailLogSerializer,
    SupportImportExecuteSerializer,
    SupportImportInspectSerializer,
    SupportImportJobSerializer,
    SupportImportUploadSerializer,
    SupportLinkedRecordSerializer,
    SupportLookupSerializer,
    SupportNoteSerializer,
    SupportQuickCreateProductSerializer,
    SupportSolutionDetailSerializer,
    SupportSolutionListSerializer,
    SupportSolutionWriteSerializer,
    SupportTimelineSerializer,
)
from .services import (
    add_activity,
    add_attachment,
    add_email_log,
    add_linked_record,
    build_lookup_payload,
    create_case,
    create_comment,
    create_import_job,
    create_note,
    create_solution,
    delete_case,
    delete_solution,
    execute_import_job,
    get_case,
    get_import_job,
    get_solution,
    inspect_import_job,
    list_cases,
    list_solutions,
    list_timeline,
    quick_create_product,
    update_case,
    update_solution,
)


class SupportBaseMixin:
    permission_classes = [IsAuthenticated]

    def _sort_queryset(self, queryset):
        sort = self.request.query_params.get("sort")
        if not sort:
            return queryset
        allowed = set(getattr(self, "ordering_fields", []))
        normalized = sort[1:] if sort.startswith("-") else sort
        if normalized in allowed:
            return queryset.order_by(sort)
        return queryset


class SupportCaseViewSet(SupportBaseMixin, viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SupportCaseFilter
    search_fields = [
        "case_number",
        "subject",
        "status",
        "priority",
        "case_origin",
        "company",
        "email",
        "phone",
        "account__account_name",
        "related_contact__first_name",
        "related_contact__last_name",
        "deal__deal_name",
        "product__product_name",
    ]
    ordering_fields = [
        "created_at",
        "updated_at",
        "last_activity_at",
        "case_number",
        "subject",
        "status",
        "priority",
        "case_origin",
        "company",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        return self._sort_queryset(list_cases())

    def get_serializer_class(self):
        if self.action == "list":
            return SupportCaseListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return SupportCaseWriteSerializer
        if self.action in {"notes", "comments"}:
            return SupportNoteSerializer if self.action == "notes" else SupportCommentSerializer
        if self.action == "attachments":
            return SupportAttachmentSerializer
        if self.action == "timeline":
            return SupportTimelineSerializer
        if self.action in {"related_records", "links"}:
            return SupportLinkedRecordSerializer
        if self.action in {"activities", "open_activities", "closed_activities"}:
            return SupportActivitySerializer
        if self.action == "emails":
            return SupportEmailLogSerializer
        if self.action in {"import_upload"}:
            return SupportImportUploadSerializer
        if self.action in {"import_inspect"}:
            return SupportImportInspectSerializer
        if self.action in {"import_execute"}:
            return SupportImportExecuteSerializer
        if self.action in {"import_status"}:
            return SupportImportJobSerializer
        return SupportCaseDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case = create_case(serializer.validated_data, request.user)
        return Response(SupportCaseDetailSerializer(case).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        case = self.get_object()
        return Response(SupportCaseDetailSerializer(case).data)

    def partial_update(self, request, *args, **kwargs):
        case = self.get_object()
        serializer = self.get_serializer(case, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_case(case, serializer.validated_data, request.user)
        return Response(SupportCaseDetailSerializer(updated).data)

    def update(self, request, *args, **kwargs):
        case = self.get_object()
        serializer = self.get_serializer(case, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        updated = update_case(case, serializer.validated_data, request.user)
        return Response(SupportCaseDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        delete_case(self.get_object(), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="notes")
    def notes(self, request, pk=None):
        case = self.get_object()
        if request.method == "GET":
            return Response(SupportNoteSerializer(case.notes.filter(is_active=True), many=True).data)
        serializer = SupportNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = create_note("case", case, serializer.validated_data["note"], request.user)
        return Response(SupportNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        case = self.get_object()
        if request.method == "GET":
            return Response(SupportCommentSerializer(case.comments.filter(is_active=True), many=True).data)
        serializer = SupportCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = create_comment("case", case, serializer.validated_data["comment"], request.user)
        return Response(SupportCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, pk=None):
        case = self.get_object()
        if request.method == "GET":
            return Response(SupportAttachmentSerializer(case.attachments.filter(is_active=True), many=True).data)
        if "file" not in request.data:
            return Response({"file": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        attachment = add_attachment("case", case, request.data["file"], request.user)
        return Response(SupportAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        case = self.get_object()
        return Response(SupportTimelineSerializer(list_timeline("case", case.pk), many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="related-records")
    def related_records(self, request, pk=None):
        case = self.get_object()
        if request.method == "GET":
            return Response(SupportLinkedRecordSerializer(case.linked_records.filter(is_active=True), many=True).data)
        serializer = SupportLinkedRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        linked = add_linked_record("case", case, serializer.validated_data, request.user)
        return Response(SupportLinkedRecordSerializer(linked).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="links")
    def links(self, request, pk=None):
        return self.related_records(request, pk)

    @action(detail=True, methods=["get", "post"], url_path="activities")
    def activities(self, request, pk=None):
        case = self.get_object()
        if request.method == "GET":
            return Response(SupportActivitySerializer(case.activities.filter(is_active=True), many=True).data)
        serializer = SupportActivitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        activity = add_activity("case", case, serializer.validated_data, request.user)
        return Response(SupportActivitySerializer(activity).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="open-activities")
    def open_activities(self, request, pk=None):
        case = self.get_object()
        return Response(SupportActivitySerializer(case.activities.filter(is_active=True, is_closed=False), many=True).data)

    @action(detail=True, methods=["get"], url_path="closed-activities")
    def closed_activities(self, request, pk=None):
        case = self.get_object()
        return Response(SupportActivitySerializer(case.activities.filter(is_active=True, is_closed=True), many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="emails")
    def emails(self, request, pk=None):
        case = self.get_object()
        if request.method == "GET":
            direct_emails = SupportEmailLogSerializer(case.email_logs.filter(is_active=True), many=True).data
            synced_emails = [
                {
                    "id": f"integration-{email.pk}",
                    "to_email": ", ".join(email.to_emails or []),
                    "subject": email.subject,
                    "body": email.body_text or email.body_html or "",
                    "sent_by": None,
                    "sent_by_email": email.from_email,
                    "created_at": email.sent_at or email.received_at,
                    "updated_at": email.updated_at,
                }
                for email in SyncedEmailMessage.objects.filter(support_case=case).order_by("-received_at", "-created_at")
            ]
            return Response([*direct_emails, *synced_emails])
        serializer = SupportEmailLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_log = add_email_log("case", case, serializer.validated_data, request.user)
        provider = get_user_default_email_provider(request.user)
        recipient_email = (serializer.validated_data.get("to_email") or case.email or "").strip()
        if provider and recipient_email:
            create_outgoing_crm_email(
                provider_integration=provider,
                subject=serializer.validated_data["subject"],
                body=serializer.validated_data["body"],
                to_emails=[recipient_email],
                send_live=True,
                owner=request.user,
                account=case.account,
                contact=case.related_contact,
                deal=case.deal,
                support_case=case,
                thread_id=f"case-{case.pk}",
                metadata={
                    "from_name": provider.display_name or getattr(request.user, "email", "") or "CRM User",
                    "case_number": case.case_number,
                },
            )
        return Response(SupportEmailLogSerializer(email_log).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="import/upload")
    def import_upload(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = create_import_job(
            "case",
            serializer.validated_data["file"],
            request.user,
            operation=serializer.validated_data.get("operation"),
            duplicate_check_field=serializer.validated_data.get("duplicate_check_field"),
        )
        return Response(SupportImportJobSerializer(job).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="import/inspect")
    def import_inspect(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = get_import_job(serializer.validated_data["job_id"], "case")
        return Response(inspect_import_job(job))

    @action(detail=False, methods=["post"], url_path="import/execute")
    def import_execute(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = get_import_job(serializer.validated_data["job_id"], "case")
        try:
            updated_job = execute_import_job(
                "case",
                job,
                serializer.validated_data["field_mapping"],
                serializer.validated_data.get("default_values", {}),
                serializer.validated_data["operation"],
                serializer.validated_data.get("duplicate_check_field") or "subject",
                serializer.validated_data.get("automation_enabled", False),
                request.user,
            )
        except DjangoValidationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SupportImportJobSerializer(updated_job).data)

    @action(detail=False, methods=["get"], url_path=r"import/status/(?P<job_id>[^/.]+)")
    def import_status(self, request, job_id=None):
        job = get_import_job(job_id, "case")
        return Response(SupportImportJobSerializer(job).data)


class SupportSolutionViewSet(SupportBaseMixin, viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SupportSolutionFilter
    search_fields = [
        "solution_number",
        "solution_title",
        "status",
        "question",
        "answer",
        "product__product_name",
        "owner__email",
    ]
    ordering_fields = [
        "created_at",
        "updated_at",
        "last_activity_at",
        "solution_number",
        "solution_title",
        "status",
        "no_of_comments",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        return self._sort_queryset(list_solutions())

    def get_serializer_class(self):
        if self.action == "list":
            return SupportSolutionListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return SupportSolutionWriteSerializer
        if self.action in {"notes", "comments"}:
            return SupportNoteSerializer if self.action == "notes" else SupportCommentSerializer
        if self.action == "attachments":
            return SupportAttachmentSerializer
        if self.action == "timeline":
            return SupportTimelineSerializer
        if self.action in {"related_records", "links"}:
            return SupportLinkedRecordSerializer
        if self.action == "emails":
            return SupportEmailLogSerializer
        if self.action in {"import_upload"}:
            return SupportImportUploadSerializer
        if self.action in {"import_inspect"}:
            return SupportImportInspectSerializer
        if self.action in {"import_execute"}:
            return SupportImportExecuteSerializer
        if self.action in {"import_status"}:
            return SupportImportJobSerializer
        return SupportSolutionDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        solution = create_solution(serializer.validated_data, request.user)
        return Response(SupportSolutionDetailSerializer(solution).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        solution = self.get_object()
        return Response(SupportSolutionDetailSerializer(solution).data)

    def partial_update(self, request, *args, **kwargs):
        solution = self.get_object()
        serializer = self.get_serializer(solution, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_solution(solution, serializer.validated_data, request.user)
        return Response(SupportSolutionDetailSerializer(updated).data)

    def update(self, request, *args, **kwargs):
        solution = self.get_object()
        serializer = self.get_serializer(solution, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        updated = update_solution(solution, serializer.validated_data, request.user)
        return Response(SupportSolutionDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        delete_solution(self.get_object(), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="notes")
    def notes(self, request, pk=None):
        solution = self.get_object()
        if request.method == "GET":
            return Response(SupportNoteSerializer(solution.notes.filter(is_active=True), many=True).data)
        serializer = SupportNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = create_note("solution", solution, serializer.validated_data["note"], request.user)
        return Response(SupportNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        solution = self.get_object()
        if request.method == "GET":
            return Response(SupportCommentSerializer(solution.comments.filter(is_active=True), many=True).data)
        serializer = SupportCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = create_comment("solution", solution, serializer.validated_data["comment"], request.user)
        return Response(SupportCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, pk=None):
        solution = self.get_object()
        if request.method == "GET":
            return Response(SupportAttachmentSerializer(solution.attachments.filter(is_active=True), many=True).data)
        if "file" not in request.data:
            return Response({"file": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        attachment = add_attachment("solution", solution, request.data["file"], request.user)
        return Response(SupportAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        solution = self.get_object()
        return Response(SupportTimelineSerializer(list_timeline("solution", solution.pk), many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="related-records")
    def related_records(self, request, pk=None):
        solution = self.get_object()
        if request.method == "GET":
            return Response(SupportLinkedRecordSerializer(solution.linked_records.filter(is_active=True), many=True).data)
        serializer = SupportLinkedRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        linked = add_linked_record("solution", solution, serializer.validated_data, request.user)
        return Response(SupportLinkedRecordSerializer(linked).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="links")
    def links(self, request, pk=None):
        return self.related_records(request, pk)

    @action(detail=True, methods=["get", "post"], url_path="emails")
    def emails(self, request, pk=None):
        solution = self.get_object()
        if request.method == "GET":
            return Response(SupportEmailLogSerializer(solution.email_logs.filter(is_active=True), many=True).data)
        serializer = SupportEmailLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_log = add_email_log("solution", solution, serializer.validated_data, request.user)
        provider = get_user_default_email_provider(request.user)
        recipient_email = (serializer.validated_data.get("to_email") or "").strip()
        if provider and recipient_email:
            create_outgoing_crm_email(
                provider_integration=provider,
                subject=serializer.validated_data["subject"],
                body=serializer.validated_data["body"],
                to_emails=[recipient_email],
                send_live=True,
                owner=request.user,
                support_case=solution.case,
                thread_id=f"solution-{solution.pk}",
                metadata={
                    "from_name": provider.display_name or getattr(request.user, "email", "") or "CRM User",
                    "solution_number": solution.solution_number,
                },
            )
        return Response(SupportEmailLogSerializer(email_log).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="import/upload")
    def import_upload(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = create_import_job(
            "solution",
            serializer.validated_data["file"],
            request.user,
            operation=serializer.validated_data.get("operation"),
            duplicate_check_field=serializer.validated_data.get("duplicate_check_field"),
        )
        return Response(SupportImportJobSerializer(job).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="import/inspect")
    def import_inspect(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = get_import_job(serializer.validated_data["job_id"], "solution")
        return Response(inspect_import_job(job))

    @action(detail=False, methods=["post"], url_path="import/execute")
    def import_execute(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = get_import_job(serializer.validated_data["job_id"], "solution")
        try:
            updated_job = execute_import_job(
                "solution",
                job,
                serializer.validated_data["field_mapping"],
                serializer.validated_data.get("default_values", {}),
                serializer.validated_data["operation"],
                serializer.validated_data.get("duplicate_check_field") or "solution_title",
                serializer.validated_data.get("automation_enabled", False),
                request.user,
            )
        except DjangoValidationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SupportImportJobSerializer(updated_job).data)

    @action(detail=False, methods=["get"], url_path=r"import/status/(?P<job_id>[^/.]+)")
    def import_status(self, request, job_id=None):
        job = get_import_job(job_id, "solution")
        return Response(SupportImportJobSerializer(job).data)


class SupportLookupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, lookup_name: str):
        try:
            payload = build_lookup_payload(lookup_name, request.query_params.get("q", ""))
        except DjangoValidationError:
            return Response({"detail": "Lookup not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)


class SupportQuickCreateProductAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SupportQuickCreateProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = quick_create_product(serializer.validated_data, request.user)
        return Response(
            {
                "id": product.id,
                "name": product.product_name,
                "label": f"{product.product_name} ({product.product_code})" if product.product_code else product.product_name,
                "product_code": product.product_code,
                "unit_price": product.unit_price,
            },
            status=status.HTTP_201_CREATED,
        )
