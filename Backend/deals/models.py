from django.conf import settings
from django.db import models
from decimal import Decimal

from core.base_models import BaseModel


def _rewrite_legacy_kwargs(kwargs: dict) -> dict:
    remapped = {}
    for key, value in kwargs.items():
        if key == "name":
            remapped["deal_name"] = value
            continue
        if key.startswith("name__"):
            remapped[key.replace("name__", "deal_name__", 1)] = value
            continue
        if key == "owner":
            remapped["deal_owner"] = value
            continue
        if key.startswith("owner__"):
            remapped[key.replace("owner__", "deal_owner__", 1)] = value
            continue
        if key == "value":
            remapped["expected_revenue"] = value
            continue
        if key.startswith("value__"):
            remapped[key.replace("value__", "expected_revenue__", 1)] = value
            continue
        remapped[key] = value
    return remapped


class DealQuerySet(models.QuerySet):
    def filter(self, *args, **kwargs):
        return super().filter(*args, **_rewrite_legacy_kwargs(kwargs))

    def exclude(self, *args, **kwargs):
        return super().exclude(*args, **_rewrite_legacy_kwargs(kwargs))

    def get(self, *args, **kwargs):
        return super().get(*args, **_rewrite_legacy_kwargs(kwargs))


class DealManager(models.Manager):
    def get_queryset(self):
        return DealQuerySet(self.model, using=self._db)

    def create(self, **kwargs):
        return super().create(**_rewrite_legacy_kwargs(kwargs))


class DealStage(models.Model):
    stage_name = models.CharField(max_length=100, unique=True)
    probability = models.PositiveSmallIntegerField(default=0)
    order = models.PositiveSmallIntegerField(default=0, db_index=True)
    is_closed_stage = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "id"]

    def __eq__(self, other):
        if isinstance(other, str):
            return self.stage_name == other
        return super().__eq__(other)

    def __str__(self):
        return self.stage_name


class Deal(BaseModel):
    class DealStage:
        QUALIFICATION = "Qualification"
        OPEN = "Needs Analysis"
        WON = "Closed Won"
        LOST = "Closed Lost"

    deal_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_deals",
        null=True,
        blank=True,
    )
    deal_name = models.CharField(max_length=255)
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.CASCADE,
        related_name="deals",
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="deals",
        null=True,
        blank=True,
    )
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        related_name="deals",
        null=True,
        blank=True,
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    expected_revenue = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    stage = models.ForeignKey(
        "deals.DealStage",
        on_delete=models.PROTECT,
        related_name="deals",
    )
    probability = models.PositiveSmallIntegerField(blank=True, null=True)
    closing_date = models.DateField(blank=True, null=True, db_index=True)
    type = models.CharField(max_length=100, blank=True, null=True)
    lead_source = models.CharField(max_length=100, blank=True, null=True)
    campaign_source = models.CharField(max_length=255, blank=True, null=True)
    next_step = models.CharField(max_length=255, blank=True, null=True)
    forecast_category = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_closed = models.BooleanField(default=False)
    is_won = models.BooleanField(default=False)

    objects = DealManager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["stage"]),
            models.Index(fields=["closing_date"]),
            models.Index(fields=["deal_owner"]),
            models.Index(fields=["account"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["is_active"]),
        ]

    @property
    def name(self):
        return self.deal_name

    @name.setter
    def name(self, value):
        self.deal_name = value

    @property
    def owner(self):
        return self.deal_owner

    @owner.setter
    def owner(self, value):
        self.deal_owner = value

    @property
    def value(self):
        return self.expected_revenue

    @value.setter
    def value(self, val):
        self.expected_revenue = val

    def __str__(self):
        return self.deal_name


class DealProduct(BaseModel):
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.CASCADE,
        related_name="products",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="deal_products",
    )
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    total_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["deal", "created_at"]),
            models.Index(fields=["product"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.deal_id}:{self.product_id}"
