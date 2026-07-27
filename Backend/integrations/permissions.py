from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_integration_admin(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "is_admin", False)
        or getattr(user, "is_staff", False)
    )


class IsIntegrationAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return is_integration_admin(user)

    def has_object_permission(self, request, view, obj) -> bool:
        return self.has_permission(request, view)


class IsOwnerOrIntegrationAdmin(BasePermission):
    owner_fields = ("user_id", "created_by_id")

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user
        if is_integration_admin(user):
            return True
        if request.method in SAFE_METHODS:
            for field in self.owner_fields:
                if getattr(obj, field, None) == user.id:
                    return True
            return False
        for field in self.owner_fields:
            if getattr(obj, field, None) == user.id:
                return True
        return False

