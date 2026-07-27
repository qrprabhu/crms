from django.db.models import Q, QuerySet
from rest_framework.permissions import BasePermission


def _resolve_role(user) -> str:
    if getattr(user, "is_superuser", False) or getattr(user, "is_admin", False):
        return "admin"

    role = (getattr(user, "role", "") or "").strip().lower()
    if role in {"admin", "manager", "sales_manager", "sales", "sales_rep", "sales rep"}:
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


def filter_queryset_for_user(queryset: QuerySet, user) -> QuerySet:
    if not user.is_authenticated:
        return queryset.none()

    role = _resolve_role(user)
    if role in {"admin", "sales_manager"}:
        return queryset
    if role == "manager":
        team_ids = _team_member_ids(user)
        scoped = Q(account_owner=user)
        if team_ids:
          scoped |= Q(account_owner_id__in=team_ids)
        scoped |= Q(account_owner__isnull=True)
        return queryset.filter(scoped)
    return queryset.filter(Q(account_owner=user) | Q(account_owner__isnull=True))


def can_access_account_owner(*, user, owner_id: int | None) -> bool:
    role = _resolve_role(user)
    if role == "admin":
        return True
    if role == "manager":
        return owner_id == user.id or owner_id in _team_member_ids(user)
    return owner_id == user.id


class AccountPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj) -> bool:
        return can_access_account_owner(user=request.user, owner_id=obj.account_owner_id)

