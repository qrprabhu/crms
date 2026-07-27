from __future__ import annotations

from dataclasses import dataclass

from django.core.management.base import BaseCommand

from integrations.models import SyncedEmailMessage
from integrations.services import classify_email_intent, is_notification_sender


@dataclass
class AuditBucket:
    label: str
    messages: list[SyncedEmailMessage]


def _has_any_link(message: SyncedEmailMessage) -> bool:
    return bool(
        message.lead_id
        or message.contact_id
        or message.account_id
        or message.deal_id
        or message.support_case_id
    )


def _row_summary(message: SyncedEmailMessage) -> str:
    body = (message.body_text or "").strip().replace("\n", " ")[:60]
    safe_subject = ((message.subject or "(No subject)")[:50]).encode("ascii", "ignore").decode()
    safe_body = body.encode("ascii", "ignore").decode()
    return (
        f"id={message.id} from={message.from_email} "
        f"subject={safe_subject!r} "
        f"intent={classify_email_intent(subject=message.subject, body_text=message.body_text, body_html=message.body_html)} "
        f"lead={message.lead_id} contact={message.contact_id} account={message.account_id} "
        f"deal={message.deal_id} case={message.support_case_id} body={safe_body!r}"
    )


class Command(BaseCommand):
    help = "Audit synced email links and report suspicious routing patterns."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=10,
            help="How many sample rows to print per category. Default is 10.",
        )

    def handle(self, *args, **options):
        limit = max(1, int(options["limit"]))
        queryset = (
            SyncedEmailMessage.objects
            .select_related("provider_integration", "lead", "contact", "account", "deal", "support_case")
            .order_by("-received_at", "-created_at")
        )
        messages = list(queryset)

        linked_notification = AuditBucket("Linked notification/junk senders", [])
        unlinked_customer_incoming = AuditBucket("Unlinked incoming customer emails", [])
        sales_support_overlap = AuditBucket("Sales-intent emails also linked to support cases", [])
        support_without_case = AuditBucket("Support-intent emails without support case", [])

        linked_count = 0
        for message in messages:
            has_link = _has_any_link(message)
            if has_link:
                linked_count += 1

            intent = classify_email_intent(
                subject=message.subject,
                body_text=message.body_text,
                body_html=message.body_html,
            )
            notification_sender = is_notification_sender(message.from_email)

            if notification_sender and has_link:
                linked_notification.messages.append(message)

            if (
                message.direction == SyncedEmailMessage.Direction.INCOMING
                and not notification_sender
                and not has_link
            ):
                unlinked_customer_incoming.messages.append(message)

            if intent == "sales" and message.support_case_id:
                sales_support_overlap.messages.append(message)

            if (
                intent == "support"
                and message.direction == SyncedEmailMessage.Direction.INCOMING
                and not notification_sender
                and not message.support_case_id
            ):
                support_without_case.messages.append(message)

        self.stdout.write(self.style.SUCCESS("Email audit for DB: default"))
        self.stdout.write(f"Total messages: {len(messages)}")
        self.stdout.write(f"Linked messages: {linked_count}")
        self.stdout.write(f"Linked notification/junk senders: {len(linked_notification.messages)}")
        self.stdout.write(f"Unlinked incoming customer emails: {len(unlinked_customer_incoming.messages)}")
        self.stdout.write(f"Sales-intent emails also linked to support cases: {len(sales_support_overlap.messages)}")
        self.stdout.write(f"Support-intent emails without support case: {len(support_without_case.messages)}")

        for bucket in (
            linked_notification,
            unlinked_customer_incoming,
            sales_support_overlap,
            support_without_case,
        ):
            self.stdout.write("")
            self.stdout.write(self.style.WARNING(f"{bucket.label}:"))
            if not bucket.messages:
                self.stdout.write("  none")
                continue
            for message in bucket.messages[:limit]:
                self.stdout.write(f"  - {_row_summary(message)}")
