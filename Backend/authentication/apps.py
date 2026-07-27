from django.apps import AppConfig
from django.contrib.auth import get_user_model
from django.db.models.signals import post_migrate


def create_default_admin_user(sender, **kwargs):
    User = get_user_model()
    admin_email = "vinishar2004@gmail.com"
    admin_password = "Vinisha2004"

    user, created = User.objects.get_or_create(
        email=admin_email,
        defaults={
            "name": "Main Admin",
            "role": "admin",
            "department": "",
            "is_admin": True,
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
            "must_change_password": False,
        },
    )

    if not created:
        updated = False
        if not user.check_password(admin_password):
            user.set_password(admin_password)
            updated = True

        if not user.is_admin:
            user.is_admin = True
            updated = True
        if not user.is_staff:
            user.is_staff = True
            updated = True
        if not user.is_superuser:
            user.is_superuser = True
            updated = True
        if user.role != "admin":
            user.role = "admin"
            updated = True
        if not user.is_active:
            user.is_active = True
            updated = True

        if updated:
            user.save()


class AuthenticationConfig(AppConfig):
    name = 'authentication'

    def ready(self):
        post_migrate.connect(create_default_admin_user, sender=self)
