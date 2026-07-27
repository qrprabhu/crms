from django.db.models import Q, QuerySet
from rest_framework.permissions import BasePermission


def _resolve_role(user) -> str:
    if getattr(user, "is_superuser", False) or getattr(user, "is_admin", False):
        return "admin"
    role = (getattr(user, "role", "") or "").strip().lower()
    if role in {"admin", "manager", "sales", "sales_rep", "sales rep"}:
        return role
    if getattr(user, "is_staff", False):
        return "manager"
    return "sales_rep"


def _team_member_ids(user) -> list[int]:
    model_fields = {field.name for field in user.__class__._meta.get_fields()}
    if "manager" in model_fields:
        return list(user.__class__.objects.filter(manager=user).values_list("id", flat=True))
    if "reports_to" in model_fields:
        return list(user.__class__.objects.filter(reports_to=user).values_list("id", flat=True))
    return []


def filter_queryset_for_user(queryset: QuerySet, user, owner_field: str = "owner") -> QuerySet:
    if not user.is_authenticated:
        return queryset.none()
    role = _resolve_role(user)
    if role == "admin":
        return queryset
    owner_lookup = owner_field
    owner_id_lookup = f"{owner_field}_id__in"
    if role == "manager":
        reportee_ids = _team_member_ids(user)
        if reportee_ids:
            return queryset.filter(Q(**{owner_lookup: user}) | Q(**{owner_id_lookup: reportee_ids}))
    return queryset.filter(**{owner_lookup: user})


def can_access_owner(*, user, owner_id: int | None) -> bool:
    role = _resolve_role(user)
    if role == "admin":
        return True
    if role == "manager":
        return owner_id == user.id or owner_id in _team_member_ids(user)
    return owner_id == user.id


class OwnerPermission(BasePermission):
    owner_id_attr = "owner_id"

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj) -> bool:
        return can_access_owner(user=request.user, owner_id=getattr(obj, self.owner_id_attr, None))


class VendorPermission(OwnerPermission):
    owner_id_attr = "vendor_owner_id"

