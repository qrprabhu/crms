from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0002_alter_configuratorrule_options_alter_invoice_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="quote",
            name="price_book",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="quotes",
                to="inventory.pricebook",
            ),
        ),
        migrations.AddIndex(
            model_name="quote",
            index=models.Index(fields=["price_book"], name="inventory_q_price_b_0f3fa5_idx"),
        ),
    ]
