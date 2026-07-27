import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Document",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("title", models.CharField(db_index=True, max_length=255)),
                ("description", models.TextField(blank=True, null=True)),
                ("file", models.FileField(upload_to="documents/")),
                (
                    "document_type",
                    models.CharField(
                        choices=[
                            ("portfolio", "Portfolio"),
                            ("requirement", "Requirement"),
                            ("presentation", "Presentation"),
                            ("meeting_notes", "Meeting Notes"),
                            ("contract", "Contract"),
                            ("other", "Other"),
                        ],
                        db_index=True,
                        default="other",
                        max_length=50,
                    ),
                ),
                (
                    "related_module",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("lead", "Lead"),
                            ("contact", "Contact"),
                            ("deal", "Deal"),
                            ("project", "Project"),
                        ],
                        db_index=True,
                        max_length=50,
                        null=True,
                    ),
                ),
                ("related_id", models.BigIntegerField(blank=True, db_index=True, null=True)),
                ("version", models.PositiveIntegerField(default=1)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="uploaded_documents",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="DocumentVersion",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("file", models.FileField(upload_to="documents/versions/")),
                ("version_number", models.PositiveIntegerField()),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                (
                    "document",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="versions",
                        to="documents.document",
                    ),
                ),
            ],
            options={
                "ordering": ["-version_number"],
            },
        ),
        migrations.AddIndex(
            model_name="document",
            index=models.Index(
                fields=["related_module", "related_id"],
                name="docs_module_related_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="document",
            index=models.Index(
                fields=["is_active", "created_at"],
                name="docs_active_created_idx",
            ),
        ),
    ]
