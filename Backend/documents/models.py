import uuid

from django.conf import settings
from django.db import models


class Document(models.Model):
    DOCUMENT_TYPES = [
        ("portfolio", "Portfolio"),
        ("requirement", "Requirement"),
        ("presentation", "Presentation"),
        ("meeting_notes", "Meeting Notes"),
        ("contract", "Contract"),
        ("other", "Other"),
    ]

    RELATED_MODULES = [
        ("lead", "Lead"),
        ("contact", "Contact"),
        ("deal", "Deal"),
        ("project", "Project"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to="documents/")
    document_type = models.CharField(
        max_length=50, choices=DOCUMENT_TYPES, default="other", db_index=True
    )
    related_module = models.CharField(
        max_length=50, choices=RELATED_MODULES, blank=True, null=True, db_index=True
    )
    related_id = models.BigIntegerField(blank=True, null=True, db_index=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_documents",
    )
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["related_module", "related_id"]),
            models.Index(fields=["is_active", "created_at"]),
        ]

    def __str__(self):
        return self.title

    @property
    def file_name(self):
        return self.file.name.split("/")[-1] if self.file else ""


class DocumentVersion(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    file = models.FileField(upload_to="documents/versions/")
    version_number = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version_number"]

    def __str__(self):
        return f"{self.document.title} v{self.version_number}"
