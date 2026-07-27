from django.conf import settings
from django.db import models

class Lead(models.Model):
    class LeadStatus(models.TextChoices):
        NEW = "New", "New"
        CONTACTED = "Contacted", "Contacted"
        QUALIFIED = "Qualified", "Qualified"
        LOST = "Lost", "Lost"
        CONVERTED = "Converted", "Converted"

    class LeadSource(models.TextChoices):
        ADVERTISEMENT = "Advertisement", "Advertisement"
        COLD_CALL = "Cold Call", "Cold Call"
        WEB_DOWNLOAD = "Web Download", "Web Download"
        PARTNER = "Partner", "Partner"
        SEMINAR = "Seminar", "Seminar"
        EXTERNAL_REFERRAL = "External Referral", "External Referral"

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    company = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    mobile = models.CharField(max_length=20, blank=True, null=True)
    website = models.URLField(max_length=255, blank=True, null=True)
    lead_source = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )
    lead_status = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )
    industry = models.CharField(max_length=100, blank=True, null=True)
    annual_revenue = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        blank=True,
        null=True,
    )
    employee_count = models.IntegerField(blank=True, null=True)
    rating = models.CharField(max_length=50, blank=True, null=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="leads",
        null=True,
        blank=True,
    )
    converted_account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="converted_leads",
        null=True,
        blank=True,
    )
    converted_contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        related_name="converted_leads",
        null=True,
        blank=True,
    )
    converted_deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="converted_leads",
        null=True,
        blank=True,
    )
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        on_delete=models.SET_NULL,
        related_name="leads",
        null=True,
        blank=True,
    )
    street = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    zip_code = models.CharField(max_length=20, blank=True, null=True)
    skype_id = models.CharField(max_length=100, blank=True, null=True)
    secondary_email = models.EmailField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["company"]),
            models.Index(fields=["lead_status"]),
            models.Index(fields=["lead_source"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.company})"
