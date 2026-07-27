from django.core.management.base import BaseCommand

from integrations.services import reconcile_synced_email_links


class Command(BaseCommand):
    help = "Re-evaluate saved synced email links using the current matching rules."

    def handle(self, *args, **options):
        result = reconcile_synced_email_links()
        self.stdout.write(
            self.style.SUCCESS(
                f"Reconciled email links. Updated={result['updated']} Cleared={result['cleared']}"
            )
        )
