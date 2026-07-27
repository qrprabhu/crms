from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0003_user_org_role_manager'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='name',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='user',
            name='must_change_password',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('admin', 'Main Admin'),
                    ('sub_admin', 'Sub Admin'),
                    ('manager', 'Manager'),
                    ('team_lead', 'Team Lead'),
                    ('business_development', 'Business Development'),
                    ('software_development', 'Software Development'),
                    ('support_team', 'Support Team'),
                    ('employee', 'Employee'),
                ],
                default='employee',
                max_length=30,
            ),
        ),
    ]
