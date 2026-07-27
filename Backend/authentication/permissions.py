"""
authentication/permissions.py
Custom DRF permission classes for role-based access.
"""
from rest_framework.permissions import BasePermission


class IsOrgAdmin(BasePermission):
    """Allow access only to users with role = 'admin'."""
    message = "Only admins can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "admin"
        )


class IsAdminOrManager(BasePermission):
    """Allow access to admin or manager roles."""
    message = "Only admins or managers can perform this action."

    def has_permission(self, request, view):
        role = getattr(request.user, "role", None)
        return bool(
            request.user
            and request.user.is_authenticated
            and role in ("admin", "manager")
        )
