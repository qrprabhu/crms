from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0002_alter_configuratorrule_options_alter_invoice_options_and_more"),
        ("deals", "0004_rename_deals_deal_stage_id_80e7c8_idx_deals_deal_stage_i_9f1e85_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="DealProduct",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("quantity", models.DecimalField(decimal_places=2, default=Decimal("1.00"), max_digits=15)),
                ("unit_price", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=15)),
                ("discount", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=15)),
                ("total_price", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=15)),
                (
                    "deal",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="products", to="deals.deal"),
                ),
                (
                    "product",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="deal_products", to="inventory.product"),
                ),
            ],
            options={
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="dealproduct",
            index=models.Index(fields=["deal", "created_at"], name="deals_dealp_deal_id_034f9d_idx"),
        ),
        migrations.AddIndex(
            model_name="dealproduct",
            index=models.Index(fields=["product"], name="deals_dealp_product_d87c7e_idx"),
        ),
        migrations.AddIndex(
            model_name="dealproduct",
            index=models.Index(fields=["is_active"], name="deals_dealp_is_acti_89beba_idx"),
        ),
    ]
