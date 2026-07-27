from django.contrib import admin

from .models import LeadActivity


@admin.register(LeadActivity)
class LeadActivityAdmin(admin.ModelAdmin):
    list_display = ("id", "lead", "action", "user", "created_at")
    search_fields = ("action", "description")
