from django.db.models import Q, QuerySet


def _resolve_role(user) -> str:
    if getattr(user, "is_superuser", False) or getattr(user, "is_admin", False):
        return "admin"

    role = (getattr(user, "role", "") or "").strip().lower()
    if role in {"admin", "sub_admin", "manager", "team_lead", "employee", "sales_manager"}:
        return role

    if getattr(user, "is_staff", False):
        return "manager"
    return "employee"


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
    if role in {"admin", "sub_admin", "sales_manager"}:
        return queryset
    if role in {"manager", "team_lead"}:
        reportee_ids = _team_member_ids(user)
        scoped = Q(owner=user)
        if reportee_ids:
            scoped |= Q(owner_id__in=reportee_ids)
        scoped |= Q(owner__isnull=True)
        return queryset.filter(scoped)
    return queryset.filter(owner=user)


def can_access_lead_owner(*, user, owner_id: int | None) -> bool:
    role = _resolve_role(user)
    if role in {"admin", "sub_admin", "sales_manager"}:
        return True
    if role in {"manager", "team_lead"}:
        return owner_id is None or owner_id == user.id or owner_id in _team_member_ids(user)
    return owner_id == user.id
