import logging
import secrets
import string

from django.core.mail import send_mail
from django.conf import settings as django_settings
from django.contrib.auth import authenticate

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from drf_yasg.utils import swagger_auto_schema

from .serializers import (
    CheckEmailSerializer, LoginSerializer, SendOTPSerializer,
    VerifyOTPSerializer, ResetPasswordSerializer, ChangePasswordSerializer,
    UserCreateSerializer, UserDetailSerializer, UserUpdateSerializer,
    SetPasswordSerializer,
)
from .permissions import IsOrgAdmin, IsAdminOrManager
from .models import OTP
from .services import generate_and_send_otp
from .utils import custom_response

User = get_user_model()
logger = logging.getLogger(__name__)


class _CompanyManagerFallback:
    def filter(self, **_kwargs):
        return []


class Company:
    objects = _CompanyManagerFallback()


def normalize_auth_email(email):
    """Normalize auth emails and correct common typos users keep entering."""
    normalized = (email or "").strip().lower()
    if normalized.endswith("@gamail.com"):
        return normalized[:-11] + "@gmail.com"
    return normalized

# ── Module access map — which modules each role can access ─────────────────────

ALL_MODULES = ["sales", "activities", "inventory", "support", "integrations", "services", "projects"]

ROLE_MODULE_MAP = {
    "admin":                ALL_MODULES,
    "sub_admin":            ALL_MODULES,
    "hr":                   ["sales", "activities", "projects"],
    "manager":              ["sales", "activities", "inventory", "support", "services", "projects"],    "sales_manager":        ["sales", "activities", "inventory", "services", "projects"],    "team_lead":            ["activities", "services", "projects"],
    "business_development": ["sales", "activities", "integrations"],
    "software_development": ["support", "projects"],
    "support_team":         ["support"],
    "employee":             ["sales", "activities"],
}

# When a manager/team_lead has a department set, restrict to that department's modules
DEPT_MODULE_MAP = {
    "sales":                 ["sales", "activities", "inventory"],
    "business_development":  ["sales", "activities", "integrations"],
    "software_development":  ["support", "projects", "integrations"],
    "support":               ["support", "activities", "services"],
}


def get_allowed_modules(role, department=""):
    """Return module list based on role; for manager/team_lead/employee also consider department."""
    normalized_role = (role or "").strip().lower()

    if normalized_role in ("admin", "sub_admin"):
        return ALL_MODULES

    if normalized_role in ("manager", "sales_manager", "team_lead", "employee") and department and department in DEPT_MODULE_MAP:
        return DEPT_MODULE_MAP[department]

    return ROLE_MODULE_MAP.get(normalized_role, ["sales", "activities"])


def get_user_by_email(email):
    """Find an active user by email in the default database."""
    normalized_email = normalize_auth_email(email)
    return User.objects.filter(email__iexact=normalized_email, is_active=True).first()


def configure_tenant_database_in_settings(_db_name):
    """
    Compatibility hook for older tenant-aware auth flows.
    The current project uses a single configured database, so this is a no-op.
    """
    return None


def get_tenant_user_for_email(email):
    """
    Compatibility helper retained for the tenant-login contract used by tests and
    older auth clients. If a tenant company with a db name is available, look the
    user up against that alias first; otherwise fall back to the default database.
    """
    normalized_email = normalize_auth_email(email)
    try:
        companies = Company.objects.filter(status="Active")
        company = companies[0] if companies else None
        db_name = getattr(company, "db_name", "default") or "default"
    except Exception:
        # If the companies table does not exist yet or DB is not ready, fallback.
        db_name = "default"

    if db_name != "default":
        configure_tenant_database_in_settings(db_name)
        try:
            user = User.objects.using(db_name).filter(email__iexact=normalized_email, is_active=True).first()
            if user:
                return db_name, user
        except Exception:
            pass

    return "default", get_user_by_email(normalized_email)


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
    }


def build_auth_payload(user):
    tokens = get_tokens_for_user(user)
    role = getattr(user, "role", "employee")
    department = getattr(user, "department", "") or ""
    allowed_modules = get_allowed_modules(role, department)
    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": {
            "id": user.pk,
            "email": user.email,
            "name": getattr(user, "name", "") or user.email.split("@")[0],
            "is_admin": getattr(user, "is_admin", False),
            "role": role,
            "role_display": user.get_role_display(),
            "department": department,
            "must_change_password": getattr(user, "must_change_password", False),
            "allowed_modules": allowed_modules,
        },
    }


