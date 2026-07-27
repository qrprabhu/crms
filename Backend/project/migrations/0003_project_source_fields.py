from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("project", "0002_projecttask_description_assigned_by"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="source_module",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="project",
            name="source_record_id",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="project",
            name="source_record_label",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddIndex(
            model_name="project",
            index=models.Index(fields=["source_module", "source_record_id"], name="project_pro_source__d37c48_idx"),
        ),
    ]
