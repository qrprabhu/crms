from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import os


class Command(BaseCommand):
    help = 'Ensure default admin account exists using SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables.'

    def handle(self, *args, **options):
        User = get_user_model()
        email = os.getenv('SEED_ADMIN_EMAIL', '').strip().lower()
        password = os.getenv('SEED_ADMIN_PASSWORD', '').strip()
        name = os.getenv('SEED_ADMIN_NAME', 'Main Admin').strip() or 'Main Admin'

        if not email or not password:
            self.stdout.write(
                self.style.WARNING(
                    'Skipping default admin seed. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to enable it.'
                )
            )
            return

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'name': name,
                'role': 'admin',
                'department': '',
                'is_admin': True,
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
                'must_change_password': False,
            },
        )

        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created admin account {email}"))
            return

        changed = False
        if not user.check_password(password):
            user.set_password(password)
            changed = True

        if user.name != name:
            user.name = name
            changed = True

        if not user.is_admin:
            user.is_admin = True
            changed = True

        if not user.is_staff:
            user.is_staff = True
            changed = True

        if not user.is_superuser:
            user.is_superuser = True
            changed = True

        if user.role != 'admin':
            user.role = 'admin'
            changed = True

        if not user.is_active:
            user.is_active = True
            changed = True

        if changed:
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Updated admin account {email}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Admin account {email} already exists and is valid."))
