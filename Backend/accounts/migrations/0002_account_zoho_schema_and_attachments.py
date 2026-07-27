# Generated manually to preserve existing account data.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="account",
            options={"ordering": ["-created_at"]},
        ),
        migrations.RenameField(
            model_name="account",
            old_name="name",
            new_name="account_name",
        ),
        migrations.RenameField(
            model_name="account",
            old_name="owner",
            new_name="account_owner",
        ),
        migrations.RenameField(
            model_name="account",
            old_name="employee_count",
            new_name="employees",
        ),
        migrations.RemoveField(
            model_name="account",
            name="street",
        ),
        migrations.RemoveField(
            model_name="account",
            name="city",
        ),
        migrations.RemoveField(
            model_name="account",
            name="state",
        ),
        migrations.RemoveField(
            model_name="account",
            name="country",
        ),
        migrations.RemoveField(
            model_name="account",
            name="zip_code",
        ),
        migrations.AddField(
            model_name="account",
            name="account_number",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="account",
            name="account_site",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="account",
            name="account_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("Analyst", "Analyst"),
                    ("Competitor", "Competitor"),
                    ("Customer", "Customer"),
                    ("Integrator", "Integrator"),
                    ("Investor", "Investor"),
                    ("Partner", "Partner"),
                    ("Press", "Press"),
                    ("Prospect", "Prospect"),
                    ("Reseller", "Reseller"),
                    ("Other", "Other"),
                ],
                max_length=50,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="account",
            name="billing_address",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="account",
            name="description",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="account",
            name="fax",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="account",
            name="image",
            field=models.FileField(blank=True, null=True, upload_to="accounts/"),
        ),
        migrations.AddField(
            model_name="account",
            name="is_active",
            field=models.BooleanField(db_index=True, default=True),
        ),
        migrations.AddField(
            model_name="account",
            name="ownership",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="account",
            name="parent_account",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="member_accounts",
                to="accounts.account",
            ),
        ),
        migrations.AddField(
            model_name="account",
            name="rating",
            field=models.CharField(
                blank=True,
                choices=[
                    ("Acquired", "Acquired"),
                    ("Active", "Active"),
                    ("Market Failed", "Market Failed"),
                    ("Project Cancelled", "Project Cancelled"),
                    ("Shut Down", "Shut Down"),
                ],
                max_length=50,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="account",
            name="shipping_address",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="account",
            name="sic_code",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="account",
            name="ticker_symbol",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AlterField(
            model_name="account",
            name="account_owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="owned_accounts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="account",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterField(
            model_name="account",
            name="employees",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="account",
            name="industry",
            field=models.CharField(blank=True, db_index=True, max_length=100, null=True),
        ),
        migrations.AddIndex(
            model_name="account",
            index=models.Index(fields=["account_name"], name="accounts_acco_account_588933_idx"),
        ),
        migrations.AddIndex(
            model_name="account",
            index=models.Index(fields=["account_owner"], name="accounts_acco_account_de6a0c_idx"),
        ),
        migrations.AddIndex(
            model_name="account",
            index=models.Index(fields=["industry"], name="accounts_acco_industr_76e5f2_idx"),
        ),
        migrations.AddIndex(
            model_name="account",
            index=models.Index(fields=["created_at"], name="accounts_acco_created_7419b8_idx"),
        ),
        migrations.AddIndex(
            model_name="account",
            index=models.Index(fields=["is_active"], name="accounts_acco_is_acti_fd2f11_idx"),
        ),
        migrations.CreateModel(
            name="AccountAttachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("file", models.FileField(upload_to="accounts/")),
                (
                    "account",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attachments",
                        to="accounts.account",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="account_attachments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="accountattachment",
            index=models.Index(fields=["account", "created_at"], name="accounts_acco_account_2a7f62_idx"),
        ),
    ]