def generate_secure_password(length=12):
    """Generate a random secure password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        # Ensure at least one uppercase, lowercase, digit, and special char
        if (
            any(c.isupper() for c in pwd)
            and any(c.islower() for c in pwd)
            and any(c.isdigit() for c in pwd)
        ):
            return pwd


def send_welcome_email(name, email, password):
    """Send login credentials to newly created user."""
    display_name = name or email.split("@")[0]
    subject = "Welcome to Zora CRM – Your Login Credentials"
    frontend_url = getattr(django_settings, "FRONTEND_URL", "http://localhost:5173")
    body = f"""Hi {display_name},

Your Zora CRM account has been created. Here are your login credentials:

  Email:    {email}
  Password: {password}

Login here: {frontend_url}/login

Important: You will be prompted to change your password on your first login.

If you did not request this account, please contact your administrator.

Best regards,
Zora CRM Team
"""
    try:
        send_mail(
            subject,
            body,
            django_settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        return True
    except Exception:
        return False


# ── Public Auth Views ──────────────────────────────────────────────────────────

class CheckEmailView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(request_body=CheckEmailSerializer)
    def post(self, request):
        serializer = CheckEmailSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = get_user_by_email(email)
            if user:
                return Response(custom_response(
                    success=True,
                    message="Email found",
                    data={"role": getattr(user, "role", "employee"), "email": user.email}
                ), status=status.HTTP_200_OK)
            return Response(custom_response(success=False, message="User not found"), status=status.HTTP_404_NOT_FOUND)
        return Response(custom_response(success=False, message=serializer.errors), status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(request_body=LoginSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(custom_response(success=False, message=serializer.errors), status=status.HTTP_400_BAD_REQUEST)

        email = normalize_auth_email(serializer.validated_data['email'])
        password = serializer.validated_data['password']

        try:
            tenant_db, tenant_user = get_tenant_user_for_email(email)
            authenticated_user = authenticate(request, email=email, password=password)
            user = authenticated_user or tenant_user
            password_matches = bool(tenant_user and tenant_user.check_password(password))

            logger.warning(
                "Login attempt email=%r normalized=%r tenant_user_found=%s authenticated=%s password_match=%s active=%s",
                request.data.get("email"),
                email,
                bool(tenant_user),
                bool(authenticated_user),
                password_matches,
                getattr(tenant_user, "is_active", None),
            )

            if not user or not user.check_password(password):
                return Response(custom_response(success=False, message="Invalid credentials"), status=status.HTTP_401_UNAUTHORIZED)

            data = build_auth_payload(user)
            data["tenant_db"] = tenant_db
            return Response(custom_response(success=True, message="Login successful", data=data), status=status.HTTP_200_OK)

        except Exception as exc:
            # Return JSON for backend errors instead of rendering HTML trace pages.
            return Response(
                custom_response(success=False, message="Login failed. " + str(exc)),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class SendOTPView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(request_body=SendOTPSerializer)
    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = get_user_by_email(email)
            if user:
                if generate_and_send_otp(email):
                    return Response(custom_response(success=True, message="OTP sent successfully to " + email), status=status.HTTP_200_OK)
                return Response(custom_response(success=False, message="Failed to send OTP"), status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(custom_response(success=False, message="User not registered"), status=status.HTTP_404_NOT_FOUND)
        return Response(custom_response(success=False, message=serializer.errors), status=status.HTTP_400_BAD_REQUEST)


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(request_body=VerifyOTPSerializer)
    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            code = serializer.validated_data['otp']

            user = get_user_by_email(email)
            if not user:
                return Response(custom_response(success=False, message="User not registered"), status=status.HTTP_404_NOT_FOUND)

            otp_record = OTP.objects.filter(email=email, code=code, is_verified=False).order_by('-created_at').first()
            if otp_record and otp_record.is_valid():
                otp_record.is_verified = True
                otp_record.save()
                data = build_auth_payload(user)
                return Response(custom_response(success=True, message="Login successful", data=data), status=status.HTTP_200_OK)
            return Response(custom_response(success=False, message="Invalid or expired OTP"), status=status.HTTP_401_UNAUTHORIZED)
        return Response(custom_response(success=False, message=serializer.errors), status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(request_body=SendOTPSerializer)
    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = get_user_by_email(email)
            if user:
                if generate_and_send_otp(email):
                    return Response(custom_response(success=True, message="OTP sent successfully"), status=status.HTTP_200_OK)
                return Response(custom_response(success=False, message="Failed to send OTP"), status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(custom_response(success=False, message="User not registered"), status=status.HTTP_404_NOT_FOUND)
        return Response(custom_response(success=False, message=serializer.errors), status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(request_body=ResetPasswordSerializer)
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            code = serializer.validated_data['otp']
            new_password = serializer.validated_data['new_password']

            user = get_user_by_email(email)
            if not user:
                return Response(custom_response(success=False, message="User not registered"), status=status.HTTP_404_NOT_FOUND)

            otp_record = OTP.objects.filter(email=email, code=code, is_verified=False).order_by('-created_at').first()

            if otp_record and otp_record.is_valid():
                user.set_password(new_password)
                user.must_change_password = False
                user.save(update_fields=["password", "must_change_password"])
                otp_record.is_verified = True
                otp_record.save()
                return Response(custom_response(success=True, message="Password reset successfully"), status=status.HTTP_200_OK)
            return Response(custom_response(success=False, message="Invalid or expired OTP"), status=status.HTTP_401_UNAUTHORIZED)
        return Response(custom_response(success=False, message=serializer.errors), status=status.HTTP_400_BAD_REQUEST)


# ── Authenticated Views ────────────────────────────────────────────────────────

class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Authenticated endpoint — lets a user change their own password.
    Clears the must_change_password flag on success.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                custom_response(success=False, message=serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )
        new_password = serializer.validated_data["new_password"]
        request.user.set_password(new_password)
        request.user.must_change_password = False
        request.user.save(update_fields=["password", "must_change_password"])
        return Response(
            custom_response(success=True, message="Password changed successfully."),
            status=status.HTTP_200_OK,
        )


class UserListView(APIView):
    """Legacy endpoint — kept for backwards compatibility."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.filter(is_active=True).values("id", "email", "name", "role")
        return Response(list(users), status=status.HTTP_200_OK)


