from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0004_rename_inventory_q_price_b_0f3fa5_idx_inventory_q_price_b_1652b2_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="billing_cycle",
            field=models.CharField(
                choices=[
                    ("one_time", "One-time"),
                    ("monthly", "Monthly"),
                    ("quarterly", "Quarterly"),
                    ("yearly", "Yearly"),
                    ("custom", "Custom"),
                ],
                db_index=True,
                default="custom",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="default_user_seats",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="product",
            name="deployment_model",
            field=models.CharField(
                choices=[("cloud", "Cloud"), ("on_prem", "On-premise"), ("hybrid", "Hybrid")],
                default="cloud",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="implementation_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="product",
            name="license_type",
            field=models.CharField(
                choices=[
                    ("named", "Named User"),
                    ("concurrent", "Concurrent"),
                    ("unlimited", "Unlimited"),
                    ("trial", "Trial"),
                ],
                default="named",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="product_type",
            field=models.CharField(
                choices=[
                    ("software", "Software"),
                    ("service", "Service"),
                    ("addon", "Add-on"),
                    ("bundle", "Bundle"),
                ],
                db_index=True,
                default="software",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="renewal_required",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="product",
            name="subscription_term_months",
            field=models.PositiveIntegerField(default=12),
        ),
        migrations.AddField(
            model_name="quote",
            name="billing_cycle",
            field=models.CharField(
                choices=[
                    ("one_time", "One-time"),
                    ("monthly", "Monthly"),
                    ("quarterly", "Quarterly"),
                    ("yearly", "Yearly"),
                    ("custom", "Custom"),
                ],
                default="custom",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="quote",
            name="implementation_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="quote",
            name="license_type",
            field=models.CharField(
                choices=[
                    ("named", "Named User"),
                    ("concurrent", "Concurrent"),
                    ("unlimited", "Unlimited"),
                    ("trial", "Trial"),
                ],
                default="named",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="quote",
            name="licensed_users",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="quote",
            name="renewal_due_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="quote",
            name="subscription_end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="quote",
            name="subscription_start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="salesorder",
            name="billing_cycle",
            field=models.CharField(
                choices=[
                    ("one_time", "One-time"),
                    ("monthly", "Monthly"),
                    ("quarterly", "Quarterly"),
                    ("yearly", "Yearly"),
                    ("custom", "Custom"),
                ],
                default="custom",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="salesorder",
            name="implementation_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="salesorder",
            name="license_type",
            field=models.CharField(
                choices=[
                    ("named", "Named User"),
                    ("concurrent", "Concurrent"),
                    ("unlimited", "Unlimited"),
                    ("trial", "Trial"),
                ],
                default="named",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="salesorder",
            name="licensed_users",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="salesorder",
            name="renewal_due_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="salesorder",
            name="subscription_end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="salesorder",
            name="subscription_start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="invoice",
            name="billing_cycle",
            field=models.CharField(
                choices=[
                    ("one_time", "One-time"),
                    ("monthly", "Monthly"),
                    ("quarterly", "Quarterly"),
                    ("yearly", "Yearly"),
                    ("custom", "Custom"),
                ],
                default="custom",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="invoice",
            name="implementation_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="invoice",
            name="license_type",
            field=models.CharField(
                choices=[
                    ("named", "Named User"),
                    ("concurrent", "Concurrent"),
                    ("unlimited", "Unlimited"),
                    ("trial", "Trial"),
                ],
                default="named",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="invoice",
            name="licensed_users",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="invoice",
            name="renewal_due_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="invoice",
            name="subscription_end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="invoice",
            name="subscription_start_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
