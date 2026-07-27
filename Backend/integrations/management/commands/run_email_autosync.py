from __future__ import annotations

import time

from django.core.management.base import BaseCommand

from integrations.services import (
    sync_all_active_tenant_email_providers,
    sync_current_tenant_email_providers,
)


class Command(BaseCommand):
    help = "Continuously syncs active email providers so CRM inbox updates without manual clicks."

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval",
            type=int,
            default=60,
            help="Seconds between auto-sync cycles. Default is 60.",
        )
        parser.add_argument(
            "--once",
            action="store_true",
            help="Run a single auto-sync cycle and exit.",
        )
        parser.add_argument(
            "--current-tenant-only",
            action="store_true",
            help="Sync only the currently selected tenant DB context instead of all active tenants.",
        )
        parser.add_argument(
            "--sync-type",
            default="incremental_sync",
            help="Sync type passed to provider sync logs. Default is incremental_sync.",
        )

    def handle(self, *args, **options):
        interval = max(15, options["interval"])
        sync_type = options["sync_type"]
        current_tenant_only = options["current_tenant_only"]

        self.stdout.write(
            self.style.SUCCESS(
                "Starting email autosync worker"
                + (" for current tenant only." if current_tenant_only else " for all active tenants.")
            )
        )

        while True:
            if current_tenant_only:
                synced = sync_current_tenant_email_providers(sync_type=sync_type)
                self.stdout.write(
                    f"Synced providers in current tenant: {', '.join(map(str, synced)) if synced else 'none'}"
                )
            else:
                synced_by_tenant = sync_all_active_tenant_email_providers(sync_type=sync_type)
                for tenant_db, provider_ids in synced_by_tenant.items():
                    self.stdout.write(
                        f"{tenant_db}: {', '.join(map(str, provider_ids)) if provider_ids else 'no sync-enabled providers'}"
                    )

            if options["once"]:
                break

            time.sleep(interval)
