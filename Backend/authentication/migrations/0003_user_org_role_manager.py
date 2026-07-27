import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0002_alter_otp_id_alter_user_id"),
    ]

    operations = [
        # role choice field
        migrations.AddField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Admin"),
                    ("manager", "Manager"),
                    ("employee", "Employee"),
                ],
                default="employee",
                max_length=20,
            ),
        ),
        # manager self-FK
        migrations.AddField(
            model_name="user",
            name="manager",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="team_members",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
