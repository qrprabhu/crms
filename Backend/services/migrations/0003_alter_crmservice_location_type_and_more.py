from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("services", "0002_serviceappointment_appointment_for_label"),
    ]

    operations = [
        migrations.AlterField(
            model_name="crmservice",
            name="location_type",
            field=models.CharField(
                choices=[
                    ("onsite", "Onsite"),
                    ("remote", "Remote"),
                    ("hybrid", "Hybrid"),
                    ("in_store", "In Store"),
                    ("custom", "Custom"),
                ],
                default="custom",
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name="serviceappointment",
            name="appointment_for_type",
            field=models.CharField(
                choices=[
                    ("contact", "Contact"),
                    ("account", "Account"),
                    ("lead", "Lead"),
                    ("deal", "Deal"),
                    ("case", "Case"),
                    ("product", "Product"),
                    ("other", "Other"),
                ],
                default="other",
                max_length=20,
            ),
        ),
    ]
