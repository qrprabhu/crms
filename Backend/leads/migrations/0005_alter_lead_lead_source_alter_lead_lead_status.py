from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0004_lead_converted_account_lead_converted_contact_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='lead',
            name='lead_source',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name='lead',
            name='lead_status',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
