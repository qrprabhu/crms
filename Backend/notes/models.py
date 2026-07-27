from django.conf import settings
from django.db import models

class LeadNote(models.Model):
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        related_name="notes",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.CASCADE,
        related_name="notes",
        null=True,
        blank=True,
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.CASCADE,
        related_name="notes",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        on_delete=models.CASCADE,
        related_name="notes",
        null=True,
        blank=True,
    )
    note = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="lead_notes",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["lead", "created_at"]),
            models.Index(fields=["contact", "created_at"]),
            models.Index(fields=["account", "created_at"]),
            models.Index(fields=["deal", "created_at"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        if self.lead_id:
            return f"Note {self.pk} for lead {self.lead_id}"
        if self.contact_id:
            return f"Note {self.pk} for contact {self.contact_id}"
        if self.account_id:
            return f"Note {self.pk} for account {self.account_id}"
        if self.deal_id:
            return f"Note {self.pk} for deal {self.deal_id}"
        return f"Note {self.pk}"
