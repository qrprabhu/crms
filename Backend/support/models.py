from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.db import models

from core.base_models import BaseModel


def _next_support_code(model_class, field_name: str, prefix: str, using: str | None = None) -> str:
    last_value = (
        model_class.objects.using(using or "default")
        .filter(**{f"{field_name}__regex": rf"^{prefix}\d+$"})
        .order_by(f"-{field_name}")
        .values_list(field_name, flat=True)
        .first()
    )
    next_number = 1
    if last_value:
        try:
            next_number = int(str(last_value)[len(prefix) :]) + 1
        except (TypeError, ValueError):
            next_number = 1
    return f"{prefix}{next_number:04d}"


class SupportCase(BaseModel):
    case_number = models.CharField(max_length=32, unique=True, blank=True, db_index=True)
    subject = models.CharField(max_length=255)
    status = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    priority = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    case_origin = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    case_reason = models.CharField(max_length=150, blank=True, null=True, db_index=True)
    type = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    internal_comments = models.TextField(blank=True, null=True)
    solution_text = models.TextField(blank=True, null=True)
    reported_by = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True, db_index=True)
    company = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    country = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    lead_name = models.CharField(max_length=255, blank=True, null=True)
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        related_name="support_cases",
        null=True,
        blank=True,
    )
    lead_source = models.CharField(max_length=100, blank=True, null=True)
    no_of_comments = models.PositiveIntegerField(default=0)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_support_cases",
        null=True,
        blank=True,
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.SET_NULL,
        related_name="support_cases",
        null=True,
        blank=True,
    )
    related_contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="support_cases",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="support_cases",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="support_cases",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_support_cases",
        null=True,
        blank=True,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="updated_support_cases",
        null=True,
        blank=True,
    )
    last_activity_at = models.DateTimeField(blank=True, null=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["case_number"]),
            models.Index(fields=["subject"]),
            models.Index(fields=["status"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["case_origin"]),
            models.Index(fields=["company"]),
            models.Index(fields=["country"]),
            models.Index(fields=["owner"]),
            models.Index(fields=["account"]),
            models.Index(fields=["related_contact"]),
            models.Index(fields=["deal"]),
            models.Index(fields=["product"]),
            models.Index(fields=["lead"]),
            models.Index(fields=["last_activity_at"]),
            models.Index(fields=["is_active"]),
        ]

    def save(self, *args, **kwargs):
        if self.pk is None and not self.case_number:
            using = kwargs.get("using") or self._state.db
            self.case_number = _next_support_code(SupportCase, "case_number", "CAS", using=using)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.case_number or self.subject


class SupportSolution(BaseModel):
    solution_number = models.CharField(max_length=32, unique=True, blank=True, db_index=True)
    solution_title = models.CharField(max_length=255)
    status = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    question = models.TextField()
    answer = models.TextField()
    resolution_steps = models.TextField(blank=True, null=True)
    source_case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.SET_NULL,
        related_name="solutions",
        null=True,
        blank=True,
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.SET_NULL,
        related_name="support_solutions",
        null=True,
        blank=True,
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_support_solutions",
        null=True,
        blank=True,
    )
    no_of_comments = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_support_solutions",
        null=True,
        blank=True,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="updated_support_solutions",
        null=True,
        blank=True,
    )
    last_activity_at = models.DateTimeField(blank=True, null=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["solution_number"]),
            models.Index(fields=["solution_title"]),
            models.Index(fields=["status"]),
            models.Index(fields=["owner"]),
            models.Index(fields=["product"]),
            models.Index(fields=["last_activity_at"]),
            models.Index(fields=["is_active"]),
        ]

    def save(self, *args, **kwargs):
        if self.pk is None and not self.solution_number:
            using = kwargs.get("using") or self._state.db
            self.solution_number = _next_support_code(SupportSolution, "solution_number", "SOL", using=using)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.solution_number or self.solution_title


class SupportNote(BaseModel):
    case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.CASCADE,
        related_name="notes",
        null=True,
        blank=True,
    )
    solution = models.ForeignKey(
        "support.SupportSolution",
        on_delete=models.CASCADE,
        related_name="notes",
        null=True,
        blank=True,
    )
    note = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="support_notes",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["case", "created_at"]),
            models.Index(fields=["solution", "created_at"]),
        ]


