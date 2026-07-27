from django.conf import settings
from django.db import models

from core.base_models import BaseModel


class Contact(BaseModel):
    class LeadSource(models.TextChoices):
        ADVERTISEMENT = "Advertisement", "Advertisement"
        COLD_CALL = "Cold Call", "Cold Call"
        WEB_DOWNLOAD = "Web Download", "Web Download"
        PARTNER = "Partner", "Partner"
        SEMINAR = "Seminar", "Seminar"
        EXTERNAL_REFERRAL = "External Referral", "External Referral"

    contact_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_contacts",
        null=True,
        blank=True,
    )
    salutation = models.CharField(max_length=20, blank=True, null=True)
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.SET_NULL,
        related_name="contacts",
        null=True,
        blank=True,
    )
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    department = models.CharField(max_length=255, blank=True, null=True)
    assistant = models.CharField(max_length=255, blank=True, null=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    secondary_email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    mobile = models.CharField(max_length=20, blank=True, null=True)
    other_phone = models.CharField(max_length=20, blank=True, null=True)
    home_phone = models.CharField(max_length=20, blank=True, null=True)
    assistant_phone = models.CharField(max_length=20, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    lead_source = models.CharField(
        max_length=100,
        choices=LeadSource.choices,
        blank=True,
        null=True,
    )
    vendor_name = models.CharField(max_length=255, blank=True, null=True)
    fax = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    street = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    zip_code = models.CharField(max_length=20, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    created_from_lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.SET_NULL,
        related_name="generated_contacts",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["phone"]),
            models.Index(fields=["contact_owner"]),
            models.Index(fields=["account"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["email"],
                condition=models.Q(is_active=True),
                name="contacts_active_email_unique",
            ),
        ]

    @property
    def owner(self):
        # Compatibility alias for existing modules still referencing contact.owner.
        return self.contact_owner

    @owner.setter
    def owner(self, value):
        self.contact_owner = value

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip()
