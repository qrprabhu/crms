from django.db import models


TASK_STATUS_CHOICES = [
    ("Not Started", "Not Started"),
    ("In Progress", "In Progress"),
    ("On Hold", "On Hold"),
    ("Completed", "Completed"),
]

TASK_PRIORITY_CHOICES = [
    ("Low", "Low"),
    ("Medium", "Medium"),
    ("High", "High"),
]

MEETING_STATUS_CHOICES = [
    ("Scheduled", "Scheduled"),
    ("Completed", "Completed"),
    ("Cancelled", "Cancelled"),
    ("Rescheduled", "Rescheduled"),
]

MEETING_TYPE_CHOICES = [
    ("Online", "Online"),
    ("Offline", "Offline"),
]

ATTENDANCE_STATUS_CHOICES = [
    ("Pending", "Pending"),
    ("Attended", "Attended"),
    ("Not Attended", "Not Attended"),
]


class ProjectDeskTask(models.Model):
    project = models.ForeignKey(
        "project.Project",
        on_delete=models.CASCADE,
        related_name="projectdesk_tasks",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    assigned_to = models.CharField(max_length=255, blank=True)
    assigned_by = models.CharField(max_length=255, blank=True)
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=20, choices=TASK_PRIORITY_CHOICES, default="Medium")
    status = models.CharField(max_length=20, choices=TASK_STATUS_CHOICES, default="Not Started")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class ProjectDeskMeeting(models.Model):
    project = models.ForeignKey(
        "project.Project",
        on_delete=models.CASCADE,
        related_name="projectdesk_meetings",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    assigned_to = models.CharField(max_length=255, blank=True)
    assigned_by = models.CharField(max_length=255, blank=True)
    participants = models.TextField(blank=True)
    meeting_type = models.CharField(max_length=20, choices=MEETING_TYPE_CHOICES, default="Online")
    meeting_link = models.URLField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=MEETING_STATUS_CHOICES, default="Scheduled")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_datetime", "-created_at"]

    def __str__(self):
        return self.title


class ProjectDeskMeetingParticipant(models.Model):
    meeting = models.ForeignKey(
        ProjectDeskMeeting,
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    participant_name = models.CharField(max_length=255)
    participant_email = models.EmailField(blank=True, default="")
    attendance_status = models.CharField(
        max_length=20,
        choices=ATTENDANCE_STATUS_CHOICES,
        default="Pending",
    )
    marked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["participant_name"]

    def __str__(self):
        return f"{self.meeting.title} - {self.participant_name}"
