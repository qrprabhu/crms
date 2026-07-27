from django.contrib import admin

from .models import Account, AccountAttachment


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("id", "account_name", "account_owner", "industry", "is_active", "created_at")
    search_fields = ("account_name", "website", "phone")


@admin.register(AccountAttachment)
class AccountAttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "account", "uploaded_by", "is_active", "created_at")
