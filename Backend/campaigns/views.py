from django.core.exceptions import ObjectDoesNotExist
from django.db import connection
from django.db import IntegrityError
from django.http import Http404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import CampaignFilter
from .models import Campaign, CampaignAttachment, CampaignSubmission
from .permissions import CampaignPermission, can_access_campaign_owner
from .serializers import (
    BulkConvertSerializer,
    CampaignActivityActionSerializer,
    CampaignAttachmentCreateSerializer,
    CampaignAttachmentSerializer,
    CampaignContactSerializer,
    CampaignCreateChildSerializer,
    CampaignDealSerializer,
    CampaignDetailSerializer,
    CampaignLeadSerializer,
    CampaignListSerializer,
    CampaignLogCallSerializer,
    CampaignNoteCreateSerializer,
    CampaignNoteSerializer,
    CampaignPublicSubmitSerializer,
    CampaignScheduleMeetingSerializer,
    CampaignStatsSerializer,
    CampaignSubmissionSerializer,
    CampaignTimelineSerializer,
    CampaignWriteSerializer,
)
from .services import campaign_service


def _get_campaign_submission_columns() -> set[str]:
    table_name = CampaignSubmission._meta.db_table
    with connection.cursor() as cursor:
        return {
            column.name
            for column in connection.introspection.get_table_description(cursor, table_name)
        }


def _get_campaign_submission_row(submission_id: int, campaign_id: int | None = None) -> dict | None:
    existing_columns = _get_campaign_submission_columns()
    fields = [
        "id",
        "campaign_id",
        "first_name",
        "last_name",
        "email",
        "phone",
        "company",
        "notes",
        "source",
        "is_converted",
        "converted_lead_id",
        "submitted_at",
    ]
    if "website" in existing_columns:
        fields.insert(7, "website")

    queryset = CampaignSubmission.objects.values(*fields).filter(id=submission_id)
    if campaign_id is not None:
        queryset = queryset.filter(campaign_id=campaign_id)
    return queryset.first()


def _create_public_submission_record(*, campaign: Campaign, data: dict) -> int:
    table_name = CampaignSubmission._meta.db_table
    existing_columns = _get_campaign_submission_columns()

    with connection.cursor() as cursor:
        row: dict[str, object | None] = {
            "campaign_id": campaign.id,
            "first_name": data["first_name"],
            "last_name": data["last_name"],
            "email": data["email"],
            "phone": data.get("phone") or None,
            "company": data.get("company") or None,
            "notes": data.get("notes") or None,
            "source": "Campaign Form",
            "is_converted": False,
            "converted_lead_id": None,
            "submitted_at": timezone.now(),
        }
        if "website" in existing_columns:
            row["website"] = data.get("website") or None

        columns = [column for column in row.keys() if column in existing_columns]
        placeholders = ", ".join(["%s"] * len(columns))
        quoted_columns = ", ".join(connection.ops.quote_name(column) for column in columns)

        cursor.execute(
            f"""
            INSERT INTO {connection.ops.quote_name(table_name)} ({quoted_columns})
            VALUES ({placeholders})
            RETURNING id
            """,
            [row[column] for column in columns],
        )
        return cursor.fetchone()[0]


class CampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CampaignPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = CampaignFilter
    search_fields = ["campaign_name", "type", "status", "campaign_owner__email"]
    ordering_fields = ["created_at", "updated_at", "campaign_name", "start_date", "end_date"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = campaign_service.list_campaigns(user=self.request.user)
        sort = self.request.query_params.get("sort")
        if sort:
            allowed = set(self.ordering_fields)
            normalized = sort[1:] if sort.startswith("-") else sort
            if normalized in allowed:
                queryset = queryset.order_by(sort)
        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return CampaignListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return CampaignWriteSerializer
        if self.action == "stats":
            return CampaignStatsSerializer
        if self.action in {"leads"}:
            return CampaignLeadSerializer
        if self.action in {"contacts"}:
            return CampaignContactSerializer
        if self.action in {"deals"}:
            return CampaignDealSerializer
        if self.action in {"activities", "timeline"}:
            return CampaignTimelineSerializer
        if self.action == "notes" and self.request.method == "POST":
            return CampaignNoteCreateSerializer
        if self.action == "notes":
            return CampaignNoteSerializer
        if self.action == "create_child":
            return CampaignCreateChildSerializer
        if self.action == "attachments" and self.request.method == "POST":
            return CampaignAttachmentCreateSerializer
        if self.action == "attachments":
            return CampaignAttachmentSerializer
        if self.action == "create_task":
            return CampaignActivityActionSerializer
        if self.action == "schedule_meeting":
            return CampaignScheduleMeetingSerializer
        if self.action == "log_call":
            return CampaignLogCallSerializer
        return CampaignDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = campaign_service.create_campaign(data=serializer.validated_data, user=request.user)
        return Response(CampaignDetailSerializer(campaign).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        try:
            campaign = campaign_service.get_campaign_detail(campaign_id=kwargs["pk"], user=request.user)
        except ObjectDoesNotExist as exc:
            raise Http404 from exc
        self.check_object_permissions(request, campaign)
        return Response(CampaignDetailSerializer(campaign).data)

    def partial_update(self, request, *args, **kwargs):
        campaign = self.get_object()
        serializer = self.get_serializer(campaign, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = campaign_service.update_campaign(campaign=campaign, data=serializer.validated_data, user=request.user)
        return Response(CampaignDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        campaign = self.get_object()
        campaign_service.delete_campaign(campaign=campaign, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="stats")
    def stats(self, request, pk=None):
        campaign = self.get_object()
        return Response(CampaignStatsSerializer(campaign_service.get_campaign_stats(campaign=campaign)).data)

    @action(detail=True, methods=["get"], url_path="leads")
    def leads(self, request, pk=None):
        campaign = self.get_object()
        rows = [link.lead for link in campaign_service.list_related_leads(campaign=campaign)]
        return Response(CampaignLeadSerializer(rows, many=True).data)

    @action(detail=True, methods=["get"], url_path="contacts")
    def contacts(self, request, pk=None):
        campaign = self.get_object()
        rows = [link.contact for link in campaign_service.list_related_contacts(campaign=campaign)]
        return Response(CampaignContactSerializer(rows, many=True).data)

    @action(detail=True, methods=["get"], url_path="deals")
    def deals(self, request, pk=None):
        campaign = self.get_object()
        rows = [link.deal for link in campaign_service.list_related_deals(campaign=campaign)]
        return Response(CampaignDealSerializer(rows, many=True).data)

    @action(detail=True, methods=["get"], url_path="activities")
    def activities(self, request, pk=None):
        campaign = self.get_object()
        rows = [link.activity for link in campaign_service.list_related_activities(campaign=campaign)]
        return Response(CampaignTimelineSerializer(rows, many=True).data)

    @action(detail=True, methods=["post"], url_path="create-child")
    def create_child(self, request, pk=None):
        campaign = self.get_object()
        serializer = CampaignCreateChildSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        child = campaign_service.create_child_campaign(parent=campaign, data=serializer.validated_data, user=request.user)
        return Response(CampaignDetailSerializer(child).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="notes")
    def notes(self, request, pk=None):
        campaign = self.get_object()
        if request.method == "GET":
            return Response(CampaignNoteSerializer(campaign_service.notes_service.list_notes(campaign=campaign), many=True).data)

        serializer = CampaignNoteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = campaign_service.notes_service.create_note(
            campaign=campaign,
            note=serializer.validated_data["note"],
            user=request.user,
        )
        campaign_service.log_activity(
            campaign=campaign,
            action="Campaign updated",
            description="Note added",
            user=request.user,
        )
        return Response(CampaignNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        campaign = self.get_object()
        return Response(CampaignTimelineSerializer(campaign_service.timeline_service.list_events(campaign=campaign), many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, pk=None):
        campaign = self.get_object()
        if request.method == "GET":
            return Response(CampaignAttachmentSerializer(campaign_service.list_attachments(campaign=campaign), many=True).data)

        serializer = CampaignAttachmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attachment = campaign_service.add_attachment(
            campaign=campaign,
            file=serializer.validated_data["file"],
            user=request.user,
        )
        return Response(CampaignAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="create-task")
    def create_task(self, request, pk=None):
        campaign = self.get_object()
        serializer = CampaignActivityActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign_service.log_activity(
            campaign=campaign,
            action="Task created",
            description=serializer.validated_data["subject"],
            user=request.user,
            is_closed=False,
        )
        return Response({"message": "Task created successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="schedule-meeting")
    def schedule_meeting(self, request, pk=None):
        campaign = self.get_object()
        serializer = CampaignScheduleMeetingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        description = serializer.validated_data["meeting_subject"]
        agenda = serializer.validated_data.get("agenda", "").strip()
        if agenda:
            description = f"{description} | {agenda}"
        campaign_service.log_activity(
            campaign=campaign,
            action="Meeting scheduled",
            description=description,
            user=request.user,
            is_closed=False,
        )
        return Response({"message": "Meeting scheduled successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="log-call")
    def log_call(self, request, pk=None):
        campaign = self.get_object()
        serializer = CampaignLogCallSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        description = serializer.validated_data["call_summary"]
        outcome = serializer.validated_data.get("call_outcome", "").strip()
        if outcome:
            description = f"{description} | {outcome}"
        campaign_service.log_activity(
            campaign=campaign,
            action="Call logged",
            description=description,
            user=request.user,
            is_closed=False,
        )
        return Response({"message": "Call logged successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="submissions")
    def submissions(self, request, pk=None):
        campaign = self.get_object()
        existing_columns = _get_campaign_submission_columns()
        fields = [
            "id",
            "campaign_id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "company",
            "notes",
            "source",
            "is_converted",
            "converted_lead_id",
            "submitted_at",
        ]
        if "website" in existing_columns:
            fields.insert(7, "website")

        qs = CampaignSubmission.objects.filter(campaign=campaign).values(*fields)
        # Optional filter: ?converted=true|false
        converted_param = request.query_params.get("converted")
        if converted_param == "true":
            qs = qs.filter(is_converted=True)
        elif converted_param == "false":
            qs = qs.filter(is_converted=False)

        payload = []
        for row in qs:
            payload.append(
                {
                    "id": row["id"],
                    "campaign": row["campaign_id"],
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "email": row["email"],
                    "phone": row.get("phone"),
                    "company": row.get("company"),
                    "website": row.get("website"),
                    "notes": row.get("notes"),
                    "source": row.get("source"),
                    "is_converted": row["is_converted"],
                    "converted_lead": row.get("converted_lead_id"),
                    "submitted_at": row["submitted_at"],
                }
            )
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="convert-submissions")
    def convert_submissions(self, request, pk=None):
        campaign = self.get_object()
        serializer = BulkConvertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["submission_ids"]
        results = []
        for sub_id in ids:
            submission_row = _get_campaign_submission_row(sub_id, campaign.id)
            if not submission_row:
                results.append({"id": sub_id, "success": False, "error": "Submission not found."})
                continue
            if submission_row["is_converted"]:
                results.append({"id": sub_id, "success": False, "error": "Already converted."})
                continue
            try:
                lead = _convert_submission_row(submission_row, request.user)
                results.append({"id": sub_id, "success": True, "lead_id": lead.id})
            except (ValidationError, IntegrityError) as exc:
                msg = exc.detail[0] if hasattr(exc, "detail") else str(exc)
                results.append({"id": sub_id, "success": False, "error": str(msg)})
        return Response({"results": results})


class CampaignAttachmentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, attachment_id: int):
        try:
            attachment = CampaignAttachment.objects.select_related("campaign").get(
                pk=attachment_id,
                is_active=True,
            )
        except CampaignAttachment.DoesNotExist:
            return Response({"detail": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

        campaign = attachment.campaign
        if not can_access_campaign_owner(user=request.user, owner_id=campaign.campaign_owner_id):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)

        campaign_service.delete_attachment(attachment=attachment, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Submission helper ──────────────────────────────────────────────────────

def _convert_submission(submission: CampaignSubmission, user):
    """Create a Lead from a CampaignSubmission and mark it converted."""
    from leads.models import Lead
    from .models import CampaignLead

    if submission.is_converted:
        raise ValidationError("This submission has already been converted to a lead.")

    try:
        lead = Lead.objects.create(
            first_name=submission.first_name,
            last_name=submission.last_name,
            email=submission.email,
            phone=submission.phone or "",
            company=submission.company or "Unknown",
            lead_source="Campaign",
            lead_status="New",
            owner=user,
            campaign=submission.campaign,
            description=submission.notes or "",
        )
    except IntegrityError:
        raise ValidationError(
            f"A lead with email '{submission.email}' already exists."
        )

    submission.is_converted = True
    submission.converted_lead = lead
    submission.save(update_fields=["is_converted", "converted_lead"])

    # Also link via CampaignLead join table
    CampaignLead.objects.get_or_create(campaign=submission.campaign, lead=lead)

    return lead


def _convert_submission_row(submission_row: dict, user):
    """Create a Lead from a schema-safe CampaignSubmission row and mark it converted."""
    from leads.models import Lead
    from .models import CampaignLead

    if submission_row["is_converted"]:
        raise ValidationError("This submission has already been converted to a lead.")

    try:
        lead = Lead.objects.create(
            first_name=submission_row["first_name"],
            last_name=submission_row["last_name"],
            email=submission_row["email"],
            phone=submission_row.get("phone") or "",
            company=submission_row.get("company") or "Unknown",
            lead_source="Campaign",
            lead_status="New",
            owner=user,
            campaign_id=submission_row["campaign_id"],
            description=submission_row.get("notes") or "",
        )
    except IntegrityError:
        raise ValidationError(
            f"A lead with email '{submission_row['email']}' already exists."
        )

    CampaignSubmission.objects.filter(pk=submission_row["id"]).update(
        is_converted=True,
        converted_lead=lead,
    )

    CampaignLead.objects.get_or_create(campaign_id=submission_row["campaign_id"], lead=lead)

    return lead


# ── Single-submission convert view ────────────────────────────────────────

class CampaignSubmissionConvertAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, submission_id: int):
        submission_row = _get_campaign_submission_row(submission_id)
        if not submission_row:
            return Response({"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            lead = _convert_submission_row(submission_row, request.user)
        except ValidationError as exc:
            msg = exc.detail[0] if hasattr(exc, "detail") else str(exc)
            return Response({"detail": str(msg)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"message": "Lead created successfully.", "lead_id": lead.id},
            status=status.HTTP_201_CREATED,
        )


# ── Public form submission view (no auth required) ────────────────────────

class CampaignPublicSubmitAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # Skip JWT auth entirely

    def post(self, request, campaign_id: int):
        try:
            campaign = Campaign.objects.get(pk=campaign_id, is_active=True)
        except Campaign.DoesNotExist:
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CampaignPublicSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        submission_id = _create_public_submission_record(campaign=campaign, data=data)

        return Response(
            {"message": "Thank you! Your response has been recorded.", "id": submission_id},
            status=status.HTTP_201_CREATED,
        )

