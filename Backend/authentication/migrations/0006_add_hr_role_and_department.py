from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0005_user_status'),
        ('authentication', '0005_user_team'),
    ]

    operations = [
        # Add department field
        migrations.AddField(
            model_name='user',
            name='department',
            field=models.CharField(
                blank=True,
                default='',
                max_length=30,
                choices=[
                    ('sales', 'Sales'),
                    ('business_development', 'Business Development'),
                    ('software_development', 'Software Development'),
                    ('support', 'Support'),
                ],
            ),
        ),
        # Alter role field to include hr
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('admin', 'Main Admin'),
                    ('sub_admin', 'Sub Admin'),
                    ('hr', 'HR'),
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
