from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0002_campaignsubmission"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaignsubmission",
            name="website",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
    ]
