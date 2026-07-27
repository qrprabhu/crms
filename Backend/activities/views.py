from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from django.contrib.auth import get_user_model

from .models import LeadActivity, Task, Meeting, Call
from .serializers import LeadActivitySerializer, TaskSerializer, MeetingSerializer, CallSerializer


class LeadActivityViewSet(ReadOnlyModelViewSet):
    queryset = LeadActivity.objects.select_related("lead", "user").all()
    serializer_class = LeadActivitySerializer
    permission_classes = [IsAuthenticated]


class TaskViewSet(ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Task.objects.select_related("owner", "assigned_to", "assigned_by", "contact", "account")
        user_id = self.request.query_params.get("user_id")
        if user_id and getattr(user, "role", "employee") in ("admin", "manager"):
            from django.db import models as dm
            qs = qs.filter(dm.Q(owner_id=user_id) | dm.Q(assigned_to_id=user_id))
        contact_id = self.request.query_params.get("contact")
        if contact_id:
            qs = qs.filter(contact_id=contact_id)
        return qs

    def _validate_assignment(self, assigner, assigned_to):
        if assigned_to is None:
            return
        role = getattr(assigner, "role", "employee")
        if role in ("admin", "sub_admin"):
            return
        if role in ("manager", "team_lead"):
            User = get_user_model()
            team_ids = list(User.objects.filter(manager=assigner, is_active=True).values_list("id", flat=True))
            if assigned_to.pk != assigner.pk and assigned_to.pk not in team_ids:
                raise PermissionDenied(detail="Managers can only assign to their direct reports.")
            return
        if assigned_to.pk != assigner.pk:
            raise PermissionDenied(detail="Employees can only assign tasks to themselves.")

    def perform_create(self, serializer):
        user = self.request.user
        assigned_to = serializer.validated_data.get("assigned_to")

        self._validate_assignment(user, assigned_to)

        save_kwargs = {"owner": user}
        if assigned_to and assigned_to.pk != user.pk:
            save_kwargs["assigned_by"] = user
        serializer.save(**save_kwargs)

    def perform_update(self, serializer):
        user = self.request.user
        assigned_to = serializer.validated_data.get(
            "assigned_to", serializer.instance.assigned_to
        )
        self._validate_assignment(user, assigned_to)

        save_kwargs = {}
        current_assigned = serializer.instance.assigned_to
        # Update assigned_by only if assigned_to is changing
        if assigned_to != current_assigned and assigned_to and assigned_to.pk != user.pk:
            save_kwargs["assigned_by"] = user

        serializer.save(**save_kwargs)

    @action(detail=False, methods=["get"], url_path="assignable-users")
    def assignable_users(self, request):
        """
        Returns the list of users the current user may assign tasks to.
        Frontend can use this to populate the 'Assign To' dropdown.
        """
        User = get_user_model()
        role = getattr(request.user, "role", "employee")
        if role in ("admin", "sub_admin"):
            users = User.objects.filter(is_active=True).values("id", "email")
        elif role in ("manager", "team_lead"):
            team_ids = list(User.objects.filter(manager=request.user, is_active=True).values_list("id", flat=True))
            team_ids.append(request.user.pk)
            users = User.objects.filter(pk__in=team_ids, is_active=True).values("id", "email")
        else:
            users = User.objects.filter(pk=request.user.pk).values("id", "email")
        return Response(list(users), status=status.HTTP_200_OK)


class MeetingViewSet(ModelViewSet):
    serializer_class = MeetingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        qs = Meeting.objects.select_related("organizer", "lead", "contact", "account", "deal")
        contact_id = self.request.query_params.get("contact")
        if contact_id:
            try:
                from contacts.models import Contact
                contact = Contact.objects.get(pk=contact_id)
                qs = qs.filter(
                    Q(contact_id=contact_id) |
                    Q(participants__contains=[{"email": contact.email}])
                )
            except Exception:
                qs = qs.filter(contact_id=contact_id)
        return qs

    def perform_create(self, serializer):
        meeting = serializer.save(organizer=self.request.user)
        self._send_meeting_link_emails(meeting)

    def perform_update(self, serializer):
        meeting = serializer.save()
        self._send_meeting_link_emails(meeting)

    def _send_meeting_link_emails(self, meeting):
        if meeting.meeting_venue != "Online" or not meeting.meeting_link:
            return
        participants = meeting.participants or []
        recipient_emails = [
            p["email"] for p in participants if isinstance(p, dict) and p.get("email")
        ]
        if not recipient_emails:
            return
        from django.core.mail import send_mail
        from django.conf import settings
        subject = f"Meeting Invitation: {meeting.title}"
        start = meeting.start_date.strftime("%d %b %Y, %I:%M %p") if meeting.start_date else ""
        message = (
            f"You have been invited to an online meeting.\n\n"
            f"Title: {meeting.title}\n"
            f"Date & Time: {start}\n"
            f"Host: {meeting.host}\n"
            f"Join Link: {meeting.meeting_link}\n\n"
            f"Please join using the link above at the scheduled time."
        )
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                recipient_emails,
                fail_silently=True,
            )
        except Exception:
            pass


class CallViewSet(ModelViewSet):
    serializer_class = CallSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Call.objects.select_related("owner", "lead", "contact", "account", "deal")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
