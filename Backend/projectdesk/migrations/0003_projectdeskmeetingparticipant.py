from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("projectdesk", "0002_projectdeskmeeting_participants_and_type"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProjectDeskMeetingParticipant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("participant_name", models.CharField(max_length=255)),
                ("participant_email", models.EmailField(blank=True, default="", max_length=254)),
                (
                    "attendance_status",
                    models.CharField(
                        choices=[("Pending", "Pending"), ("Attended", "Attended"), ("Not Attended", "Not Attended")],
                        default="Pending",
                        max_length=20,
                    ),
                ),
                ("marked_at", models.DateTimeField(blank=True, null=True)),
                (
                    "meeting",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attendance_records",
                        to="projectdesk.projectdeskmeeting",
                    ),
                ),
            ],
            options={
                "ordering": ["participant_name"],
            },
        ),
    ]
