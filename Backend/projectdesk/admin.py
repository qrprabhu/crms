from django.contrib import admin

from .models import ProjectDeskMeeting, ProjectDeskMeetingParticipant, ProjectDeskTask


@admin.register(ProjectDeskTask)
class ProjectDeskTaskAdmin(admin.ModelAdmin):
    list_display = ["title", "project", "assigned_to", "assigned_by", "status", "priority", "due_date"]
    search_fields = ["title", "assigned_to", "assigned_by", "project__name", "project__project_code"]


@admin.register(ProjectDeskMeeting)
class ProjectDeskMeetingAdmin(admin.ModelAdmin):
    list_display = ["title", "project", "assigned_to", "assigned_by", "status", "start_datetime", "end_datetime"]
    search_fields = ["title", "assigned_to", "assigned_by", "project__name", "project__project_code"]


@admin.register(ProjectDeskMeetingParticipant)
class ProjectDeskMeetingParticipantAdmin(admin.ModelAdmin):
    list_display = ["meeting", "participant_name", "participant_email", "attendance_status", "marked_at"]
    search_fields = ["meeting__title", "participant_name", "participant_email", "meeting__project__name"]
