from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("services", "0004_serviceappointment_completed_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="crmservice",
            name="delivery_team",
            field=models.CharField(
                choices=[
                    ("sales", "Sales"),
                    ("support", "Support"),
                    ("service", "Service"),
                    ("technical", "Technical"),
                    ("customer_success", "Customer Success"),
                    ("operations", "Operations"),
                    ("general", "General"),
                ],
                db_index=True,
                default="general",
                max_length=30,
            ),
        ),
    ]
