from django.contrib import admin

from .models import Deal, DealStage


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ("id", "deal_name", "account", "stage", "amount", "deal_owner", "is_active")
    search_fields = ("deal_name", "account__account_name")


@admin.register(DealStage)
class DealStageAdmin(admin.ModelAdmin):
    list_display = ("id", "stage_name", "probability", "order", "is_closed_stage")
    search_fields = ("stage_name",)
