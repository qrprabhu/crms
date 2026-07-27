from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

# All available role choices (used in create/update forms)
ROLE_CHOICES = [
    ("admin", "Main Admin"),
    ("sub_admin", "Sub Admin"),
    ("hr", "HR"),
    ("manager", "Manager"),
    ("team_lead", "Team Lead"),
    ("business_development", "Business Development"),
    ("software_development", "Software Development"),
    ("support_team", "Support Team"),
    ("employee", "Employee"),
]

DEPARTMENT_CHOICES = [
    ("sales", "Sales"),
    ("business_development", "Business Development"),
    ("software_development", "Software Development"),
    ("support", "Support"),
]


# ── Auth flow serializers ──────────────────────────────────────────────────────

class CheckEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

class SendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)

class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True)

class ChangePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True, min_length=6)

    def validate(self, data):
        if data["new_password"] != data["confirm_password"]:
            raise serializers.ValidationError("Passwords do not match.")
        return data


# ── User management serializers ────────────────────────────────────────────────

class UserDetailSerializer(serializers.ModelSerializer):
    """Read-only serializer — used for list / retrieve."""
    manager_email = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    department_display = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "role",
            "role_display",
            "department",
            "department_display",
            "status",
            "status_display",
            "is_active",
            "must_change_password",
            "manager",
            "manager_email",
            "created_at",
        ]
        read_only_fields = fields

    def get_department_display(self, obj):
        return obj.get_department_display() if obj.department else ""

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_manager_email(self, obj):
        return obj.manager.email if obj.manager else None

    def get_role_display(self, obj):
        return obj.get_role_display()

class UserCreateSerializer(serializers.Serializer):
    """
    Used by Main Admin / Sub Admin to create a new CRM user.
    Password is auto-generated — not provided by the creator.
    """
    name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=ROLE_CHOICES, default="employee")
    department = serializers.ChoiceField(choices=DEPARTMENT_CHOICES, required=False, allow_blank=True, default="")
    manager = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        allow_null=True,
        required=False,
    )

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()


class UserUpdateSerializer(serializers.ModelSerializer):
    """Used by admin to update role, name, manager, active status, or department."""

    class Meta:
        model = User
        fields = ["name", "role", "department", "manager", "is_active"]

    def validate_manager(self, value):
        if value and value == self.instance:
            raise serializers.ValidationError("A user cannot be their own manager.")
        return value


class SetPasswordSerializer(serializers.Serializer):
    """Admin can reset another user's password."""
    new_password = serializers.CharField(write_only=True, min_length=6)
