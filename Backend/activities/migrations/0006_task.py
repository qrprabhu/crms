from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("activities", "0005_leadactivity_deal_and_more"),
        (
            "accounts",
            "0003_rename_accounts_acco_account_588933_idx_accounts_ac_account_0b6f1d_idx_and_more",
        ),
        ("contacts", "0002_alter_contact_options_remove_contact_owner_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Task",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("subject", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("due_date", models.DateField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("Not Started", "Not Started"),
                            ("In Progress", "In Progress"),
                            ("Deferred", "Deferred"),
                            ("Completed", "Completed"),
                            ("Waiting for input", "Waiting for input"),
                        ],
                        default="Not Started",
                        max_length=32,
                    ),
                ),
                (
                    "priority",
                    models.CharField(
                        choices=[
                            ("High", "High"),
                            ("Highest", "Highest"),
                            ("Normal", "Normal"),
                            ("Low", "Low"),
                            ("Lowest", "Lowest"),
                        ],
                        default="Normal",
                        max_length=32,
                    ),
                ),
                ("reminder", models.BooleanField(default=False)),
                ("repeat", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="tasks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "contact",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="tasks",
                        to="contacts.contact",
                    ),
                ),
                (
                    "account",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="tasks",
                        to="accounts.account",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="task",
            index=models.Index(fields=["owner", "created_at"], name="activities_ta_owner_created_idx"),
        ),
        migrations.AddIndex(
            model_name="task",
            index=models.Index(fields=["status", "due_date"], name="activities_ta_status_due_idx"),
        ),
    ]
