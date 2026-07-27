from rest_framework import serializers

from .models import LeadActivity, Task, Meeting, Call


class LeadActivitySerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(source="created_at")

    class Meta:
        model = LeadActivity
        fields = ["id", "action", "description", "user", "timestamp"]

    def get_user(self, obj):
        if not obj.user:
            return None
        return getattr(obj.user, "username", None) or getattr(obj.user, "email", str(obj.user))


def _user_detail(user):
    """Shared helper — returns a minimal user dict for serializer output."""
    if not user:
        return None
    return {
        "id": user.pk,
        "email": getattr(user, "email", None),
        "name": (
            getattr(user, "get_full_name", lambda: None)()
            or getattr(user, "username", None)
            or getattr(user, "email", None)
        ),
    }


class TaskSerializer(serializers.ModelSerializer):
    # ── read-only computed fields (unchanged) ──────────────────────────────
    owner = serializers.SerializerMethodField()
    contact_id = serializers.IntegerField(read_only=True)
    account_id = serializers.IntegerField(read_only=True)
    contact_name = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()

    # ── new: assignment fields ─────────────────────────────────────────────
    # writable: accepts a user PK; null means "assign to nobody"
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=__import__("django.contrib.auth", fromlist=["get_user_model"]).get_user_model()._default_manager.all(),
        allow_null=True,
        required=False,
    )
    assigned_to_detail = serializers.SerializerMethodField()
    assigned_by_detail = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            # ── existing fields (order preserved) ──
            "id",
            "subject",
            "description",
            "due_date",
            "status",
            "priority",
            "reminder",
            "repeat",
            "owner",
            "contact",
            "contact_id",
            "contact_name",
            "account",
            "account_id",
            "account_name",
            "created_at",
            "updated_at",
            # ── new RBAC fields ──
            "assigned_to",          # writable PK
            "assigned_to_detail",   # read-only expanded object
            "assigned_by_detail",   # read-only expanded object
        ]
        read_only_fields = ["owner", "assigned_by_detail", "created_at", "updated_at"]

    # ── field getters ──────────────────────────────────────────────────────

    def get_owner(self, obj):
        return _user_detail(obj.owner)

    def get_assigned_to_detail(self, obj):
        return _user_detail(obj.assigned_to)

    def get_assigned_by_detail(self, obj):
        return _user_detail(obj.assigned_by)

    def get_contact_name(self, obj):
        if not obj.contact:
            return None
        first = getattr(obj.contact, "first_name", "")
        last = getattr(obj.contact, "last_name", "")
        name = f"{first} {last}".strip()
        return name or str(obj.contact)

    def get_account_name(self, obj):
        if not obj.account:
            return None
        return (
            getattr(obj.account, "account_name", None)
            or getattr(obj.account, "company_name", None)
            or str(obj.account)
        )


class MeetingSerializer(serializers.ModelSerializer):
    organizer = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = [
            "id",
            "title",
            "description",
            "meeting_venue",
            "all_day",
            "start_date",
            "end_date",
            "location",
            "meeting_link",
            "host",
            "participants",
            "related_to",
            "repeat",
            "participants_reminder",
            "organizer",
            "lead",
            "lead_name",
            "contact",
            "contact_name",
            "account",
            "account_name",
            "deal",
            "deal_name",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["organizer", "created_at", "updated_at"]

    def get_organizer(self, obj):
        if not obj.organizer:
            return None
        user = obj.organizer
        return {
            "id": user.pk,
            "name": getattr(user, "get_full_name", lambda: getattr(user, "username", None))()
            if hasattr(user, "get_full_name")
            else getattr(user, "username", None) or getattr(user, "email", None),
            "email": getattr(user, "email", None),
        }

    def get_lead_name(self, obj):
        if not obj.lead:
            return None
        first = getattr(obj.lead, "first_name", "")
        last = getattr(obj.lead, "last_name", "")
        name = f"{first} {last}".strip()
        return name or str(obj.lead)

    def get_contact_name(self, obj):
        if not obj.contact:
            return None
        first = getattr(obj.contact, "first_name", "")
        last = getattr(obj.contact, "last_name", "")
        name = f"{first} {last}".strip()
        return name or str(obj.contact)

    def get_account_name(self, obj):
        if not obj.account:
            return None
        return (
            getattr(obj.account, "account_name", None)
            or getattr(obj.account, "company_name", None)
            or str(obj.account)
        )

    def get_deal_name(self, obj):
        if not obj.deal:
            return None
        return getattr(obj.deal, "deal_name", None) or str(obj.deal)


class CallSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    deal_name = serializers.SerializerMethodField()

    class Meta:
        model = Call
        fields = [
            "id",
            "subject",
            "call_type",
            "call_status",
            "call_start_time",
            "duration_minutes",
            "duration_seconds",
            "owner",
            "owner_name",
            "lead",
            "lead_name",
            "contact",
            "contact_name",
            "related_to_type",
            "account",
            "account_name",
            "deal",
            "deal_name",
            "reminder",
            "purpose",
            "voice_recording",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "created_at", "updated_at"]

    def get_owner_name(self, obj):
        if not obj.owner:
            return None
        user = obj.owner
        return getattr(user, "get_full_name", lambda: None)() or getattr(user, "email", None)

    def get_lead_name(self, obj):
        if not obj.lead:
            return None
        first = getattr(obj.lead, "first_name", "")
        last = getattr(obj.lead, "last_name", "")
        return f"{first} {last}".strip() or str(obj.lead)

    def get_contact_name(self, obj):
        if not obj.contact:
            return None
        first = getattr(obj.contact, "first_name", "")
        last = getattr(obj.contact, "last_name", "")
        return f"{first} {last}".strip() or str(obj.contact)

    def get_account_name(self, obj):
        if not obj.account:
            return None
        return (
            getattr(obj.account, "account_name", None)
            or getattr(obj.account, "company_name", None)
            or str(obj.account)
        )

    def get_deal_name(self, obj):
        if not obj.deal:
            return None
        return getattr(obj.deal, "deal_name", None) or str(obj.deal)
