from django.utils import timezone
from rest_framework import serializers

from project.models import Project

from .models import (
    ATTENDANCE_STATUS_CHOICES,
    ProjectDeskMeeting,
    ProjectDeskMeetingParticipant,
    ProjectDeskTask,
)


class ProjectDeskTaskSerializer(serializers.ModelSerializer):
    project_id = serializers.IntegerField(source="project.id", read_only=True)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), write_only=True
    )
    owner = serializers.CharField(source="assigned_to", required=False, allow_blank=True)

    class Meta:
        model = ProjectDeskTask
        fields = [
            "id",
            "project",
            "project_id",
            "title",
            "description",
            "owner",
            "assigned_by",
            "due_date",
            "status",
            "priority",
        ]


class ProjectDeskMeetingParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectDeskMeetingParticipant
        fields = [
            "id",
            "participant_name",
            "participant_email",
            "attendance_status",
            "marked_at",
        ]


class ProjectDeskMeetingSerializer(serializers.ModelSerializer):
    project_id = serializers.IntegerField(source="project.id", read_only=True)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), write_only=True
    )
    participant_entries = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
    )
    attendance_records = ProjectDeskMeetingParticipantSerializer(many=True, read_only=True)
    attended_count = serializers.SerializerMethodField()
    not_attended_count = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectDeskMeeting
        fields = [
            "id",
            "project",
            "project_id",
            "title",
            "participants",
            "participant_entries",
            "meeting_type",
            "meeting_link",
            "location",
            "start_datetime",
            "status",
            "attendance_records",
            "attended_count",
            "not_attended_count",
            "pending_count",
        ]

    def validate(self, attrs):
        meeting_type = attrs.get("meeting_type") or getattr(self.instance, "meeting_type", "Online")
        meeting_link = attrs.get("meeting_link") if "meeting_link" in attrs else getattr(self.instance, "meeting_link", "")
        location = attrs.get("location") if "location" in attrs else getattr(self.instance, "location", "")
        participant_entries = attrs.pop("participant_entries", None)

        if meeting_type == "Online":
            attrs["location"] = ""
            if not meeting_link:
                raise serializers.ValidationError({"meeting_link": "Meeting link is required for online meetings."})
        elif meeting_type == "Offline":
            attrs["meeting_link"] = ""
            if not location:
                raise serializers.ValidationError({"location": "Location is required for offline meetings."})

        attrs["status"] = attrs.get("status") or getattr(self.instance, "status", "Scheduled") or "Scheduled"
        if participant_entries is not None:
            normalized_entries = []
            for entry in participant_entries:
                participant_name = str(entry.get("name", "")).strip()
                participant_email = str(entry.get("email", "")).strip().lower()
                if not participant_name and not participant_email:
                    continue
                normalized_entries.append({
                    "participant_name": participant_name or participant_email,
                    "participant_email": participant_email,
                })
            attrs["_participant_entries"] = normalized_entries
            attrs["participants"] = ", ".join(item["participant_name"] for item in normalized_entries)
        return attrs

    def create(self, validated_data):
        participant_entries = validated_data.pop("_participant_entries", [])
        meeting = super().create(validated_data)
        self._sync_attendance_records(meeting, participant_entries)
        return meeting

    def update(self, instance, validated_data):
        participant_entries = validated_data.pop("_participant_entries", None)
        meeting = super().update(instance, validated_data)
        if participant_entries is not None:
            self._sync_attendance_records(meeting, participant_entries)
        return meeting

    def _sync_attendance_records(self, meeting, participant_entries):
        meeting.attendance_records.all().delete()
        if not participant_entries:
            return
        ProjectDeskMeetingParticipant.objects.bulk_create([
            ProjectDeskMeetingParticipant(
                meeting=meeting,
                participant_name=entry["participant_name"],
                participant_email=entry["participant_email"],
            )
            for entry in participant_entries
        ])

    def get_attended_count(self, obj):
        return obj.attendance_records.filter(attendance_status="Attended").count()

    def get_not_attended_count(self, obj):
        return obj.attendance_records.filter(attendance_status="Not Attended").count()

    def get_pending_count(self, obj):
        return obj.attendance_records.filter(attendance_status="Pending").count()


class ProjectDeskMeetingAttendanceUpdateSerializer(serializers.Serializer):
    participant_id = serializers.IntegerField()
    attendance_status = serializers.ChoiceField(
        choices=[choice[0] for choice in ATTENDANCE_STATUS_CHOICES]
    )

    def save(self, **kwargs):
        meeting = self.context["meeting"]
        participant = meeting.attendance_records.get(id=self.validated_data["participant_id"])
        participant.attendance_status = self.validated_data["attendance_status"]
        participant.marked_at = timezone.now()
        participant.save(update_fields=["attendance_status", "marked_at"])
        return participant
