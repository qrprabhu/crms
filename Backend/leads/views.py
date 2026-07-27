from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import EmailValidator
from django.db import models as django_models
from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from activities.models import Call, LeadActivity
from activities.serializers import LeadActivitySerializer
from integrations.services import (
    AUTO_SYNC_STALE_SECONDS,
    auto_sync_visible_email_providers,
    create_outgoing_crm_email,
    get_lead_connected_records,
    get_lead_emails,
    get_user_default_email_provider,
)
from integrations.models import IntegrationLeadSourceEvent
from notes.models import LeadNote
from notes.serializers import LeadNoteSerializer

from .filters import LeadFilter
from .models import Lead
from .pagination import LeadPagination
from .permissions import filter_queryset_for_user
from .serializers import (
    LeadActionSerializer,
    LeadAddTagsSerializer,
    LeadCallSerializer,
    LeadCloneResponseSerializer,
    LeadConnectedRecordSerializer,
    LeadConvertRequestSerializer,
    LeadConvertResponseSerializer,
    LeadDetailSerializer,
    LeadEmailSerializer,
    LeadListSerializer,
    LeadMeetingSerializer,
    LeadNoteCreateSerializer,
    LeadSendEmailSerializer,
)
from .services import (
    bulk_delete_leads,
    clone_lead,
    convert_lead,
    create_activity_log,
    create_note_for_lead,
    get_lead_timeline,
    list_lead_notes,
)


class LeadViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = LeadPagination
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = LeadFilter
    search_fields = ["first_name", "last_name", "company", "email", "phone"]
    ordering_fields = [
        "created_at",
        "company",
        "first_name",
        "annual_revenue",
        "employee_count",
    ]

    def get_queryset(self):
        user = self.request.user
        auto_sync_visible_email_providers(user, max_age_seconds=AUTO_SYNC_STALE_SECONDS)

        base_qs = (
            Lead.objects.select_related(
                "owner",
                "converted_account",
                "converted_contact",
                "converted_deal",
            ).prefetch_related(
                Prefetch(
                    "activities",
                    queryset=LeadActivity.objects.select_related("user"),
                ),
                Prefetch(
                    "notes",
                    queryset=LeadNote.objects.select_related("created_by"),
                ),
            )
        )

        qs = filter_queryset_for_user(base_qs.all(), user)
        owner_id = self.request.query_params.get("owner_id")
        if owner_id:
            qs = qs.filter(owner_id=owner_id)

        if self.action == "list":
            qs = qs.annotate(
                email_source_event_count=django_models.Count(
                    "integration_source_events",
                    filter=django_models.Q(
                        integration_source_events__source_type=IntegrationLeadSourceEvent.SourceType.EMAIL
                    ),
                    distinct=True,
                ),
                non_email_source_event_count=django_models.Count(
                    "integration_source_events",
                    filter=~django_models.Q(
                        integration_source_events__source_type=IntegrationLeadSourceEvent.SourceType.EMAIL
                    ),
                    distinct=True,
                ),
                note_count=django_models.Count("notes", distinct=True),
                activity_count=django_models.Count("activities", distinct=True),
            ).exclude(
                django_models.Q(lead_source="Integration")
                & django_models.Q(lead_status="New")
                & django_models.Q(email_source_event_count__gt=0)
                & django_models.Q(non_email_source_event_count=0)
                & django_models.Q(note_count=0)
                & django_models.Q(activity_count=0)
                & django_models.Q(converted_account__isnull=True)
                & django_models.Q(converted_contact__isnull=True)
                & django_models.Q(converted_deal__isnull=True)
                & django_models.Q(annual_revenue__isnull=True)
                & django_models.Q(employee_count__isnull=True)
                & (django_models.Q(title__isnull=True) | django_models.Q(title=""))
                & (django_models.Q(phone__isnull=True) | django_models.Q(phone=""))
                & (django_models.Q(mobile__isnull=True) | django_models.Q(mobile=""))
                & (django_models.Q(website__isnull=True) | django_models.Q(website=""))
                & (django_models.Q(industry__isnull=True) | django_models.Q(industry=""))
                & (django_models.Q(rating__isnull=True) | django_models.Q(rating=""))
                & (django_models.Q(street__isnull=True) | django_models.Q(street=""))
                & (django_models.Q(city__isnull=True) | django_models.Q(city=""))
                & (django_models.Q(state__isnull=True) | django_models.Q(state=""))
                & (django_models.Q(country__isnull=True) | django_models.Q(country=""))
                & (django_models.Q(zip_code__isnull=True) | django_models.Q(zip_code=""))
                & (django_models.Q(skype_id__isnull=True) | django_models.Q(skype_id=""))
                & (django_models.Q(secondary_email__isnull=True) | django_models.Q(secondary_email=""))
                & (django_models.Q(description__isnull=True) | django_models.Q(description=""))
                & django_models.Q(tags=[])
            )

        return qs.order_by("-created_at", "-id")

    def get_serializer_class(self):
        if self.action == "list":
            return LeadListSerializer
        if self.action == "timeline":
            return LeadActivitySerializer
        if self.action == "notes" and self.request.method == "POST":
            return LeadNoteCreateSerializer
        if self.action == "notes":
            return LeadNoteSerializer
        if self.action == "create_task":
            return LeadActionSerializer
        if self.action == "log_call":
            return LeadCallSerializer
        if self.action == "schedule_meeting":
            return LeadMeetingSerializer
        if self.action == "send_email":
            return LeadSendEmailSerializer
        if self.action == "convert":
            return LeadConvertRequestSerializer
        return LeadDetailSerializer

    def perform_create(self, serializer):
        user = self.request.user
        save_kwargs = {}
        if not serializer.validated_data.get("owner"):
            save_kwargs["owner"] = user
        lead = serializer.save(**save_kwargs)
        create_activity_log(
            lead=lead,
            action="Lead Created",
            description="Lead record created.",
            user=user,
        )

    def perform_update(self, serializer):
        lead = serializer.save(owner=serializer.validated_data.get("owner") or serializer.instance.owner or self.request.user)
        create_activity_log(
            lead=lead,
            action="Lead Updated",
            description="Lead record updated.",
            user=self.request.user,
        )

    @action(detail=False, methods=["post"], url_path="import")
    def import_records(self, request):
        payload = request.data.get("records", request.data)
        if not isinstance(payload, list):
            return Response(
                {"detail": "Expected a list of records."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(payload) == 0:
            return Response({"detail": "No records provided."}, status=status.HTTP_400_BAD_REQUEST)

        if len(payload) > 5000:
            return Response(
                {"detail": "CSV exceeds the limit of 5000 records."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_fields = {
            "first_name",
            "last_name",
            "company",
            "title",
            "email",
            "phone",
            "mobile",
            "website",
            "lead_source",
            "lead_status",
            "industry",
            "annual_revenue",
            "employee_count",
            "rating",
            "street",
            "city",
            "state",
            "country",
            "zip_code",
            "skype_id",
            "secondary_email",
            "description",
            "owner",
        }
        required_fields = {"first_name", "last_name", "company", "email"}

        invalid_columns = sorted(
            {key for row in payload if isinstance(row, dict) for key in row.keys()} - allowed_fields
        )
        if invalid_columns:
            return Response(
                {"detail": "Invalid columns.", "invalid_columns": invalid_columns},
                status=status.HTTP_400_BAD_REQUEST,
            )

        errors = []
        normalized_records = []
        seen_emails = set()
        validate_email = EmailValidator()

        for index, row in enumerate(payload, start=1):
            if not isinstance(row, dict):
                errors.append({"row": index, "errors": {"row": ["Row data is invalid."]}})
                continue

            normalized = {}
            for key, value in row.items():
                if value is None:
                    continue
                if isinstance(value, str):
                    value = value.strip()
                    if value == "":
                        continue
                if key in {"annual_revenue"} and isinstance(value, str):
                    cleaned = value.replace(",", "")
                    try:
                        value = float(cleaned)
                    except ValueError:
                        pass
                if key in {"employee_count"} and isinstance(value, str):
                    cleaned = value.replace(",", "")
                    try:
                        value = int(cleaned)
                    except ValueError:
                        pass
                if key in {"email", "secondary_email"} and isinstance(value, str):
                    value = value.lower()
                normalized[key] = value

            if not normalized:
                errors.append({"row": index, "errors": {"row": ["Row is empty."]}})
                continue

            missing = [field for field in required_fields if not normalized.get(field)]
            if missing:
                errors.append({"row": index, "errors": {"missing_fields": missing}})
                continue

            email = normalized.get("email")
            if email:
                try:
                    validate_email(email)
                except DjangoValidationError:
                    errors.append({"row": index, "errors": {"email": ["Invalid email format."]}})
                    continue
                if email in seen_emails:
                    errors.append({"row": index, "errors": {"email": ["Duplicate email in file."]}})
                    continue
                seen_emails.add(email)

            if not normalized.get("owner"):
                normalized["owner"] = request.user.id

            serializer = LeadDetailSerializer(data=normalized)
            if not serializer.is_valid():
                errors.append({"row": index, "errors": serializer.errors})
                continue
            normalized_records.append(serializer.validated_data)

        existing_emails = set()
        if seen_emails:
            existing_emails = set(
                Lead.objects.filter(email__in=seen_emails).values_list("email", flat=True)
            )

        valid_records = []
        skipped_count = 0
        for index, data in enumerate(normalized_records, start=1):
            email = data.get("email")
            if email and email in existing_emails:
                errors.append({"row": index, "errors": {"email": ["Email already exists."]}})
                skipped_count += 1
                continue
            valid_records.append(data)

        created_count = 0
        if valid_records:
            with transaction.atomic():
                leads = [Lead(**record) for record in valid_records]
                Lead.objects.bulk_create(leads, batch_size=500)
                created_count = len(leads)

        return Response(
            {
                "message": "Leads import completed.",
                "total": len(payload),
                "imported_count": created_count,
                "skipped_count": skipped_count,
                "error_count": len(errors),
                "errors": errors,
            },
            status=status.HTTP_201_CREATED,
        )

    @swagger_auto_schema(
        operation_description="Deletes a list of leads by their IDs.",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=["ids"],
            properties={
                "ids": openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(type=openapi.TYPE_INTEGER),
                    description="List of lead IDs to delete.",
                ),
            },
        ),
        responses={
            200: openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    "message": openapi.Schema(type=openapi.TYPE_STRING),
                    "deleted_count": openapi.Schema(type=openapi.TYPE_INTEGER),
                },
            ),
            400: "Bad Request",
        },
    )
    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request):
        ids = request.data.get("ids", [])
        if not ids or not isinstance(ids, list):
            return Response(
                {"error": "Please provide a valid list of 'ids'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted_count = bulk_delete_leads(ids)
        return Response(
            {
                "message": f"Successfully deleted {deleted_count} leads.",
                "deleted_count": deleted_count,
            },
            status=status.HTTP_200_OK,
        )

    @swagger_auto_schema(
        method="post",
        operation_description="Clone an existing lead into a new lead record.",
        responses={201: LeadCloneResponseSerializer},
    )
    @action(detail=True, methods=["post"], url_path="clone")
    def clone(self, request, pk=None):
        lead = self.get_object()
        cloned_lead = clone_lead(lead=lead, user=request.user)
        return Response(
            {
                "message": "Lead cloned successfully",
                "lead_id": cloned_lead.pk,
            },
            status=status.HTTP_201_CREATED,
        )

    @swagger_auto_schema(
        method="get",
        operation_description="Fetch the full activity timeline for a lead.",
        responses={
            200: LeadActivitySerializer(many=True),
            404: "Lead not found",
        },
    )
    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadActivitySerializer(get_lead_timeline(lead=lead), many=True)
        return Response(serializer.data)

    @swagger_auto_schema(
        method="get",
        operation_description="Fetch all notes for a lead.",
        responses={
            200: LeadNoteSerializer(many=True),
            404: "Lead not found",
        },
    )
    @swagger_auto_schema(
        method="post",
        operation_description="Create a note for a lead.",
        request_body=LeadNoteCreateSerializer,
        responses={
            201: LeadNoteSerializer,
            400: "Validation error",
            404: "Lead not found",
        },
    )
    @action(detail=True, methods=["get", "post"], url_path="notes")
    def notes(self, request, pk=None):
        lead = self.get_object()
        if request.method == "GET":
            serializer = LeadNoteSerializer(list_lead_notes(lead=lead), many=True)
            return Response(serializer.data)

        serializer = LeadNoteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = create_note_for_lead(
            lead=lead,
            note=serializer.validated_data["note"],
            user=request.user,
        )
        return Response(LeadNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @swagger_auto_schema(
        method="post",
        operation_description="Convert a lead into an account, a contact, and optionally a deal.",
        request_body=LeadConvertRequestSerializer,
        responses={200: LeadConvertResponseSerializer},
    )
    @action(detail=True, methods=["post"], url_path="convert")
    def convert(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadConvertRequestSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)

        try:
            result = convert_lead(
                lead=lead,
                user=request.user,
                create_deal=serializer.validated_data.get("create_deal", False),
                deal_name=serializer.validated_data.get("deal_name"),
                deal_value=serializer.validated_data.get("deal_value"),
            )
        except DjangoValidationError as exc:
            return Response(
                {"detail": exc.messages[0]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Lead converted successfully",
                "account_id": result["account"].pk,
                "contact_id": result["contact"].pk,
                "deal_id": result["deal"].pk if result["deal"] else None,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="create-task")
    def create_task(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        create_activity_log(
            lead=lead,
            action="Task created",
            description=serializer.validated_data["subject"],
            user=request.user,
        )
        return Response({"message": "Task created successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="log-call")
    def log_call(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadCallSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        call_summary = serializer.validated_data["call_summary"]
        outcome = serializer.validated_data.get("call_outcome", "").strip()
        description = f"{call_summary} | {outcome}" if outcome else call_summary

        create_activity_log(
            lead=lead,
            action="Call logged",
            description=description,
            user=request.user,
        )

        call_type_value = serializer.validated_data.get("call_type", "Outbound")
        call_start_time = serializer.validated_data.get("call_start_time") or timezone.now()
        reminder_value = serializer.validated_data.get("reminder", "None")

        Call.objects.create(
            subject=call_summary,
            call_type=call_type_value,
            call_status=Call.CallStatus.COMPLETED,
            call_start_time=call_start_time,
            duration_minutes=serializer.validated_data.get("duration_minutes", 0),
            duration_seconds=serializer.validated_data.get("duration_seconds", 0),
            reminder=reminder_value,
            voice_recording=serializer.validated_data.get("voice_recording", ""),
            lead=lead,
            owner=request.user,
            purpose=outcome,
        )

        return Response({"message": "Call logged successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="schedule-meeting")
    def schedule_meeting(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadMeetingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        description = serializer.validated_data["meeting_subject"]
        agenda = serializer.validated_data.get("agenda", "").strip()
        if agenda:
            description = f"{description} | {agenda}"

        create_activity_log(
            lead=lead,
            action="Meeting scheduled",
            description=description,
            user=request.user,
        )
        return Response({"message": "Meeting scheduled successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-tags")
    def add_tags(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadAddTagsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_tags = serializer.validated_data["tags"]
        existing = lead.tags if isinstance(lead.tags, list) else []
        merged = list(dict.fromkeys(existing + new_tags))
        lead.tags = merged
        lead.save(update_fields=["tags"])
        return Response({"tags": lead.tags}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadSendEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        provider = get_user_default_email_provider(request.user)
        if not provider:
            return Response(
                {"detail": "No active CRM-synced email provider is configured for this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        recipient_email = (serializer.validated_data.get("to_email") or lead.email or "").strip()
        if not recipient_email:
            return Response(
                {"detail": "Lead does not have an email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        create_outgoing_crm_email(
            provider_integration=provider,
            subject=serializer.validated_data["subject"],
            body=serializer.validated_data["body"],
            to_emails=[recipient_email],
            send_live=True,
            owner=request.user,
            lead=lead,
            contact=lead.converted_contact,
            account=lead.converted_account,
            deal=lead.converted_deal,
            thread_id=f"lead-{lead.pk}",
            metadata={
                "from_name": provider.display_name or getattr(request.user, "email", "") or "CRM User",
                "company": lead.company,
            },
        )
        create_activity_log(
            lead=lead,
            action="Email sent",
            description=serializer.validated_data["subject"],
            user=request.user,
        )
        return Response({"message": "Email sent and synced successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="emails")
    def emails(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadEmailSerializer(get_lead_emails(lead.pk), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="connected-records")
    def connected_records(self, request, pk=None):
        lead = self.get_object()
        serializer = LeadConnectedRecordSerializer(get_lead_connected_records(lead.pk), many=True)
        return Response(serializer.data)
