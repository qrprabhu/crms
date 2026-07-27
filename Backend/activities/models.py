from django.conf import settings
from django.db import models

class LeadActivity(models.Model):
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        related_name="activities",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.CASCADE,
        related_name="activities",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.CASCADE,
        related_name="activities",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.CASCADE,
        related_name="activities",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="lead_activities",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["lead", "created_at"]),
            models.Index(fields=["contact", "created_at"]),
            models.Index(fields=["account", "created_at"]),
            models.Index(fields=["deal", "created_at"]),
            models.Index(fields=["created_at"]),
        ]
    def __str__(self):
        record_id = self.lead_id or self.contact_id or self.account_id or self.deal_id
        return f"{self.action} - {record_id}"



class Task(models.Model):
    class Status(models.TextChoices):
        NOT_STARTED = "Not Started", "Not Started"
        IN_PROGRESS = "In Progress", "In Progress"
        DEFERRED = "Deferred", "Deferred"
        COMPLETED = "Completed", "Completed"
        WAITING_INPUT = "Waiting for input", "Waiting for input"

    class Priority(models.TextChoices):
        HIGH = "High", "High"
        HIGHEST = "Highest", "Highest"
        NORMAL = "Normal", "Normal"
        LOW = "Low", "Low"
        LOWEST = "Lowest", "Lowest"

    subject = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)

    # creator / original owner (preserved for backwards compatibility)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="tasks",
        null=True,
        blank=True,
    )
    # who the task is assigned to (may differ from owner)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_tasks",
        null=True,
        blank=True,
    )
    # who performed the assignment (audit trail)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="delegated_tasks",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="tasks",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="tasks",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.NOT_STARTED)
    priority = models.CharField(max_length=32, choices=Priority.choices, default=Priority.NORMAL)
    reminder = models.BooleanField(default=False)
    repeat = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "created_at"]),
            models.Index(fields=["assigned_to", "created_at"]),
            models.Index(fields=["status", "due_date"]),
        ]

    def __str__(self):
        return f"{self.subject} ({self.status})"


class Meeting(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "Scheduled", "Scheduled"
        COMPLETED = "Completed", "Completed"
        CANCELLED = "Cancelled", "Cancelled"
        RESCHEDULED = "Rescheduled", "Rescheduled"

    class VenueType(models.TextChoices):
        IN_OFFICE = "In-office", "In-office"
        CLIENT_LOCATION = "Client location", "Client location"
        ONLINE = "Online", "Online"

    class RepeatType(models.TextChoices):
        NONE = "None", "None"
        DAILY = "Daily", "Daily"
        WEEKLY = "Weekly", "Weekly"
        MONTHLY = "Monthly", "Monthly"

    class ReminderType(models.TextChoices):
        NONE = "None", "None"
        AT_TIME = "At time of meeting", "At time of meeting"
        FIVE_MIN = "5 minutes before", "5 minutes before"
        TEN_MIN = "10 minutes before", "10 minutes before"
        FIFTEEN_MIN = "15 minutes before", "15 minutes before"
        THIRTY_MIN = "30 minutes before", "30 minutes before"
        ONE_HOUR = "1 hour before", "1 hour before"
        TWO_HOURS = "2 hours before", "2 hours before"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    meeting_venue = models.CharField(
        max_length=32, choices=VenueType.choices, default=VenueType.IN_OFFICE
    )
    all_day = models.BooleanField(default=False)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    meeting_link = models.URLField(max_length=500, blank=True, null=True)
    host = models.CharField(max_length=255, blank=True)
    participants = models.JSONField(default=list, blank=True)
    related_to = models.CharField(max_length=32, blank=True, default="None")
    repeat = models.CharField(
        max_length=32, choices=RepeatType.choices, default=RepeatType.NONE
    )
    participants_reminder = models.CharField(
        max_length=64, choices=ReminderType.choices, default=ReminderType.NONE
    )
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="organized_meetings",
        null=True,
        blank=True,
    )
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        related_name="meetings",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="meetings",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="meetings",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="meetings",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.SCHEDULED)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]
        indexes = [
            models.Index(fields=["organizer", "start_date"]),
            models.Index(fields=["status", "start_date"]),
            models.Index(fields=["contact", "start_date"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"


class Call(models.Model):
    class CallType(models.TextChoices):
        OUTBOUND = "Outbound", "Outbound"
        INBOUND = "Inbound", "Inbound"

    class CallStatus(models.TextChoices):
        SCHEDULED = "Scheduled", "Scheduled"
        COMPLETED = "Completed", "Completed"

    class RelatedToType(models.TextChoices):
        ACCOUNT = "Account", "Account"
        DEAL = "Deal", "Deal"
        NONE = "None", "None"

    class ReminderType(models.TextChoices):
        NONE = "None", "None"
        AT_TIME = "At time of call", "At time of call"
        FIVE_MIN = "5 minutes before", "5 minutes before"
        FIFTEEN_MIN = "15 minutes before", "15 minutes before"
        THIRTY_MIN = "30 minutes before", "30 minutes before"
        ONE_HOUR = "1 hour before", "1 hour before"

    subject = models.CharField(max_length=255)
    call_type = models.CharField(
        max_length=16, choices=CallType.choices, default=CallType.OUTBOUND
    )
    call_status = models.CharField(
        max_length=16, choices=CallStatus.choices, default=CallStatus.SCHEDULED
    )
    call_start_time = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=0)
    duration_seconds = models.PositiveIntegerField(default=0)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="calls",
        null=True,
        blank=True,
    )
    # Call For
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        related_name="calls",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="calls",
        null=True,
        blank=True,
    )
    # Related To
    related_to_type = models.CharField(
        max_length=16, choices=RelatedToType.choices, default=RelatedToType.NONE
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="calls",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="calls",
        null=True,
        blank=True,
    )
    reminder = models.CharField(
        max_length=32, choices=ReminderType.choices, default=ReminderType.NONE
    )
    purpose = models.TextField(blank=True)
    voice_recording = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-call_start_time"]
        indexes = [
            models.Index(fields=["owner", "call_start_time"]),
            models.Index(fields=["call_status", "call_start_time"]),
        ]

    def __str__(self):
        return f"{self.subject} ({self.call_type})"
