from django.contrib import admin

from .models import Contact


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ("id", "first_name", "last_name", "account", "contact_owner", "is_active")
    search_fields = ("first_name", "last_name", "email")