class SupportComment(BaseModel):
    case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.CASCADE,
        related_name="comments",
        null=True,
        blank=True,
    )
    solution = models.ForeignKey(
        "support.SupportSolution",
        on_delete=models.CASCADE,
        related_name="comments",
        null=True,
        blank=True,
    )
    comment = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="support_comments",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["case", "created_at"]),
            models.Index(fields=["solution", "created_at"]),
        ]


class SupportAttachment(BaseModel):
    case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.CASCADE,
        related_name="attachments",
        null=True,
        blank=True,
    )
    solution = models.ForeignKey(
        "support.SupportSolution",
        on_delete=models.CASCADE,
        related_name="attachments",
        null=True,
        blank=True,
    )
    file = models.FileField(upload_to="support/")
    original_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=120, blank=True, null=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="support_attachments",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["case", "created_at"]),
            models.Index(fields=["solution", "created_at"]),
        ]

    @property
    def file_name(self) -> str:
        return Path(self.file.name).name


class SupportTimelineEntry(BaseModel):
    class ModuleType(models.TextChoices):
        CASE = "case", "Case"
        SOLUTION = "solution", "Solution"

    module_type = models.CharField(max_length=20, choices=ModuleType.choices, db_index=True)
    record_id = models.PositiveBigIntegerField(db_index=True)
    action_type = models.CharField(max_length=100, db_index=True)
    message = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="support_timeline_entries",
        null=True,
        blank=True,
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["module_type", "record_id", "created_at"]),
            models.Index(fields=["action_type"]),
        ]


class SupportLinkedRecord(BaseModel):
    case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.CASCADE,
        related_name="linked_records",
        null=True,
        blank=True,
    )
    solution = models.ForeignKey(
        "support.SupportSolution",
        on_delete=models.CASCADE,
        related_name="linked_records",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.CASCADE,
        related_name="support_links",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.CASCADE,
        related_name="support_links",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.CASCADE,
        related_name="support_links",
        null=True,
        blank=True,
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.CASCADE,
        related_name="support_links",
        null=True,
        blank=True,
    )
    vendor = models.ForeignKey(
        "inventory.Vendor",
        on_delete=models.CASCADE,
        related_name="support_links",
        null=True,
        blank=True,
    )
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        related_name="support_links",
        null=True,
        blank=True,
    )
    relationship_label = models.CharField(max_length=100, blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]


class SupportActivity(BaseModel):
    case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.CASCADE,
        related_name="activities",
        null=True,
        blank=True,
    )
    solution = models.ForeignKey(
        "support.SupportSolution",
        on_delete=models.CASCADE,
        related_name="activities",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_closed = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="support_activities",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["case", "is_closed", "created_at"]),
            models.Index(fields=["solution", "is_closed", "created_at"]),
        ]


class SupportEmailLog(BaseModel):
    case = models.ForeignKey(
        "support.SupportCase",
        on_delete=models.CASCADE,
        related_name="email_logs",
        null=True,
        blank=True,
    )
    solution = models.ForeignKey(
        "support.SupportSolution",
        on_delete=models.CASCADE,
        related_name="email_logs",
        null=True,
        blank=True,
    )
    to_email = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField(blank=True, null=True)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="support_email_logs",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]


class SupportImportJob(BaseModel):
    class ModuleType(models.TextChoices):
        CASE = "case", "Case"
        SOLUTION = "solution", "Solution"

    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        VALIDATED = "validated", "Validated"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    module_type = models.CharField(max_length=20, choices=ModuleType.choices, db_index=True)
    file = models.FileField(upload_to="support/imports/")
    original_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, blank=True, null=True)
    operation = models.CharField(max_length=30, blank=True, null=True)
    duplicate_check_field = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPLOADED, db_index=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="support_import_jobs",
        null=True,
        blank=True,
    )
    headers = models.JSONField(default=list, blank=True)
    sample_rows = models.JSONField(default=list, blank=True)
    field_mapping = models.JSONField(default=dict, blank=True)
    default_values = models.JSONField(default=dict, blank=True)
    automation_enabled = models.BooleanField(default=False)
    validation_errors = models.JSONField(default=list, blank=True)
    imported_count = models.PositiveIntegerField(default=0)
    updated_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    result_summary = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["module_type", "status", "created_at"]),
        ]
