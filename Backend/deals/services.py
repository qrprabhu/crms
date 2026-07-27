from __future__ import annotations

import csv
from decimal import Decimal
from dataclasses import dataclass
from io import StringIO
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import QuerySet, Sum

from activities.services import create_deal_activity
from accounts.models import Account
from contacts.models import Contact
from inventory.models import InventoryLinkedRecord
from notes.services import create_deal_note, list_deal_notes

from .models import Deal, DealProduct, DealStage
from .permissions import filter_queryset_for_user

User = get_user_model()

DEFAULT_PIPELINE_STAGES = [
    ("Qualification", 10, 1, False),
    ("Needs Analysis", 20, 2, False),
    ("Value Proposition", 40, 3, False),
    ("Identify Decision Makers", 55, 4, False),
    ("Proposal/Price Quote", 75, 5, False),
    ("Negotiation/Review", 90, 6, False),
    ("Closed Won", 100, 7, True),
    ("Closed Lost", 0, 8, True),
    ("Closed Lost to Competition", 0, 9, True),
]


def ensure_default_stages() -> None:
    for stage_name, probability, order, is_closed_stage in DEFAULT_PIPELINE_STAGES:
        DealStage.objects.get_or_create(
            stage_name=stage_name,
            defaults={
                "probability": probability,
                "order": order,
                "is_closed_stage": is_closed_stage,
            },
        )


class TimelineService:
    @staticmethod
    def log_event(*, deal: Deal, action: str, description: str = "", user=None):
        return create_deal_activity(
            deal=deal,
            action=action,
            description=description,
            user=user,
        )

    @staticmethod
    def list_events(*, deal: Deal):
        return deal.activities.select_related("user").all()


class NotesService:
    @staticmethod
    def create_note(*, deal: Deal, note: str, user=None):
        return create_deal_note(deal=deal, note=note, created_by=user)

    @staticmethod
    def list_notes(*, deal: Deal):
        return list_deal_notes(deal=deal)


class ActivityService:
    @staticmethod
    def log_activity(*, deal: Deal, action: str, description: str = "", user=None):
        return create_deal_activity(
            deal=deal,
            action=action,
            description=description,
            user=user,
        )


