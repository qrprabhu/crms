from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("project", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="projecttask",
            name="assigned_by",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="projecttask",
            name="description",
            field=models.TextField(blank=True),
        ),
    ]
