from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.base_models import BaseModel


class ServicesModuleSettings(BaseModel):
    is_services_enabled = models.BooleanField(default=False)
    default_timezone = models.CharField(max_length=100, default="Asia/Calcutta")
    hide_promo = models.BooleanField(default=False)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return "Services Settings"


class BusinessHours(BaseModel):
    name = models.CharField(max_length=255)
    timezone = models.CharField(max_length=100)
    is_default = models.BooleanField(default=False, db_index=True)
    monday_enabled = models.BooleanField(default=False)
    monday_start = models.TimeField(blank=True, null=True)
    monday_end = models.TimeField(blank=True, null=True)
    tuesday_enabled = models.BooleanField(default=False)
    tuesday_start = models.TimeField(blank=True, null=True)
    tuesday_end = models.TimeField(blank=True, null=True)
    wednesday_enabled = models.BooleanField(default=False)
    wednesday_start = models.TimeField(blank=True, null=True)
    wednesday_end = models.TimeField(blank=True, null=True)
    thursday_enabled = models.BooleanField(default=False)
    thursday_start = models.TimeField(blank=True, null=True)
    thursday_end = models.TimeField(blank=True, null=True)
    friday_enabled = models.BooleanField(default=False)
    friday_start = models.TimeField(blank=True, null=True)
    friday_end = models.TimeField(blank=True, null=True)
    saturday_enabled = models.BooleanField(default=False)
    saturday_start = models.TimeField(blank=True, null=True)
    saturday_end = models.TimeField(blank=True, null=True)
    sunday_enabled = models.BooleanField(default=False)
    sunday_start = models.TimeField(blank=True, null=True)
    sunday_end = models.TimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_business_hours",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["name", "id"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["is_default"]),
            models.Index(fields=["is_active"]),
        ]

    def clean(self):
        for day in (
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ):
            enabled = getattr(self, f"{day}_enabled")
            start = getattr(self, f"{day}_start")
            end = getattr(self, f"{day}_end")
            if enabled:
                if not start or not end:
                    raise ValidationError({f"{day}_start": f"{day.title()} start and end times are required."})
                if start >= end:
                    raise ValidationError({f"{day}_end": f"{day.title()} end time must be after start time."})
            elif start or end:
                raise ValidationError({f"{day}_start": f"{day.title()} times must be empty when the day is disabled."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class CRMService(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        DRAFT = "draft", "Draft"

    class LocationType(models.TextChoices):
        ONSITE = "onsite", "Onsite"
        REMOTE = "remote", "Remote"
        HYBRID = "hybrid", "Hybrid"
        IN_STORE = "in_store", "In Store"
        CUSTOM = "custom", "Custom"

    class AvailabilityMode(models.TextChoices):
        BUSINESS_HOURS = "business_hours", "Business Hours"
        CUSTOM = "custom", "Custom"
        ALL_DAYS = "all_days", "All Days"

    class DeliveryTeam(models.TextChoices):
        SALES = "sales", "Sales"
        SUPPORT = "support", "Support"
        SERVICE = "service", "Service"
        TECHNICAL = "technical", "Technical"
        CUSTOMER_SUCCESS = "customer_success", "Customer Success"
        OPERATIONS = "operations", "Operations"
        GENERAL = "general", "General"

    service_code = models.CharField(max_length=32, unique=True, blank=True, db_index=True)
    service_name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    duration_minutes = models.PositiveIntegerField()
    location_type = models.CharField(max_length=30, choices=LocationType.choices, default=LocationType.CUSTOM)
    location = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    delivery_team = models.CharField(
        max_length=30,
        choices=DeliveryTeam.choices,
        default=DeliveryTeam.GENERAL,
        db_index=True,
    )
    available_days_mode = models.CharField(
        max_length=30,
        choices=AvailabilityMode.choices,
        default=AvailabilityMode.BUSINESS_HOURS,
    )
    available_time_mode = models.CharField(
        max_length=30,
        choices=AvailabilityMode.choices,
        default=AvailabilityMode.BUSINESS_HOURS,
    )
    business_hours = models.ForeignKey(
        "services.BusinessHours",
        on_delete=models.SET_NULL,
        related_name="services",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_services_catalog_entries",
        null=True,
        blank=True,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="updated_services_catalog_entries",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service_code"]),
            models.Index(fields=["service_name"]),
            models.Index(fields=["status"]),
            models.Index(fields=["delivery_team"]),
            models.Index(fields=["business_hours"]),
            models.Index(fields=["is_active"]),
        ]

    def save(self, *args, **kwargs):
        using = kwargs.get("using")
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating and not self.service_code:
            self.service_code = f"SRV-{self.pk:06d}"
            super().save(using=using, update_fields=["service_code", "updated_at"])

    def __str__(self) -> str:
        return self.service_name


class ServiceMemberAssignment(BaseModel):
    service = models.ForeignKey("services.CRMService", on_delete=models.CASCADE, related_name="member_assignments")
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="service_assignments",
    )
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_primary", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["service", "member"],
                condition=models.Q(is_active=True),
                name="services_active_member_assignment_unique",
            )
        ]
        indexes = [models.Index(fields=["service", "member"])]

    def __str__(self) -> str:
        return f"{self.service_id}:{self.member_id}"