@dataclass
class DealService:
    timeline_service: TimelineService = TimelineService()
    notes_service: NotesService = NotesService()
    activity_service: ActivityService = ActivityService()

    def list_deals(self, *, user) -> QuerySet[Deal]:
        ensure_default_stages()
        queryset = (
            Deal.objects.filter(is_active=True)
            .select_related("account", "contact", "deal_owner", "stage")
        )
        return filter_queryset_for_user(queryset, user)

    def get_deal_detail(self, *, deal_id: int, user) -> Deal:
        return self.list_deals(user=user).get(pk=deal_id)

    def list_deal_products(self, *, deal: Deal):
        return deal.products.filter(is_active=True).select_related("product")

    @transaction.atomic
    def add_deal_product(self, *, deal: Deal, data: dict[str, Any], user) -> DealProduct:
        quantity = Decimal(data["quantity"])
        unit_price = Decimal(data["unit_price"])
        discount = Decimal(data.get("discount") or 0)
        total_price = (quantity * unit_price) - discount

        line_item = DealProduct.objects.create(
            deal=deal,
            product=data["product"],
            quantity=quantity,
            unit_price=unit_price,
            discount=discount,
            total_price=total_price,
        )
        self._sync_deal_totals(deal=deal)
        self._sync_product_link(line_item=line_item)
        self.log_activity(
            deal=deal,
            action="Product added",
            description=f"{line_item.product.product_name} added to deal",
            user=user,
        )
        return line_item

    @transaction.atomic
    def create_deal(self, *, data: dict[str, Any], user) -> Deal:
        ensure_default_stages()
        contact = data.get("contact")
        account = data.get("account")
        if contact and account and contact.account_id and contact.account_id != account.id:
            raise ValueError("contact: Selected contact must belong to the selected account.")
        if not data.get("deal_owner"):
            data["deal_owner"] = (
                getattr(contact, "contact_owner", None)
                or getattr(account, "account_owner", None)
                or user
            )
        stage = data.get("stage")
        if not stage:
            stage = DealStage.objects.get(stage_name="Qualification")
            data["stage"] = stage

        if data.get("probability") is None:
            data["probability"] = stage.probability

        deal = Deal.objects.create(
            is_closed=stage.is_closed_stage,
            is_won=stage.stage_name == "Closed Won",
            **data,
        )
        self.log_activity(
            deal=deal,
            action="Deal created",
            description="Deal created",
            user=user,
        )
        return deal

    @transaction.atomic
    def update_deal(self, *, deal: Deal, data: dict[str, Any], user) -> Deal:
        old_amount = deal.amount
        old_closing_date = deal.closing_date
        old_stage_name = deal.stage.stage_name
        stage_explicitly_changed = "stage" in data
        next_account = data.get("account", deal.account)
        next_contact = data.get("contact", deal.contact)

        if next_contact and next_account and next_contact.account_id and next_contact.account_id != next_account.id:
            raise ValueError("contact: Selected contact must belong to the selected account.")

        for field, value in data.items():
            setattr(deal, field, value)

        stage = deal.stage
        if stage_explicitly_changed and "probability" not in data:
            deal.probability = stage.probability
        elif deal.probability is None:
            deal.probability = stage.probability
        deal.is_closed = stage.is_closed_stage
        deal.is_won = stage.stage_name == "Closed Won"
        deal.save()

        self.log_activity(deal=deal, action="Deal updated", description="Deal updated", user=user)
        if old_stage_name != deal.stage.stage_name:
            self.log_activity(
                deal=deal,
                action="Stage changed",
                description=f"Deal moved from {old_stage_name} -> {deal.stage.stage_name}",
                user=user,
            )
        if old_amount != deal.amount:
            self.log_activity(deal=deal, action="Amount updated", description="Amount updated", user=user)
        if old_closing_date != deal.closing_date:
            self.log_activity(
                deal=deal,
                action="Closing date updated",
                description="Closing date updated",
                user=user,
            )
        return deal

    @transaction.atomic
    def change_stage(self, *, deal: Deal, stage: DealStage, user) -> Deal:
        old_stage_name = deal.stage.stage_name
        deal.stage = stage
        deal.probability = stage.probability
        deal.is_closed = stage.is_closed_stage
        deal.is_won = stage.stage_name == "Closed Won"
        deal.save(update_fields=["stage", "probability", "is_closed", "is_won", "updated_at"])

        self.log_activity(
            deal=deal,
            action="Stage changed",
            description=f"Deal moved from {old_stage_name} -> {stage.stage_name}",
            user=user,
        )
        if deal.is_won:
            self.log_activity(deal=deal, action="Deal won", description="Deal won", user=user)
        elif deal.is_closed:
            self.log_activity(deal=deal, action="Deal lost", description="Deal lost", user=user)
        return deal

    @transaction.atomic
    def delete_deal(self, *, deal: Deal, user) -> Deal:
        deal.is_active = False
        deal.save(update_fields=["is_active", "updated_at"])
        self.log_activity(deal=deal, action="Deal deleted", description="Deal deleted", user=user)
        return deal

    def get_pipeline(self, *, user) -> dict[str, list[dict[str, Any]]]:
        ensure_default_stages()
        deals = self.list_deals(user=user)
        pipeline: dict[str, list[dict[str, Any]]] = {
            stage.stage_name: [] for stage in DealStage.objects.order_by("order", "id")
        }
        for deal in deals:
            stage_name = deal.stage.stage_name
            pipeline.setdefault(stage_name, []).append(
                {
                    "deal_id": deal.id,
                    "deal_name": deal.deal_name,
                    "account_name": deal.account.account_name if deal.account else None,
                    "contact_name": (
                        f"{deal.contact.first_name} {deal.contact.last_name}".strip()
                        if deal.contact
                        else None
                    ),
                    "owner": deal.deal_owner.email if deal.deal_owner else None,
                    "amount": deal.amount,
                    "closing_date": deal.closing_date,
                    "stage": stage_name,
                    "probability": deal.probability,
                }
            )
        return pipeline

    @transaction.atomic
    def mass_delete(self, *, ids: list[int], user) -> int:
        queryset = self.list_deals(user=user).filter(pk__in=ids)
        count = 0
        for deal in queryset:
            self.delete_deal(deal=deal, user=user)
            count += 1
        return count

    @transaction.atomic
    def mass_update(self, *, ids: list[int], payload: dict[str, Any], user) -> int:
        allowed_fields = {
            "deal_owner",
            "account",
            "contact",
            "amount",
            "expected_revenue",
            "stage",
            "probability",
            "closing_date",
            "type",
            "lead_source",
            "campaign_source",
            "next_step",
            "forecast_category",
            "description",
        }
        safe_payload = {k: v for k, v in payload.items() if k in allowed_fields}
        safe_payload = self._normalize_mass_payload(safe_payload)
        queryset = self.list_deals(user=user).filter(pk__in=ids)
        count = 0
        for deal in queryset:
            self.update_deal(deal=deal, data=safe_payload, user=user)
            count += 1
        return count

    def _normalize_mass_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(payload)
        if "stage" in normalized and not isinstance(normalized["stage"], DealStage):
            stage_value = normalized["stage"]
            if isinstance(stage_value, int):
                normalized["stage"] = DealStage.objects.get(pk=stage_value)
            else:
                normalized["stage"] = DealStage.objects.get(stage_name=str(stage_value))
        if "deal_owner" in normalized and isinstance(normalized["deal_owner"], int):
            normalized["deal_owner"] = User.objects.get(pk=normalized["deal_owner"])
        if "account" in normalized and isinstance(normalized["account"], int):
            normalized["account"] = Account.objects.get(pk=normalized["account"])
        if "contact" in normalized and isinstance(normalized["contact"], int):
            normalized["contact"] = Contact.objects.get(pk=normalized["contact"])
        return normalized

    def export_deals(self, *, user) -> str:
        deals = self.list_deals(user=user)
        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "Deal ID",
                "Deal Name",
                "Account Name",
                "Contact Name",
                "Owner",
                "Amount",
                "Expected Revenue",
                "Stage",
                "Probability",
                "Closing Date",
                "Type",
                "Campaign Source",
                "Created At",
            ]
        )
        for deal in deals:
            writer.writerow(
                [
                    deal.id,
                    deal.deal_name,
                    deal.account.account_name if deal.account else "",
                    f"{deal.contact.first_name} {deal.contact.last_name}".strip()
                    if deal.contact
                    else "",
                    deal.deal_owner.email if deal.deal_owner else "",
                    deal.amount or "",
                    deal.expected_revenue or "",
                    deal.stage.stage_name,
                    deal.probability if deal.probability is not None else "",
                    deal.closing_date or "",
                    deal.type or "",
                    deal.campaign_source or "",
                    deal.created_at.isoformat(),
                ]
            )
        return buffer.getvalue()

    def log_activity(self, *, deal: Deal, action: str, description: str = "", user=None):
        return self.activity_service.log_activity(
            deal=deal,
            action=action,
            description=description,
            user=user,
        )

    def _sync_deal_totals(self, *, deal: Deal) -> Deal:
        active_items = deal.products.filter(is_active=True)
        total_amount = active_items.aggregate(total=Sum("total_price"))["total"] or Decimal("0.00")
        deal.amount = total_amount
        if deal.expected_revenue in (None, Decimal("0.00")) or deal.expected_revenue != total_amount:
            deal.expected_revenue = total_amount
        deal.save(update_fields=["amount", "expected_revenue", "updated_at"])
        return deal

    def _sync_product_link(self, *, line_item: DealProduct) -> InventoryLinkedRecord:
        return InventoryLinkedRecord.objects.create(
            product=line_item.product,
            deal=line_item.deal,
            account=line_item.deal.account,
            contact=line_item.deal.contact,
            relationship_label="Deal Line Item",
            metadata={
                "deal_product_id": line_item.id,
                "quantity": str(line_item.quantity),
                "unit_price": str(line_item.unit_price),
                "discount": str(line_item.discount),
                "total_price": str(line_item.total_price),
            },
        )


deal_service = DealService()


def create_deal_from_lead(*, lead, account, contact, owner=None, deal_name=None, deal_value=None):
    ensure_default_stages()
    qualification = DealStage.objects.get(stage_name="Qualification")
    default_deal_name = f"{lead.company} - {lead.first_name} {lead.last_name} Deal".strip()
    deal = Deal.objects.create(
        account=account,
        contact=contact,
        lead=lead,
        deal_name=deal_name or default_deal_name,
        stage=qualification,
        amount=deal_value,
        expected_revenue=deal_value,
        probability=qualification.probability,
        is_closed=qualification.is_closed_stage,
        is_won=False,
        deal_owner=lead.owner or owner,
    )
    create_deal_activity(
        deal=deal,
        action="Deal created",
        description="Deal created from lead conversion",
        user=lead.owner or owner,
    )
    return deal
