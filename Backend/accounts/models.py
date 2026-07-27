from django.conf import settings
from django.db import models

from core.base_models import BaseModel


def _rewrite_legacy_kwargs(kwargs: dict) -> dict:
    remapped = {}
    for key, value in kwargs.items():
        if key == "name":
            remapped["account_name"] = value
            continue
        if key.startswith("name__"):
            remapped[key.replace("name__", "account_name__", 1)] = value
            continue
        if key == "owner":
            remapped["account_owner"] = value
            continue
        if key.startswith("owner__"):
            remapped[key.replace("owner__", "account_owner__", 1)] = value
            continue
        if key == "employee_count":
            remapped["employees"] = value
            continue
        if key.startswith("employee_count__"):
            remapped[key.replace("employee_count__", "employees__", 1)] = value
            continue
        remapped[key] = value
    return remapped


class AccountQuerySet(models.QuerySet):
    def filter(self, *args, **kwargs):
        return super().filter(*args, **_rewrite_legacy_kwargs(kwargs))

    def exclude(self, *args, **kwargs):
        return super().exclude(*args, **_rewrite_legacy_kwargs(kwargs))

    def get(self, *args, **kwargs):
        return super().get(*args, **_rewrite_legacy_kwargs(kwargs))


class AccountManager(models.Manager):
    def get_queryset(self):
        return AccountQuerySet(self.model, using=self._db)

    def create(self, **kwargs):
        return super().create(**_rewrite_legacy_kwargs(kwargs))


class Account(BaseModel):
    class AccountType(models.TextChoices):
        ANALYST = "Analyst", "Analyst"
        COMPETITOR = "Competitor", "Competitor"
        CUSTOMER = "Customer", "Customer"
        INTEGRATOR = "Integrator", "Integrator"
        INVESTOR = "Investor", "Investor"
        PARTNER = "Partner", "Partner"
        PRESS = "Press", "Press"
        PROSPECT = "Prospect", "Prospect"
        RESELLER = "Reseller", "Reseller"
        OTHER = "Other", "Other"

    class Rating(models.TextChoices):
        ACQUIRED = "Acquired", "Acquired"
        ACTIVE = "Active", "Active"
        MARKET_FAILED = "Market Failed", "Market Failed"
        PROJECT_CANCELLED = "Project Cancelled", "Project Cancelled"
        SHUT_DOWN = "Shut Down", "Shut Down"

    account_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_accounts",
        null=True,
        blank=True,
    )
    account_name = models.CharField(max_length=255, db_index=True)
    account_number = models.CharField(max_length=100, blank=True, null=True)
    account_type = models.CharField(
        max_length=50,
        choices=AccountType.choices,
        blank=True,
        null=True,
    )
    account_site = models.CharField(max_length=255, blank=True, null=True)
    parent_account = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="member_accounts",
        null=True,
        blank=True,
    )

    industry = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    annual_revenue = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    employees = models.PositiveIntegerField(blank=True, null=True)
    sic_code = models.CharField(max_length=50, blank=True, null=True)
    ownership = models.CharField(max_length=100, blank=True, null=True)
    rating = models.CharField(max_length=50, choices=Rating.choices, blank=True, null=True)

    phone = models.CharField(max_length=20, blank=True, null=True)
    fax = models.CharField(max_length=20, blank=True, null=True)
    website = models.URLField(max_length=255, blank=True, null=True)
    ticker_symbol = models.CharField(max_length=50, blank=True, null=True)

    billing_address = models.TextField(blank=True, null=True)
    shipping_address = models.TextField(blank=True, null=True)

    description = models.TextField(blank=True, null=True)
    image = models.FileField(upload_to="accounts/", blank=True, null=True)
    objects = AccountManager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["account_name"]),
            models.Index(fields=["account_owner"]),
            models.Index(fields=["industry"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["is_active"]),
        ]

    @property
    def name(self):
        # Backward compatibility for legacy code using account.name
        return self.account_name

    @name.setter
    def name(self, value):
        self.account_name = value

    @property
    def owner(self):
        # Backward compatibility for legacy code using account.owner
        return self.account_owner

    @owner.setter
    def owner(self, value):
        self.account_owner = value

    @property
    def employee_count(self):
        return self.employees

    @employee_count.setter
    def employee_count(self, value):
        self.employees = value

    def __str__(self):
        return self.account_name


class AccountAttachment(BaseModel):
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to="accounts/")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="account_attachments",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["account", "created_at"]),
        ]

    def __str__(self):
        return f"Attachment {self.pk} for account {self.account_id}"
