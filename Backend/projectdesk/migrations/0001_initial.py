from django.db import migrations, models
import django.db.models.deletion


def copy_existing_project_tasks(apps, schema_editor):
    LegacyProjectTask = apps.get_model("project", "ProjectTask")
    ProjectDeskTask = apps.get_model("projectdesk", "ProjectDeskTask")

    for legacy_task in LegacyProjectTask.objects.all():
        ProjectDeskTask.objects.create(
            project_id=legacy_task.project_id,
            title=legacy_task.title,
            description=getattr(legacy_task, "description", "") or "",
            assigned_to=getattr(legacy_task, "owner", "") or "",
            assigned_by=getattr(legacy_task, "assigned_by", "") or "",
            due_date=legacy_task.due_date,
            priority=legacy_task.priority if legacy_task.priority in {"Low", "Medium", "High"} else "Medium",
            status=legacy_task.status,
        )


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("project", "0002_projecttask_description_assigned_by"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProjectDeskTask",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("assigned_to", models.CharField(blank=True, max_length=255)),
                ("assigned_by", models.CharField(blank=True, max_length=255)),
                ("due_date", models.DateField(blank=True, null=True)),
                ("priority", models.CharField(choices=[("Low", "Low"), ("Medium", "Medium"), ("High", "High")], default="Medium", max_length=20)),
                ("status", models.CharField(choices=[("Not Started", "Not Started"), ("In Progress", "In Progress"), ("On Hold", "On Hold"), ("Completed", "Completed")], default="Not Started", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="projectdesk_tasks", to="project.project")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="ProjectDeskMeeting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("assigned_to", models.CharField(blank=True, max_length=255)),
                ("assigned_by", models.CharField(blank=True, max_length=255)),
                ("start_datetime", models.DateTimeField()),
                ("end_datetime", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(choices=[("Scheduled", "Scheduled"), ("Completed", "Completed"), ("Cancelled", "Cancelled"), ("Rescheduled", "Rescheduled")], default="Scheduled", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="projectdesk_meetings", to="project.project")),
            ],
            options={"ordering": ["-start_datetime", "-created_at"]},
        ),
        migrations.RunPython(copy_existing_project_tasks, migrations.RunPython.noop),
    ]
