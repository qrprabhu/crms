from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0004_alter_otp_id_alter_user_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="team",
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
