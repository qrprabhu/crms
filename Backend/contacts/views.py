from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import Http404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from deals.models import Deal
from deals.serializers import DealListSerializer
from accounts.models import Account
from integrations.services import create_outgoing_crm_email, get_user_default_email_provider

from .filters import ContactFilter
from .permissions import ContactPermission
from .serializers import (
    ContactActionSerializer,
    ContactDetailSerializer,
    ContactListSerializer,
    ContactLogCallSerializer,
    ContactMeetingSerializer,
    ContactNoteCreateSerializer,
    ContactNoteSerializer,
    ContactSendEmailSerializer,
    ContactTimelineSerializer,
    ContactWriteSerializer,
)
from .services import contact_service

User = get_user_model()

LEAD_SOURCE_ALIASES = {
    "employee referral": "External Referral",
    "referral": "External Referral",
    "external referral": "External Referral",
    "web": "Web Download",
    "website": "Web Download",
    "web download": "Web Download",
    "ad": "Advertisement",
}


class ContactViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, ContactPermission]

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_class = ContactFilter

    search_fields = [
        "first_name",
        "last_name",
        "email",
        "phone",
        "mobile",
        "account__account_name",
    ]

    ordering_fields = [
        "created_at",
        "updated_at",
        "first_name",
        "last_name",
        "email",
    ]

    ordering = ["-created_at"]

    # Queryset

    def get_queryset(self):
        queryset = contact_service.list_contacts(user=self.request.user)

        sort = self.request.query_params.get("sort")

        if sort:
            allowed = set(self.ordering_fields)
            normalized = sort[1:] if sort.startswith("-") else sort

            if normalized in allowed:
                queryset = queryset.order_by(sort)

        return queryset

    # Serializer selection

    def get_serializer_class(self):

        if self.action == "list":
            return ContactListSerializer

        if self.action in {"create", "update", "partial_update"}:
            return ContactWriteSerializer

        if self.action == "timeline":
            return ContactTimelineSerializer

        if self.action == "notes" and self.request.method == "POST":
            return ContactNoteCreateSerializer

        if self.action == "notes":
            return ContactNoteSerializer

        if self.action == "create_task":
            return ContactActionSerializer

        if self.action == "log_call":
            return ContactLogCallSerializer

        if self.action == "schedule_meeting":
            return ContactMeetingSerializer

        if self.action == "send_email":
            return ContactSendEmailSerializer

        return ContactDetailSerializer

    # Create Contact

    def create(self, request, *args, **kwargs):

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        # Ensure owner is set
        if not data.get("contact_owner"):
            data["contact_owner"] = request.user

        contact = contact_service.create_contact(
            data=data,
            user=request.user,
        )

        response_serializer = ContactDetailSerializer(
            contact,
            context=self.get_serializer_context(),
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    # Retrieve Contact

    def retrieve(self, request, *args, **kwargs):

        try:
            contact = contact_service.get_contact_detail(
                contact_id=kwargs["pk"],
                user=request.user,
            )

        except ObjectDoesNotExist:
            raise Http404

        self.check_object_permissions(request, contact)

        serializer = self.get_serializer(contact)

        return Response(serializer.data)

    # Update Contact

    def partial_update(self, request, *args, **kwargs):

        contact = self.get_object()

        serializer = self.get_serializer(
            contact,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)

        updated = contact_service.update_contact(
            contact=contact,
            data=serializer.validated_data,
            user=request.user,
        )

        response_serializer = ContactDetailSerializer(
            updated,
            context=self.get_serializer_context(),
        )

        return Response(response_serializer.data)

    # Delete Contact

    def destroy(self, request, *args, **kwargs):

        contact = self.get_object()

        contact_service.delete_contact(
            contact=contact,
            user=request.user,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

    def _resolve_user_value(self, raw_value):
        if raw_value in (None, ""):
            return None

        if isinstance(raw_value, int):
            return User.objects.filter(pk=raw_value).first()

        value = str(raw_value).strip()
        if not value:
            return None

        if value.isdigit():
            return User.objects.filter(pk=int(value)).first()

        lowered = value.lower()
        return (
            User.objects.filter(email__iexact=lowered).first()
            or User.objects.filter(email__istartswith=lowered).first()
        )

    def _resolve_account_value(self, raw_value, request_user):
        if raw_value in (None, ""):
            return None

        if isinstance(raw_value, int):
            return Account.objects.filter(pk=raw_value).first()

        value = str(raw_value).strip()
        if not value:
            return None

        if value.isdigit():
            return Account.objects.filter(pk=int(value)).first()

        account = Account.objects.filter(account_name__iexact=value).first()
        if account:
            return account

        return Account.objects.create(
            account_name=value,
            account_owner=request_user,
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
            return Response(
                {"detail": "No records provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(payload) > 5000:
            return Response(
                {"detail": "CSV exceeds the limit of 5000 records."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_fields = set(ContactWriteSerializer.Meta.fields)
        allowed_fields.update({"account_name", "owner"})
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
                if key == "email" and isinstance(value, str):
                    value = value.lower()
                normalized[key] = value

            if not normalized:
                errors.append({"row": index, "errors": {"row": ["Row is empty."]}})
                continue

            if not normalized.get("first_name") or not normalized.get("last_name"):
                errors.append({
                    "row": index,
                    "errors": {"missing_fields": ["first_name", "last_name"]},
                })
                continue

            owner_value = normalized.get("contact_owner", normalized.get("owner"))
            if owner_value not in (None, ""):
                owner = self._resolve_user_value(owner_value)
                normalized["contact_owner"] = (owner or request.user).pk
                normalized.pop("owner", None)

            account_value = normalized.get("account", normalized.get("account_name"))
            if account_value not in (None, ""):
                account = self._resolve_account_value(account_value, request.user)
                if not account:
                    errors.append({"row": index, "errors": {"account": [f"Account '{account_value}' was not found."]}})
                    continue
                normalized["account"] = account.pk
                normalized.pop("account_name", None)

            if not normalized.get("account"):
                errors.append({"row": index, "errors": {"account": ["Account is required."]}})
                continue

            lead_source = normalized.get("lead_source")
            if isinstance(lead_source, str):
                canonical = LEAD_SOURCE_ALIASES.get(lead_source.strip().lower(), lead_source.strip())
                normalized["lead_source"] = canonical

            email = normalized.get("email")
            if email:
                if email in seen_emails:
                    errors.append({"row": index, "errors": {"email": ["Duplicate email in file."]}})
                    continue
                seen_emails.add(email)

            if not normalized.get("owner"):
                normalized["owner"] = request.user.pk

            serializer = ContactWriteSerializer(
                data=normalized,
                context={"request": request},
            )
            if not serializer.is_valid():
                errors.append({"row": index, "errors": serializer.errors})
                continue

            normalized_records.append(serializer.validated_data)

        existing_emails = set()
        if seen_emails:
            existing_emails = set(
                contact_service.list_contacts(user=request.user)
                .filter(email__in=seen_emails)
                .values_list("email", flat=True)
            )

        valid_records = []
        skipped_count = 0
        for row_index, data in enumerate(normalized_records, start=1):
            email = data.get("email")
            if email and email in existing_emails:
                errors.append({"row": row_index, "errors": {"email": ["Email already exists."]}})
                skipped_count += 1
                continue
            valid_records.append(data)

        created_count = 0
        if valid_records:
            with transaction.atomic():
                for data in valid_records:
                    contact_service.create_contact(data=data, user=request.user)
                    created_count += 1

        return Response(
            {
                "message": "Contacts import completed.",
                "total": len(payload),
                "imported_count": created_count,
                "skipped_count": skipped_count,
                "error_count": len(errors),
                "errors": errors,
            },
            status=status.HTTP_201_CREATED,
        )

    # Timeline

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):

        contact = self.get_object()

        serializer = ContactTimelineSerializer(
            contact_service.timeline_service.list_events(contact=contact),
            many=True,
        )

        return Response(serializer.data)

    # Notes

    @action(detail=True, methods=["get", "post"], url_path="notes")
    def notes(self, request, pk=None):

        contact = self.get_object()

        if request.method == "GET":

            serializer = ContactNoteSerializer(
                contact_service.notes_service.list_notes(contact=contact),
                many=True,
            )

            return Response(serializer.data)

        serializer = ContactNoteCreateSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        note = contact_service.notes_service.create_note(
            contact=contact,
            note=serializer.validated_data["note"],
            user=request.user,
        )

        contact_service.log_activity(
            contact=contact,
            action="Notes added",
            description="Note added to contact",
            user=request.user,
        )

        return Response(
            ContactNoteSerializer(note).data,
            status=status.HTTP_201_CREATED,
        )

    # Create Task

    @action(detail=True, methods=["post"], url_path="create-task")
    def create_task(self, request, pk=None):

        contact = self.get_object()

        serializer = ContactActionSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        subject = serializer.validated_data["subject"]

        contact_service.log_activity(
            contact=contact,
            action="Task created",
            description=subject,
            user=request.user,
        )

        return Response(
            {"message": "Task created successfully"},
            status=status.HTTP_201_CREATED,
        )

    
    # Log Call

    @action(detail=True, methods=["post"], url_path="log-call")
    def log_call(self, request, pk=None):

        contact = self.get_object()

        serializer = ContactLogCallSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        call_summary = serializer.validated_data["call_summary"]

        call_outcome = serializer.validated_data.get(
            "call_outcome",
            "",
        ).strip()

        description = (
            call_summary if not call_outcome else f"{call_summary} | {call_outcome}"
        )

        contact_service.log_activity(
            contact=contact,
            action="Call logged",
            description=description,
            user=request.user,
        )

        return Response(
            {"message": "Call logged successfully"},
            status=status.HTTP_201_CREATED,
        )

    # Send Email

    @action(detail=True, methods=["post"], url_path="schedule-meeting")
    def schedule_meeting(self, request, pk=None):

        contact = self.get_object()

        serializer = ContactMeetingSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        description = serializer.validated_data["meeting_subject"]
        agenda = serializer.validated_data.get("agenda", "").strip()

        if agenda:
            description = f"{description} | {agenda}"

        contact_service.log_activity(
            contact=contact,
            action="Meeting scheduled",
            description=description,
            user=request.user,
        )

        return Response(
            {"message": "Meeting scheduled successfully"},
            status=status.HTTP_201_CREATED,
        )

    # Send Email

    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):

        contact = self.get_object()

        serializer = ContactSendEmailSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        subject = serializer.validated_data["subject"]
        provider = get_user_default_email_provider(request.user)
        if not provider:
            return Response(
                {"detail": "No active CRM-synced email provider is configured for this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        recipient_email = (serializer.validated_data.get("to_email") or contact.email or "").strip()
        if not recipient_email:
            return Response(
                {"detail": "Contact does not have an email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        create_outgoing_crm_email(
            provider_integration=provider,
            subject=subject,
            body=serializer.validated_data["body"],
            to_emails=[recipient_email],
            send_live=True,
            owner=request.user,
            contact=contact,
            account=contact.account,
            thread_id=f"contact-{contact.pk}",
            metadata={
                "from_name": provider.display_name or getattr(request.user, "email", "") or "CRM User",
                "contact_name": getattr(contact, "contact_name", None) or f"{contact.first_name} {contact.last_name}".strip(),
            },
        )

        contact_service.log_activity(
            contact=contact,
            action="Email sent",
            description=subject,
            user=request.user,
        )

        return Response(
            {"message": "Email sent and synced successfully"},
            status=status.HTTP_201_CREATED,
        )

    # Deals

    @action(detail=True, methods=["get"], url_path="deals")
    def deals(self, request, pk=None):
        contact = self.get_object()
        deals_qs = Deal.objects.filter(contact=contact).select_related("stage", "account", "deal_owner")
        serializer = DealListSerializer(deals_qs, many=True)
        return Response(serializer.data)
