from django.core.exceptions import ObjectDoesNotExist
from django.http import Http404
import json
from django.db import transaction
from django.db.models.functions import Lower
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from integrations.services import create_outgoing_crm_email, get_user_default_email_provider

from .filters import AccountFilter
from .models import Account, AccountAttachment
from .permissions import AccountPermission, can_access_account_owner
from .serializers import (
    AccountActionSerializer,
    AccountAttachmentCreateSerializer,
    AccountAttachmentSerializer,
    AccountCloneResponseSerializer,
    AccountDetailSerializer,
    AccountLogCallSerializer,
    AccountListSerializer,
    AccountMergeSerializer,
    AccountMeetingSerializer,
    AccountNoteCreateSerializer,
    AccountNoteSerializer,
    AccountSendEmailSerializer,
    AccountTimelineSerializer,
    AccountWriteSerializer,
    AccountImageUploadSerializer,
    RelatedContactSerializer,
    RelatedDealSerializer,
)
from .services import account_service

ACCOUNT_TYPE_ALIASES = {
    "analyst": Account.AccountType.ANALYST,
    "competitor": Account.AccountType.COMPETITOR,
    "customer": Account.AccountType.CUSTOMER,
    "client": Account.AccountType.CUSTOMER,
    "integrator": Account.AccountType.INTEGRATOR,
    "investor": Account.AccountType.INVESTOR,
    "partner": Account.AccountType.PARTNER,
    "press": Account.AccountType.PRESS,
    "prospect": Account.AccountType.PROSPECT,
    "reseller": Account.AccountType.RESELLER,
    "distributor": Account.AccountType.RESELLER,
    "dealer": Account.AccountType.RESELLER,
    "other": Account.AccountType.OTHER,
}


class AccountViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, AccountPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = AccountFilter
    search_fields = ["account_name", "phone", "website", "industry", "account_owner__email"]
    ordering_fields = ["created_at", "updated_at", "account_name", "annual_revenue", "employees"]
    ordering = ["-created_at"]

    def _resolve_user_value(self, raw_value):
        from django.contrib.auth import get_user_model

        User = get_user_model()

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

    def _normalize_account_type(self, raw_value):
        if raw_value in (None, ""):
            return None

        value = str(raw_value).strip()
        if not value:
            return None

        return ACCOUNT_TYPE_ALIASES.get(value.lower(), value)

    def get_queryset(self):
        queryset = account_service.list_accounts(user=self.request.user)
        sort = self.request.query_params.get("sort")
        if sort:
            allowed = set(self.ordering_fields)
            normalized = sort[1:] if sort.startswith("-") else sort
            if normalized in allowed:
                queryset = queryset.order_by(sort)
        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return AccountListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return AccountWriteSerializer
        if self.action == "timeline":
            return AccountTimelineSerializer
        if self.action == "notes" and self.request.method == "POST":
            return AccountNoteCreateSerializer
        if self.action == "notes":
            return AccountNoteSerializer
        if self.action == "create_task":
            return AccountActionSerializer
        if self.action == "log_call":
            return AccountLogCallSerializer
        if self.action == "schedule_meeting":
            return AccountMeetingSerializer
        if self.action == "send_email":
            return AccountSendEmailSerializer
        if self.action == "clone":
            return AccountCloneResponseSerializer
        if self.action == "merge":
            return AccountMergeSerializer
        if self.action == "contacts":
            return RelatedContactSerializer
        if self.action == "deals":
            return RelatedDealSerializer
        if self.action in {"attachments", "delete_attachment"} and self.request.method == "POST":
            return AccountAttachmentCreateSerializer
        if self.action == "attachments":
            return AccountAttachmentSerializer
        if self.action == "upload_image":
            return AccountImageUploadSerializer
        return AccountDetailSerializer

    def create(self, request, *args, **kwargs):
        if isinstance(request.data, list) or "records" in request.data:
            return self.import_records(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = account_service.create_account(data=serializer.validated_data, user=request.user)
        return Response(AccountDetailSerializer(account).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        try:
            account = account_service.get_account_detail(account_id=kwargs["pk"], user=request.user)
        except ObjectDoesNotExist as exc:
            raise Http404 from exc
        self.check_object_permissions(request, account)
        serializer = self.get_serializer(account)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        account = self.get_object()
        serializer = self.get_serializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = account_service.update_account(
            account=account,
            data=serializer.validated_data,
            user=request.user,
        )
        return Response(AccountDetailSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        account = self.get_object()
        account_service.delete_account(account=account, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="import")
    def import_records(self, request):
        payload = request.data.get("records", request.data)
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError:
                pass
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

        allowed_fields = set(AccountWriteSerializer.Meta.fields)
        allowed_fields.update({"name", "owner"})
        invalid_columns = sorted(
            {key for row in payload if isinstance(row, dict) for key in row.keys()} - allowed_fields
        )

        errors = []
        normalized_records = []

        for index, row in enumerate(payload, start=1):
            if not isinstance(row, dict):
                errors.append({"row": index, "errors": {"row": ["Row data is invalid."]}})
                continue

            normalized = {}
            for key, value in row.items():
                if key not in allowed_fields:
                    continue
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
                if key in {"employees"} and isinstance(value, str):
                    cleaned = value.replace(",", "")
                    try:
                        value = int(cleaned)
                    except ValueError:
                        pass
                normalized[key] = value

            if not normalized:
                errors.append({"row": index, "errors": {"row": ["Row is empty."]}})
                continue

            if not normalized.get("account_name") and normalized.get("name"):
                normalized["account_name"] = normalized.get("name")

            if not normalized.get("account_name"):
                errors.append({"row": index, "errors": {"account_name": ["account_name is required."]}})
                continue

            owner_value = normalized.get("account_owner", normalized.get("owner"))
            if owner_value not in (None, ""):
                owner = self._resolve_user_value(owner_value)
                normalized["account_owner"] = (owner or request.user).pk
                normalized.pop("owner", None)

            account_type = self._normalize_account_type(normalized.get("account_type"))
            if account_type:
                normalized["account_type"] = account_type

            if not normalized.get("account_owner"):
                normalized["account_owner"] = request.user.pk

            serializer = AccountWriteSerializer(data=normalized, context={"request": request})
            if not serializer.is_valid():
                errors.append({"row": index, "errors": serializer.errors})
                continue
            record = serializer.validated_data
            if not record.get("account_owner"):
                record["account_owner"] = request.user
            normalized_records.append(record)

        if invalid_columns:
            errors.append({"row": 0, "errors": {"invalid_columns": invalid_columns}})

        existing_names = set()
        names = [record.get("account_name") for record in normalized_records if record.get("account_name")]
        if names:
            lowered = [name.lower() for name in names]
            existing_names = set(
                Account.objects.annotate(name_lower=Lower("account_name"))
                .filter(name_lower__in=lowered)
                .values_list("name_lower", flat=True)
            )

        valid_records = []
        skipped_count = 0
        for index, data in enumerate(normalized_records, start=1):
            name = data.get("account_name")
            if name and name.lower() in existing_names:
                errors.append({"row": index, "errors": {"account_name": ["Account already exists."]}})
                skipped_count += 1
                continue
            valid_records.append(data)

        created_count = 0
        if valid_records:
            with transaction.atomic():
                accounts = [Account(**record) for record in valid_records]
                Account.objects.bulk_create(accounts, batch_size=500)
                created_count = len(accounts)

        return Response(
            {
                "message": "Accounts import completed.",
                "total": len(payload),
                "imported_count": created_count,
                "skipped_count": skipped_count,
                "error_count": len(errors),
                "errors": errors,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="clone")
    def clone(self, request, pk=None):
        account = self.get_object()
        cloned = account_service.clone_account(account=account, user=request.user)
        return Response(
            {"message": "Account cloned successfully", "account_id": cloned.pk},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="merge")
    def merge(self, request):
        serializer = AccountMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            target = account_service.get_account_detail(
                account_id=serializer.validated_data["target_account_id"],
                user=request.user,
            )
        except ObjectDoesNotExist:
            return Response({"detail": "Target account not found."}, status=status.HTTP_404_NOT_FOUND)
        source_ids = serializer.validated_data["source_account_ids"]
        sources = list(self.get_queryset().filter(pk__in=source_ids).exclude(pk=target.pk))
        merged = account_service.merge_accounts(target=target, sources=sources, user=request.user)
        return Response(AccountDetailSerializer(merged).data)

    @action(detail=True, methods=["get"], url_path="contacts")
    def contacts(self, request, pk=None):
        account = self.get_object()
        data = account_service.list_account_contacts(account=account)
        return Response(RelatedContactSerializer(data, many=True).data)

    @action(detail=True, methods=["get"], url_path="deals")
    def deals(self, request, pk=None):
        account = self.get_object()
        data = account_service.list_account_deals(account=account)
        return Response(RelatedDealSerializer(data, many=True).data)

    @action(detail=True, methods=["get"], url_path="activities")
    def activities(self, request, pk=None):
        account = self.get_object()
        data = account_service.list_account_activities(account=account)
        return Response(AccountTimelineSerializer(data, many=True).data)

    @action(detail=True, methods=["get"], url_path="emails")
    def emails(self, request, pk=None):
        account = self.get_object()
        return Response(account_service.list_account_emails(account=account))

    @action(detail=True, methods=["get"], url_path="products")
    def products(self, request, pk=None):
        account = self.get_object()
        return Response(account_service.list_account_products(account=account))

    @action(detail=True, methods=["get"], url_path="quotes")
    def quotes(self, request, pk=None):
        account = self.get_object()
        return Response(account_service.list_account_quotes(account=account))

    @action(detail=True, methods=["get"], url_path="orders")
    def orders(self, request, pk=None):
        account = self.get_object()
        return Response(account_service.list_account_orders(account=account))

    @action(detail=True, methods=["get"], url_path="invoices")
    def invoices(self, request, pk=None):
        account = self.get_object()
        return Response(account_service.list_account_invoices(account=account))

    @action(detail=True, methods=["get"], url_path="cases")
    def cases(self, request, pk=None):
        account = self.get_object()
        return Response(account_service.list_account_cases(account=account))

    @action(detail=True, methods=["get"], url_path="member-accounts")
    def member_accounts(self, request, pk=None):
        account = self.get_object()
        members = account.member_accounts.filter(is_active=True).select_related("account_owner")
        return Response(AccountListSerializer(members, many=True).data)

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        account = self.get_object()
        timeline = account_service.timeline_service.list_events(account=account)
        return Response(AccountTimelineSerializer(timeline, many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="notes")
    def notes(self, request, pk=None):
        account = self.get_object()
        if request.method == "GET":
            notes = account_service.notes_service.list_notes(account=account)
            return Response(AccountNoteSerializer(notes, many=True).data)

        serializer = AccountNoteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = account_service.notes_service.create_note(
            account=account,
            note=serializer.validated_data["note"],
            user=request.user,
        )
        account_service.log_activity(
            account=account,
            action="Notes added",
            description="Note added to account",
            user=request.user,
        )
        return Response(AccountNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, pk=None):
        account = self.get_object()
        if request.method == "GET":
            attachments = account_service.list_attachments(account=account)
            return Response(AccountAttachmentSerializer(attachments, many=True).data)

        serializer = AccountAttachmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attachment = account_service.add_attachment(
            account=account,
            file=serializer.validated_data["file"],
            user=request.user,
        )
        return Response(AccountAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="upload-image")
    def upload_image(self, request, pk=None):
        account = self.get_object()
        serializer = AccountImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = account_service.upload_image(
            account=account,
            image=serializer.validated_data["image"],
            user=request.user,
        )
        return Response(AccountDetailSerializer(updated).data)

    @action(detail=True, methods=["post"], url_path="create-task")
    def create_task(self, request, pk=None):
        account = self.get_object()
        serializer = AccountActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account_service.log_activity(
            account=account,
            action="Task created",
            description=serializer.validated_data["subject"],
            user=request.user,
        )
        return Response({"message": "Task created successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="log-call")
    def log_call(self, request, pk=None):
        account = self.get_object()
        serializer = AccountLogCallSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        description = serializer.validated_data["call_summary"]
        outcome = serializer.validated_data.get("call_outcome", "").strip()
        if outcome:
            description = f"{description} | {outcome}"
        account_service.log_activity(
            account=account,
            action="Call logged",
            description=description,
            user=request.user,
        )
        return Response({"message": "Call logged successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="schedule-meeting")
    def schedule_meeting(self, request, pk=None):
        account = self.get_object()
        serializer = AccountMeetingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        description = serializer.validated_data["meeting_subject"]
        agenda = serializer.validated_data.get("agenda", "").strip()
        if agenda:
            description = f"{description} | {agenda}"
        account_service.log_activity(
            account=account,
            action="Meeting scheduled",
            description=description,
            user=request.user,
        )
        return Response({"message": "Meeting scheduled successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):
        account = self.get_object()
        serializer = AccountSendEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        provider = get_user_default_email_provider(request.user)
        if not provider:
            return Response(
                {"detail": "No active CRM-synced email provider is configured for this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        recipient_email = (
            serializer.validated_data.get("to_email")
            or account.contacts.filter(is_active=True).exclude(email__isnull=True).exclude(email__exact="").values_list("email", flat=True).first()
            or ""
        ).strip()
        if not recipient_email:
            return Response(
                {"detail": "Provide a recipient email address or add an email to an active contact for this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        create_outgoing_crm_email(
            provider_integration=provider,
            subject=serializer.validated_data["subject"],
            body=serializer.validated_data["body"],
            to_emails=[recipient_email],
            send_live=True,
            owner=request.user,
            account=account,
            thread_id=f"account-{account.pk}",
            metadata={
                "from_name": provider.display_name or getattr(request.user, "email", "") or "CRM User",
                "account_name": account.account_name,
            },
        )
        account_service.log_activity(
            account=account,
            action="Email sent",
            description=serializer.validated_data["subject"],
            user=request.user,
        )
        return Response({"message": "Email sent and synced successfully"}, status=status.HTTP_201_CREATED)


class AccountAttachmentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, attachment_id: int):
        try:
            attachment = AccountAttachment.objects.select_related("account").get(
                pk=attachment_id,
                is_active=True,
            )
        except AccountAttachment.DoesNotExist:
            return Response({"detail": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

        account = attachment.account
        if not can_access_account_owner(user=request.user, owner_id=account.account_owner_id):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)

        account_service.delete_attachment(attachment=attachment, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