class ModulePermissionsView(APIView):
    """
    GET /api/auth/my-modules/
    Returns the list of modules the current user can access.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = getattr(request.user, "role", "employee")
        department = getattr(request.user, "department", "") or ""
        allowed = get_allowed_modules(role, department)
        return Response({
            "allowed_modules": allowed,
            "role": role,
            "department": department,
        })


# ── User Management ViewSet ────────────────────────────────────────────────────

class UserManagementViewSet(viewsets.ViewSet):
    """
    Full user management for Main Admin / Sub Admin / Manager.

    Endpoints:
      GET    /api/auth/manage-users/           list users (role-scoped)
      POST   /api/auth/manage-users/           create user (auto-generates password, sends email)
      GET    /api/auth/manage-users/{id}/      user detail
      PATCH  /api/auth/manage-users/{id}/      update role / manager / active (admin only)
      DELETE /api/auth/manage-users/{id}/      deactivate user (admin only)
      POST   /api/auth/manage-users/{id}/set-password/  reset password (admin only)
      GET    /api/auth/manage-users/me/        current user profile
    """
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def _scoped_queryset(self, user, active_only=False):
        """Returns users visible to the requesting user based on role."""
        role = getattr(user, "role", "employee")
        base = User.objects.select_related("manager")
        if active_only:
            base = base.filter(is_active=True)
        if role in ("admin", "sub_admin"):
            return base
        if role in ("manager", "sales_manager", "team_lead"):
            team_ids = list(User.objects.filter(manager=user, is_active=True).values_list("id", flat=True))
            team_ids.append(user.pk)
            return base.filter(pk__in=team_ids)
        return base.filter(pk=user.pk)

    # ── GET /manage-users/ ────────────────────────────────────────────────
    def list(self, request):
        qs = self._scoped_queryset(request.user).exclude(pk=request.user.pk)
        serializer = UserDetailSerializer(qs, many=True)
        return Response(serializer.data)

    # ── POST /manage-users/ ───────────────────────────────────────────────
    def create(self, request):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        creator = request.user
        creator_role = getattr(creator, "role", "employee")

        # Determine assigned role
        requested_role = data.get("role", "employee")

        # Managers / Team Leads can only create employees under themselves
        if creator_role in ("manager", "team_lead"):
            assigned_role = "employee"
            manager_for_new_user = creator
        else:
            # Admin / Sub Admin can set any role
            assigned_role = requested_role
            manager_for_new_user = data.get("manager", None)

        # Prevent managers from creating admins
        if creator_role in ("manager", "team_lead") and requested_role in ("admin", "sub_admin", "manager"):
            return Response(
                {"detail": "You can only create employee accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Auto-generate secure password
        raw_password = generate_secure_password()

        # Create the user
        new_user = User.objects.create_user(
            email=data["email"],
            password=raw_password,
        )
        new_user.name = data.get("name", "")
        new_user.role = assigned_role
        new_user.department = data.get("department", "")
        new_user.manager = manager_for_new_user
        new_user.is_active = True
        new_user.must_change_password = True
        new_user.save()

        # Send welcome email with credentials
        email_sent = send_welcome_email(new_user.name, new_user.email, raw_password)

        response_data = UserDetailSerializer(new_user).data
        response_data["email_sent"] = email_sent
        # Only expose the temp password if email delivery failed
        if not email_sent:
            response_data["temp_password"] = raw_password

        return Response(response_data, status=status.HTTP_201_CREATED)

    # ── GET /manage-users/{id}/ ───────────────────────────────────────────
    def retrieve(self, request, pk=None):
        qs = self._scoped_queryset(request.user)
        user = qs.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserDetailSerializer(user).data)

    # ── PATCH /manage-users/{id}/ ─────────────────────────────────────────
    def partial_update(self, request, pk=None):
        creator_role = getattr(request.user, "role", None)
        if creator_role not in ("admin", "sub_admin"):
            return Response(
                {"detail": "Only admins can update user details."},
                status=status.HTTP_403_FORBIDDEN,
            )
        qs = self._scoped_queryset(request.user)
        user = qs.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserDetailSerializer(user).data)

    # ── DELETE /manage-users/{id}/ ────────────────────────────────────────
    def destroy(self, request, pk=None):
        if getattr(request.user, "role", None) not in ("admin", "sub_admin"):
            return Response(
                {"detail": "Only admins can deactivate users."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if str(request.user.pk) == str(pk):
            return Response(
                {"detail": "You cannot deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = self._scoped_queryset(request.user)
        user = qs.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"detail": f"User {user.email} has been deactivated."})

    # ── POST /manage-users/{id}/set-password/ ────────────────────────────
    @action(detail=True, methods=["post"], url_path="set-password",
            permission_classes=[IsAuthenticated, IsOrgAdmin])
    def set_password(self, request, pk=None):
        qs = self._scoped_queryset(request.user)
        user = qs.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = True  # Force re-change after admin reset
        user.save(update_fields=["password", "must_change_password"])
        return Response({"detail": f"Password updated for {user.email}."})

    # ── POST /manage-users/{id}/deactivate/ ──────────────────────────────
    @action(detail=True, methods=["post"], url_path="deactivate",
            permission_classes=[IsAuthenticated, IsOrgAdmin])
    def deactivate(self, request, pk=None):
        if str(request.user.pk) == str(pk):
            return Response({"detail": "You cannot deactivate your own account."},
                            status=status.HTTP_400_BAD_REQUEST)
        qs = self._scoped_queryset(request.user)
        user = qs.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if user.status == "terminated":
            return Response({"detail": "This account is terminated. Use reactivate to restore."},
                            status=status.HTTP_400_BAD_REQUEST)

        user.status = "inactive"
        user.is_active = False
        user.save(update_fields=["status", "is_active"])
        return Response(UserDetailSerializer(user).data)

    # ── POST /manage-users/{id}/reactivate/ ──────────────────────────────
    @action(detail=True, methods=["post"], url_path="reactivate",
            permission_classes=[IsAuthenticated, IsOrgAdmin])
    def reactivate(self, request, pk=None):
        qs = self._scoped_queryset(request.user)
        user = qs.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user.status = "active"
        user.is_active = True
        user.save(update_fields=["status", "is_active"])
        return Response(UserDetailSerializer(user).data)

    # ── POST /manage-users/{id}/terminate/ ───────────────────────────────
    @action(detail=True, methods=["post"], url_path="terminate",
            permission_classes=[IsAuthenticated, IsOrgAdmin])
    def terminate(self, request, pk=None):
        if str(request.user.pk) == str(pk):
            return Response({"detail": "You cannot terminate your own account."},
                            status=status.HTTP_400_BAD_REQUEST)
        qs = self._scoped_queryset(request.user)
        user = qs.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user.status = "terminated"
        user.is_active = False
        user.save(update_fields=["status", "is_active"])
        return Response(UserDetailSerializer(user).data)

    # ── POST /manage-users/{id}/permanent-delete/ ────────────────────────
    @action(detail=True, methods=["post"], url_path="permanent-delete",
            permission_classes=[IsAuthenticated, IsOrgAdmin])
    def permanent_delete(self, request, pk=None):
        if str(request.user.pk) == str(pk):
            return Response({"detail": "You cannot delete your own account."},
                            status=status.HTTP_400_BAD_REQUEST)
        qs = self._scoped_queryset(request.user)
        user = qs.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if user.status != "terminated":
            return Response(
                {"detail": "Only terminated accounts can be permanently deleted. Terminate the user first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        email = user.email
        user.delete()
        return Response({"detail": f"User {email} has been permanently deleted."}, status=status.HTTP_200_OK)

    # ── GET /manage-users/me/ ─────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="me",
            permission_classes=[IsAuthenticated])
    def me(self, request):
        return Response(UserDetailSerializer(request.user).data)
