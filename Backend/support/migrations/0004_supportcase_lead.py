from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("leads", "0001_initial"),
        ("support", "0003_supportsolution_resolution_steps"),
    ]

    operations = [
        migrations.AddField(
            model_name="supportcase",
            name="lead",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="support_cases",
                to="leads.lead",
            ),
        ),
        migrations.AddIndex(
            model_name="supportcase",
            index=models.Index(fields=["lead"], name="supportcase_lead_idx"),
        ),
    ]
