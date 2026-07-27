from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0009_remove_user_team_user_organization_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="assigned_report_keys",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