class ServiceAppointment(BaseModel):
    class AppointmentForType(models.TextChoices):
        CONTACT = "contact", "Contact"
        ACCOUNT = "account", "Account"
        LEAD = "lead", "Lead"
        DEAL = "deal", "Deal"
        CASE = "case", "Case"
        PRODUCT = "product", "Product"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        SCHEDULED = "scheduled", "Scheduled"
        CONFIRMED = "confirmed", "Confirmed"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CLOSED = "closed", "Closed"
        CANCELLED = "cancelled", "Cancelled"
        RESCHEDULED = "rescheduled", "Rescheduled"
        NO_SHOW = "no_show", "No Show"

    class CoverageType(models.TextChoices):
        NONE = "none", "None"
        WARRANTY = "warranty", "Warranty"
        AMC = "amc", "AMC"
        PAID = "paid", "Paid"

    class CoverageStatus(models.TextChoices):
        NOT_APPLICABLE = "not_applicable", "Not Applicable"
        ACTIVE = "active", "Active"
        EXPIRED = "expired", "Expired"
        PENDING = "pending", "Pending Verification"

    appointment_number = models.CharField(max_length=32, unique=True, blank=True, db_index=True)
    service = models.ForeignKey("services.CRMService", on_delete=models.CASCADE, related_name="appointments")
    appointment_for_type = models.CharField(
        max_length=20,
        choices=AppointmentForType.choices,
        default=AppointmentForType.OTHER,
    )
    appointment_for_id = models.PositiveBigIntegerField(blank=True, null=True, db_index=True)
    appointment_for_label = models.CharField(max_length=255, blank=True, null=True)
    appointment_date = models.DateField(db_index=True)
    appointment_start_time = models.TimeField()
    appointment_end_time = models.TimeField(blank=True, null=True)
    assigned_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="service_appointments",
        null=True,
        blank=True,
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.SET_NULL,
        related_name="service_appointments",
        null=True,
        blank=True,
    )
    sales_order = models.ForeignKey(
        "inventory.SalesOrder",
        on_delete=models.SET_NULL,
        related_name="service_appointments",
        null=True,
        blank=True,
    )
    invoice = models.ForeignKey(
        "inventory.Invoice",
        on_delete=models.SET_NULL,
        related_name="service_appointments",
        null=True,
        blank=True,
    )
    customer_asset_name = models.CharField(max_length=255, blank=True, null=True)
    product_serial_number = models.CharField(max_length=120, blank=True, null=True, db_index=True)
    coverage_type = models.CharField(
        max_length=20,
        choices=CoverageType.choices,
        default=CoverageType.NONE,
        db_index=True,
    )
    coverage_status = models.CharField(
        max_length=20,
        choices=CoverageStatus.choices,
        default=CoverageStatus.NOT_APPLICABLE,
        db_index=True,
    )
    location = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED, db_index=True)
    notes = models.TextField(blank=True, null=True)
    completion_notes = models.TextField(blank=True, null=True)
    completion_proof_url = models.URLField(max_length=500, blank=True, null=True)
    completion_proof_file = models.FileField(upload_to="services/appointments/", blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_service_appointments",
        null=True,
        blank=True,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="updated_service_appointments",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["appointment_date", "appointment_start_time", "id"]
        indexes = [
            models.Index(fields=["appointment_number"]),
            models.Index(fields=["appointment_date"]),
            models.Index(fields=["status"]),
            models.Index(fields=["assigned_member"]),
            models.Index(fields=["product"]),
            models.Index(fields=["sales_order"]),
            models.Index(fields=["invoice"]),
            models.Index(fields=["coverage_type", "coverage_status"]),
            models.Index(fields=["appointment_for_type", "appointment_for_id"]),
            models.Index(fields=["is_active"]),
        ]

    def save(self, *args, **kwargs):
        using = kwargs.get("using")
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating and not self.appointment_number:
            self.appointment_number = f"APT-{self.pk:06d}"
            super().save(using=using, update_fields=["appointment_number", "updated_at"])

    def __str__(self) -> str:
        return self.appointment_number


class ServiceJobSheet(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        IN_PROGRESS = "in_progress", "In Progress"
        SUBMITTED = "submitted", "Submitted"
        COMPLETED = "completed", "Completed"

    appointment = models.ForeignKey(
        "services.ServiceAppointment",
        on_delete=models.SET_NULL,
        related_name="job_sheets",
        null=True,
        blank=True,
    )
    service = models.ForeignKey("services.CRMService", on_delete=models.CASCADE, related_name="job_sheets")
    customer_type = models.CharField(max_length=20, blank=True, null=True)
    customer_id = models.PositiveBigIntegerField(blank=True, null=True, db_index=True)
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_service_job_sheets",
        null=True,
        blank=True,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="updated_service_job_sheets",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service"]),
            models.Index(fields=["appointment"]),
            models.Index(fields=["status"]),
            models.Index(fields=["customer_type", "customer_id"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self) -> str:
        return self.title


class ServiceJobSheetField(BaseModel):
    job_sheet = models.ForeignKey("services.ServiceJobSheet", on_delete=models.CASCADE, related_name="fields")
    field_name = models.CharField(max_length=100)
    field_label = models.CharField(max_length=255)
    field_type = models.CharField(max_length=50, default="text")
    field_value = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["job_sheet", "field_name"])]

    def __str__(self) -> str:
        return self.field_label


class ServiceHoliday(BaseModel):
    name = models.CharField(max_length=255)
    date = models.DateField(db_index=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["date", "id"]
        indexes = [models.Index(fields=["date"]), models.Index(fields=["is_active"])]

    def clean(self):
        duplicate_exists = (
            ServiceHoliday.objects.filter(is_active=True, date=self.date)
            .exclude(pk=self.pk)
            .exists()
        )
        if duplicate_exists:
            raise ValidationError({"date": "A holiday already exists for this date."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.date})"


class ServiceDomainMapping(BaseModel):
    class AccountType(models.TextChoices):
        CRM = "crm", "CRM"
        SANDBOX = "sandbox", "Sandbox"
        PORTALS = "portals", "Portals"

    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        FAILED = "failed", "Failed"

    account_type = models.CharField(max_length=20, choices=AccountType.choices)
    domain = models.CharField(max_length=255, unique=True)
    cname_target = models.CharField(max_length=255, default="crm.cs.zohohost.in")
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["account_type"]),
            models.Index(fields=["verification_status"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self) -> str:
        return self.domain


class ServiceFiscalYearSetting(BaseModel):
    class FiscalYearType(models.TextChoices):
        STANDARD = "standard", "Standard Fiscal Year"
        CUSTOM = "custom", "Custom Fiscal Year"

    fiscal_year_type = models.CharField(
        max_length=20,
        choices=FiscalYearType.choices,
        default=FiscalYearType.STANDARD,
    )
    starts_in_month = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["id"]

    def clean(self):
        if not 1 <= self.starts_in_month <= 12:
            raise ValidationError({"starts_in_month": "Fiscal year month must be between 1 and 12."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.get_fiscal_year_type_display()} ({self.starts_in_month})"


class ServiceCompanyDetails(BaseModel):
    company_name = models.CharField(max_length=255, blank=True, null=True)
    company_email = models.EmailField(blank=True, null=True)
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    address = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.company_name or "Company Details"


class ServiceHierarchyPreference(BaseModel):
    preference = models.CharField(max_length=100, default="role_based")
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.preference
