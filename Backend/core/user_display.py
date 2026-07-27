from __future__ import annotations


def get_user_display_name(user) -> str:
    if not user:
        return ""

    for attr in ("name", "full_name"):
        value = getattr(user, attr, None)
        if isinstance(value, str) and value.strip():
            return value.strip()

    first_name = getattr(user, "first_name", "") or ""
    last_name = getattr(user, "last_name", "") or ""
    full_name = f"{first_name} {last_name}".strip()
    if full_name:
        return full_name

    email = getattr(user, "email", None)
    if isinstance(email, str) and email.strip():
        return email.strip()

    username = getattr(user, "username", None)
    if isinstance(username, str) and username.strip():
        return username.strip()

    return str(user)
