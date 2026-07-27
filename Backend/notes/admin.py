from django.contrib import admin

from .models import LeadNote


@admin.register(LeadNote)
class LeadNoteAdmin(admin.ModelAdmin):
    list_display = ("id", "lead", "created_by", "created_at")
    search_fields = ("note",)
