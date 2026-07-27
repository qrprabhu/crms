from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projectdesk", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectdeskmeeting",
            name="participants",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="projectdeskmeeting",
            name="meeting_type",
            field=models.CharField(
                choices=[("Online", "Online"), ("Offline", "Offline")],
                default="Online",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="projectdeskmeeting",
            name="meeting_link",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="projectdeskmeeting",
            name="location",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
