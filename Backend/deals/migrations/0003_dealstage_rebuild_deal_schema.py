# Generated manually to preserve deal data while introducing DealStage pipeline.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def seed_pipeline_and_map_deals(apps, schema_editor):
    DealStage = apps.get_model("deals", "DealStage")

    stage_rows = [
        ("Qualification", 10, 1, False),
        ("Needs Analysis", 20, 2, False),
        ("Value Proposition", 40, 3, False),
        ("Identify Decision Makers", 55, 4, False),
        ("Proposal/Price Quote", 75, 5, False),
        ("Negotiation/Review", 90, 6, False),
        ("Closed Won", 100, 7, True),
        ("Closed Lost", 0, 8, True),
        ("Closed Lost to Competition", 0, 9, True),
    ]
    stage_map = {}
    for stage_name, probability, order, is_closed_stage in stage_rows:
        obj, _ = DealStage.objects.get_or_create(
            stage_name=stage_name,
            defaults={
                "probability": probability,
                "order": order,
                "is_closed_stage": is_closed_stage,
            },
        )
        stage_map[stage_name] = obj

    old_stage_map = {
        "Qualification": "Qualification",
        "Open": "Needs Analysis",
        "Won": "Closed Won",
        "Lost": "Closed Lost",
    }

    connection = schema_editor.connection
    deal_table = "deals_deal"

    with connection.cursor() as cursor:
        columns = {
            row.name
            for row in connection.introspection.get_table_description(cursor, deal_table)
        }

        # Handle partially-upgraded tenant schemas gracefully.
        if "legacy_stage" in columns:
            stage_source_column = "legacy_stage"
        elif "stage" in columns:
            stage_source_column = "stage"
        else:
            stage_source_column = None

        cursor.execute(
            f'SELECT id{", " + stage_source_column if stage_source_column else ""} FROM {deal_table}'
        )
        rows = cursor.fetchall()

        default_stage = stage_map["Qualification"]
        for row in rows:
            deal_id = row[0]
            current_stage = row[1] if stage_source_column else None
            mapped_stage_name = old_stage_map.get(current_stage, "Qualification")
            stage = stage_map.get(mapped_stage_name, default_stage)
            cursor.execute(
                f"""
                UPDATE {deal_table}
                SET stage_id = %s,
                    probability = %s,
                    is_closed = %s,
                    is_won = %s
                WHERE id = %s
                """,
                [stage.id, stage.probability, stage.is_closed_stage, stage.stage_name == "Closed Won", deal_id],
            )


class Migration(migrations.Migration):

    dependencies = [
        ("deals", "0002_deal_amount_alter_deal_stage"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DealStage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("stage_name", models.CharField(max_length=100, unique=True)),
                ("probability", models.PositiveSmallIntegerField(default=0)),
                ("order", models.PositiveSmallIntegerField(db_index=True, default=0)),
                ("is_closed_stage", models.BooleanField(default=False)),
            ],
            options={"ordering": ["order", "id"]},
        ),
        migrations.RenameField(model_name="deal", old_name="name", new_name="deal_name"),
        migrations.RenameField(model_name="deal", old_name="owner", new_name="deal_owner"),
        migrations.RenameField(model_name="deal", old_name="value", new_name="expected_revenue"),
        migrations.RenameField(model_name="deal", old_name="stage", new_name="legacy_stage"),
        migrations.AddField(
            model_name="deal",
            name="campaign_source",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="deal",
            name="closing_date",
            field=models.DateField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="deal",
            name="description",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="deal",
            name="forecast_category",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="deal",
            name="is_active",
            field=models.BooleanField(db_index=True, default=True),
        ),
        migrations.AddField(
            model_name="deal",
            name="is_closed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="deal",
            name="is_won",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="deal",
            name="lead_source",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="deal",
            name="next_step",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="deal",
            name="probability",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="deal",
            name="stage",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="deals",
                to="deals.dealstage",
            ),
        ),
        migrations.AddField(
            model_name="deal",
            name="type",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name="deal",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterField(
            model_name="deal",
            name="deal_owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="owned_deals",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(seed_pipeline_and_map_deals, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name="deal",
            name="stage",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="deals",
                to="deals.dealstage",
            ),
        ),
        migrations.RemoveField(model_name="deal", name="legacy_stage"),
        migrations.AddIndex(
            model_name="deal",
            index=models.Index(fields=["stage"], name="deals_deal_stage_id_80e7c8_idx"),
        ),
        migrations.AddIndex(
            model_name="deal",
            index=models.Index(fields=["closing_date"], name="deals_deal_closing_84f637_idx"),
        ),
        migrations.AddIndex(
            model_name="deal",
            index=models.Index(fields=["deal_owner"], name="deals_deal_deal_ow_8ccf83_idx"),
        ),
        migrations.AddIndex(
            model_name="deal",
            index=models.Index(fields=["account"], name="deals_deal_account_b0f2fd_idx"),
        ),
        migrations.AddIndex(
            model_name="deal",
            index=models.Index(fields=["created_at"], name="deals_deal_created_7be7e1_idx"),
        ),
        migrations.AddIndex(
            model_name="deal",
            index=models.Index(fields=["is_active"], name="deals_deal_is_acti_8505bb_idx"),
        ),
    ]
