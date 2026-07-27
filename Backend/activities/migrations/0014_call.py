from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0013_add_lead_to_meeting"),
        ("accounts", "__first__"),
        ("contacts", "__first__"),
        ("deals", "__first__"),
        ("leads", "__first__"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Call",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject", models.CharField(max_length=255)),
                ("call_type", models.CharField(
                    choices=[("Outbound", "Outbound"), ("Inbound", "Inbound")],
                    default="Outbound",
                    max_length=16,
                )),
                ("call_status", models.CharField(
                    choices=[("Scheduled", "Scheduled"), ("Completed", "Completed")],
                    default="Scheduled",
                    max_length=16,
                )),
                ("call_start_time", models.DateTimeField()),
                ("duration_minutes", models.PositiveIntegerField(default=0)),
                ("duration_seconds", models.PositiveIntegerField(default=0)),
                ("related_to_type", models.CharField(
                    choices=[("Account", "Account"), ("Deal", "Deal"), ("None", "None")],
                    default="None",
                    max_length=16,
                )),
                ("reminder", models.CharField(
                    choices=[
                        ("None", "None"),
                        ("At time of call", "At time of call"),
                        ("5 minutes before", "5 minutes before"),
                        ("15 minutes before", "15 minutes before"),
                        ("30 minutes before", "30 minutes before"),
                        ("1 hour before", "1 hour before"),
                    ],
                    default="None",
                    max_length=32,
                )),
                ("purpose", models.TextField(blank=True)),
                ("voice_recording", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="calls",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("lead", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="calls",
                    to="leads.lead",
                )),
                ("contact", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="calls",
                    to="contacts.contact",
                )),
                ("account", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="calls",
                    to="accounts.account",
                )),
                ("deal", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="calls",
                    to="deals.deal",
                )),
            ],
            options={
                "ordering": ["-call_start_time"],
            },
        ),
        migrations.AddIndex(
            model_name="call",
            index=models.Index(fields=["owner", "call_start_time"], name="activities_call_owner_idx"),
        ),
        migrations.AddIndex(
            model_name="call",
            index=models.Index(fields=["call_status", "call_start_time"], name="activities_call_status_idx"),
        ),
    ]
