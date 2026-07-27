from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_admin', True)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'admin')

        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):

    class Role(models.TextChoices):
        ADMIN = "admin", "Main Admin"
        SUB_ADMIN = "sub_admin", "Sub Admin"
        HR = "hr", "HR"
        MANAGER = "manager", "Manager"
        TEAM_LEAD = "team_lead", "Team Lead"
        BUSINESS_DEVELOPMENT = "business_development", "Business Development"
        SOFTWARE_DEVELOPMENT = "software_development", "Software Development"
        SUPPORT_TEAM = "support_team", "Support Team"
        SALES_MANAGER = "sales_manager", "Sales Manager"
        EMPLOYEE = "employee", "Employee"

    class Department(models.TextChoices):
        SALES = "sales", "Sales"
        BUSINESS_DEVELOPMENT = "business_development", "Business Development"
        SOFTWARE_DEVELOPMENT = "software_development", "Software Development"
        SUPPORT = "support", "Support"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        TERMINATED = "terminated", "Terminated"

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150, blank=True, default="")
    organization_name = models.CharField(max_length=255, blank=True, default="")
    is_admin = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    must_change_password = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.EMPLOYEE,
    )
    department = models.CharField(
        max_length=30,
        choices=Department.choices,
        blank=True,
        default="",
    )
    manager = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="team_members",
    )

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.name or self.email


class OTP(models.Model):
    email = models.EmailField()
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_verified = models.BooleanField(default=False)

    def is_valid(self):
        # OTP is valid for 5 minutes
        expiration_time = self.created_at + timezone.timedelta(minutes=5)
        return timezone.now() <= expiration_time and not self.is_verified

    def __str__(self):
        return f"{self.email} - {self.code}"
