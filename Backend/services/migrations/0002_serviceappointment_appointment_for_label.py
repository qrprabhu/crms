from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("services", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="serviceappointment",
            name="appointment_for_label",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
