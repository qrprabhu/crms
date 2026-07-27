from authentication.views import get_allowed_modules


def get_assigned_report_keys(user) -> list[str]:
    return list(getattr(user, "assigned_report_keys", []) or [])


def can_access_report(user, report_config: dict) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False

    role = (getattr(user, "role", "") or "").strip().lower()
    if role in {"admin", "sub_admin"} or getattr(user, "is_superuser", False):
        return True

    allowed_modules = get_allowed_modules(role, getattr(user, "department", "") or "")
    if report_config["module"] not in allowed_modules:
        return False

    return report_config["key"] in get_assigned_report_keys(user)
