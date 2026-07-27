from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0017_rename_activities_call_owner_idx_activities__owner_i_3289d4_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="meeting",
            name="meeting_link",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
    ]
