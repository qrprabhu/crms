from __future__ import annotations

import csv
from dataclasses import dataclass
from decimal import Decimal
from io import BytesIO, StringIO

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook

from accounts.models import Account
from activities.models import Task
from contacts.models import Contact
from deals.models import Deal
from inventory.models import Invoice
from leads.models import Lead
from project.models import Project
from services.models import CRMService
from .catalog import REPORT_CATALOG, REPORT_CATALOG_BY_KEY


@dataclass
class ReportContext:
    user: object
    report_key: str
    date_from: object | None
    date_to: object | None
    search: str
    page: int
    page_size: int


def _resolve_role(user) -> str:
    if getattr(user, "is_superuser", False) or getattr(user, "is_admin", False):
        return "admin"
    return (getattr(user, "role", "") or "employee").strip().lower()


def _team_member_ids(user) -> list[int]:
    model_fields = {field.name for field in user.__class__._meta.get_fields()}
    if "manager" in model_fields:
        return list(user.__class__.objects.filter(manager=user).values_list("id", flat=True))
    return []


def _scope_queryset_for_user(queryset, user, owner_field: str):
    if not getattr(user, "is_authenticated", False):
        return queryset.none()

    role = _resolve_role(user)
    if role in {"admin", "sub_admin", "sales_manager"}:
        return queryset
    if role in {"manager", "team_lead"}:
        owner_ids = [user.id, *_team_member_ids(user)]
        return queryset.filter(Q(**{f"{owner_field}__in": owner_ids}) | Q(**{f"{owner_field}__isnull": True}))
    return queryset.filter(**{owner_field: user})


def _apply_date_range(queryset, field_name: str, date_from, date_to):
    if date_from:
        queryset = queryset.filter(**{f"{field_name}__date__gte": date_from})
    if date_to:
        queryset = queryset.filter(**{f"{field_name}__date__lte": date_to})
    return queryset


def _serialize_date(value, include_time: bool = False) -> str:
    if not value:
        return "-"
    if include_time:
        if timezone.is_aware(value):
            value = timezone.localtime(value)
        return value.strftime("%d/%m/%Y %H:%M")
    return value.strftime("%d/%m/%Y")


def _format_currency(value) -> str:
    amount = Decimal(value or 0)
    return f"{amount:,.2f}"


def _percent(numerator: int, denominator: int) -> str:
    if denominator <= 0:
        return "0%"
    return f"{round((numerator / denominator) * 100)}%"


def _paginate_rows(rows: list[dict], page: int, page_size: int):
    total = len(rows)
    if total == 0:
        return [], {"page": 1, "page_size": page_size, "total_records": 0, "total_pages": 1}
    total_pages = max((total + page_size - 1) // page_size, 1)
    safe_page = min(max(page, 1), total_pages)
    start = (safe_page - 1) * page_size
    end = start + page_size
    return rows[start:end], {
        "page": safe_page,
        "page_size": page_size,
        "total_records": total,
        "total_pages": total_pages,
    }


def _date_range_label(date_from, date_to) -> str:
    if date_from and date_to:
        return f"{date_from.strftime('%d/%m/%Y')} to {date_to.strftime('%d/%m/%Y')}"
    if date_from:
        return f"From {date_from.strftime('%d/%m/%Y')}"
    if date_to:
        return f"Up to {date_to.strftime('%d/%m/%Y')}"
    return "All dates"


def get_visible_report_catalog(user) -> list[dict]:
    # Development mode catalog: return all reports without per-user assignment checks.
    return [{"key": report["key"], "title": report["title"]} for report in REPORT_CATALOG]


def _build_rows_with_pagination(report_config: dict, rows: list[dict], summary_cards: list[dict], context: ReportContext):
    paged_rows, pagination = _paginate_rows(rows, context.page, context.page_size)
    return {
        "report": {
            "key": report_config["key"],
            "title": report_config["title"],
            "description": report_config["description"],
            "columns": report_config["columns"],
            "search_placeholder": report_config["search_placeholder"],
            "empty_message": report_config["empty_message"],
        },
        "filters": {
            "date_from": context.date_from.isoformat() if context.date_from else None,
            "date_to": context.date_to.isoformat() if context.date_to else None,
            "date_range_label": _date_range_label(context.date_from, context.date_to),
            "search": context.search,
            "page_size": context.page_size,
        },
        "summary_cards": summary_cards,
        "rows": paged_rows,
        "pagination": pagination,
    }


def build_leads_report(context: ReportContext):
    queryset = Lead.objects.select_related("owner")
    queryset = _scope_queryset_for_user(queryset, context.user, "owner")
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(first_name__icontains=context.search)
            | Q(last_name__icontains=context.search)
            | Q(company__icontains=context.search)
            | Q(email__icontains=context.search)
            | Q(phone__icontains=context.search)
            | Q(lead_source__icontains=context.search)
            | Q(lead_status__icontains=context.search)
            | Q(owner__name__icontains=context.search)
            | Q(owner__email__icontains=context.search)
        )
    items = list(queryset.order_by("-created_at"))
    rows = [
        {
            "date_time": _serialize_date(item.created_at, include_time=True),
            "lead_name": f"{item.first_name} {item.last_name}".strip() or "-",
            "company": item.company or "-",
            "email": item.email or "-",
            "phone": item.phone or item.mobile or "-",
            "source": item.lead_source or "-",
            "owner": getattr(item.owner, "name", "") or getattr(item.owner, "email", "") or "Unassigned",
            "status": item.lead_status or "-",
            "score": str(item.employee_count or 0),
        }
        for item in items
    ]
    total = len(items)
    qualified = sum(1 for item in items if (item.lead_status or "").lower() == "qualified")
    converted = sum(1 for item in items if (item.lead_status or "").lower() == "converted")
    summary = [
        {"key": "total_leads", "label": "Total Leads", "value": str(total), "tone": "mint"},
        {"key": "qualified_leads", "label": "Qualified Leads", "value": str(qualified), "tone": "sky"},
        {"key": "converted_leads", "label": "Converted Leads", "value": str(converted), "tone": "violet"},
        {"key": "conversion_rate", "label": "Conversion Rate", "value": _percent(converted, total), "tone": "amber"},
    ]
    return rows, summary


def build_contacts_report(context: ReportContext):
    queryset = Contact.objects.select_related("contact_owner", "account", "created_from_lead")
    queryset = _scope_queryset_for_user(queryset, context.user, "contact_owner")
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(first_name__icontains=context.search)
            | Q(last_name__icontains=context.search)
            | Q(account__account_name__icontains=context.search)
            | Q(email__icontains=context.search)
            | Q(title__icontains=context.search)
            | Q(contact_owner__name__icontains=context.search)
        )
    items = list(queryset.order_by("-created_at"))
    rows = [
        {
            "created_at": _serialize_date(item.created_at, include_time=True),
            "contact_name": f"{item.first_name} {item.last_name}".strip(),
            "account": item.account.account_name if item.account else "-",
            "email": item.email or "-",
            "phone": item.phone or item.mobile or "-",
            "title": item.title or "-",
            "owner": getattr(item.contact_owner, "name", "") or getattr(item.contact_owner, "email", "") or "Unassigned",
        }
        for item in items
    ]
    summary = [
        {"key": "total_contacts", "label": "Total Contacts", "value": str(len(items)), "tone": "mint"},
        {"key": "with_accounts", "label": "Linked Accounts", "value": str(sum(1 for item in items if item.account_id)), "tone": "sky"},
        {"key": "from_leads", "label": "From Leads", "value": str(sum(1 for item in items if item.created_from_lead_id)), "tone": "violet"},
    ]
    return rows, summary


def build_accounts_report(context: ReportContext):
    queryset = Account.objects.select_related("account_owner")
    queryset = _scope_queryset_for_user(queryset, context.user, "account_owner")
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(account_name__icontains=context.search)
            | Q(industry__icontains=context.search)
            | Q(account_owner__name__icontains=context.search)
        )
    items = list(queryset.order_by("-created_at"))
    rows = [
        {
            "created_at": _serialize_date(item.created_at, include_time=True),
            "account_name": item.account_name,
            "industry": item.industry or "-",
            "phone": item.phone or "-",
            "website": item.website or "-",
            "owner": getattr(item.account_owner, "name", "") or getattr(item.account_owner, "email", "") or "Unassigned",
            "annual_revenue": _format_currency(item.annual_revenue),
        }
        for item in items
    ]
    summary = [
        {"key": "total_accounts", "label": "Total Accounts", "value": str(len(items)), "tone": "mint"},
        {"key": "customer_accounts", "label": "Customer Accounts", "value": str(sum(1 for item in items if (item.account_type or "").lower() == "customer")), "tone": "sky"},
        {"key": "prospect_accounts", "label": "Prospects", "value": str(sum(1 for item in items if (item.account_type or "").lower() == "prospect")), "tone": "violet"},
    ]
    return rows, summary


def build_sales_report(context: ReportContext):
    queryset = Deal.objects.select_related("deal_owner", "account", "stage")
    queryset = _scope_queryset_for_user(queryset, context.user, "deal_owner")
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(deal_owner__name__icontains=context.search)
            | Q(deal_owner__email__icontains=context.search)
            | Q(account__account_name__icontains=context.search)
            | Q(stage__stage_name__icontains=context.search)
            | Q(deal_name__icontains=context.search)
        )

    grouped: dict[str, dict] = {}
    total_deals = 0
    total_open = 0
    total_won = 0
    pipeline_total = Decimal("0")
    won_total = Decimal("0")

    for item in queryset.order_by("-created_at"):
        owner = getattr(item.deal_owner, "name", "") or getattr(item.deal_owner, "email", "") or "Unassigned"
        bucket = grouped.setdefault(
            owner,
            {
                "owner": owner,
                "total_deals": 0,
                "open_deals": 0,
                "won_deals": 0,
                "pipeline_value": Decimal("0"),
                "won_value": Decimal("0"),
            },
        )
        bucket["total_deals"] += 1
        total_deals += 1
        revenue = item.expected_revenue or item.amount or Decimal("0")
        bucket["pipeline_value"] += revenue
        pipeline_total += revenue
        if not item.is_closed:
            bucket["open_deals"] += 1
            total_open += 1
        if item.is_won:
            bucket["won_deals"] += 1
            bucket["won_value"] += revenue
            total_won += 1
            won_total += revenue

    rows = [
        {
            "owner": bucket["owner"],
            "total_deals": str(bucket["total_deals"]),
            "open_deals": str(bucket["open_deals"]),
            "won_deals": str(bucket["won_deals"]),
            "pipeline_value": _format_currency(bucket["pipeline_value"]),
            "won_value": _format_currency(bucket["won_value"]),
        }
        for bucket in grouped.values()
    ]
    rows.sort(key=lambda item: int(item["total_deals"]), reverse=True)
    summary = [
        {"key": "total_sales_deals", "label": "Total Deals", "value": str(total_deals), "tone": "mint"},
        {"key": "open_sales_deals", "label": "Open Deals", "value": str(total_open), "tone": "sky"},
        {"key": "won_sales_deals", "label": "Won Deals", "value": str(total_won), "tone": "violet"},
        {"key": "sales_pipeline_value", "label": "Pipeline Value", "value": _format_currency(pipeline_total), "tone": "amber"},
    ]
    return rows, summary


def build_deals_report(context: ReportContext):
    queryset = Deal.objects.select_related("deal_owner", "account", "stage")
    queryset = _scope_queryset_for_user(queryset, context.user, "deal_owner")
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(deal_name__icontains=context.search)
            | Q(account__account_name__icontains=context.search)
            | Q(stage__stage_name__icontains=context.search)
            | Q(deal_owner__name__icontains=context.search)
        )
    items = list(queryset.order_by("-created_at"))
    rows = [
        {
            "created_at": _serialize_date(item.created_at, include_time=True),
            "deal_name": item.deal_name,
            "account": item.account.account_name if item.account else "-",
            "stage": item.stage.stage_name if item.stage else "-",
            "amount": _format_currency(item.amount),
            "expected_revenue": _format_currency(item.expected_revenue),
            "owner": getattr(item.deal_owner, "name", "") or getattr(item.deal_owner, "email", "") or "Unassigned",
            "closing_date": item.closing_date.strftime("%d/%m/%Y") if item.closing_date else "-",
        }
        for item in items
    ]
    summary = [
        {"key": "total_deals", "label": "Total Deals", "value": str(len(items)), "tone": "mint"},
        {"key": "open_deals", "label": "Open Deals", "value": str(sum(1 for item in items if not item.is_closed)), "tone": "sky"},
        {"key": "won_deals", "label": "Won Deals", "value": str(sum(1 for item in items if item.is_won)), "tone": "violet"},
        {"key": "pipeline_value", "label": "Pipeline Value", "value": _format_currency(sum((item.expected_revenue or Decimal("0")) for item in items)), "tone": "amber"},
    ]
    return rows, summary


def build_activities_report(context: ReportContext):
    queryset = Task.objects.select_related("assigned_to", "account")
    queryset = _scope_queryset_for_user(queryset, context.user, "assigned_to")
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(subject__icontains=context.search)
            | Q(status__icontains=context.search)
            | Q(priority__icontains=context.search)
            | Q(account__account_name__icontains=context.search)
            | Q(assigned_to__name__icontains=context.search)
        )
    items = list(queryset.order_by("-created_at"))
    completed = sum(1 for item in items if (item.status or "").lower() == "completed")
    rows = [
        {
            "created_at": _serialize_date(item.created_at, include_time=True),
            "subject": item.subject,
            "status": item.status,
            "priority": item.priority,
            "due_date": item.due_date.strftime("%d/%m/%Y") if item.due_date else "-",
            "assigned_to": getattr(item.assigned_to, "name", "") or getattr(item.assigned_to, "email", "") or "Unassigned",
            "account": item.account.account_name if item.account else "-",
        }
        for item in items
    ]
    summary = [
        {"key": "total_tasks", "label": "Total Tasks", "value": str(len(items)), "tone": "mint"},
        {"key": "completed_tasks", "label": "Completed", "value": str(completed), "tone": "sky"},
        {"key": "open_tasks", "label": "Open Tasks", "value": str(len(items) - completed), "tone": "violet"},
        {"key": "completion_rate", "label": "Completion Rate", "value": _percent(completed, len(items)), "tone": "amber"},
    ]
    return rows, summary


def build_invoices_report(context: ReportContext):
    queryset = Invoice.objects.select_related("owner", "account")
    queryset = _scope_queryset_for_user(queryset, context.user, "owner")
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(subject__icontains=context.search)
            | Q(status__icontains=context.search)
            | Q(account__account_name__icontains=context.search)
            | Q(owner__name__icontains=context.search)
        )
    items = list(queryset.order_by("-created_at"))
    rows = [
        {
            "created_at": _serialize_date(item.created_at, include_time=True),
            "subject": item.subject,
            "account": item.account.account_name if item.account else "-",
            "status": item.status or "-",
            "invoice_date": item.invoice_date.strftime("%d/%m/%Y") if item.invoice_date else "-",
            "due_date": item.due_date.strftime("%d/%m/%Y") if item.due_date else "-",
            "grand_total": _format_currency(item.grand_total),
            "owner": getattr(item.owner, "name", "") or getattr(item.owner, "email", "") or "Unassigned",
        }
        for item in items
    ]
    paid = sum(1 for item in items if (item.status or "").lower() in {"paid", "closed"})
    summary = [
        {"key": "total_invoices", "label": "Total Invoices", "value": str(len(items)), "tone": "mint"},
        {"key": "paid_invoices", "label": "Paid / Closed", "value": str(paid), "tone": "sky"},
        {"key": "pending_invoices", "label": "Pending", "value": str(len(items) - paid), "tone": "violet"},
        {"key": "invoice_value", "label": "Invoice Value", "value": _format_currency(sum((item.grand_total or Decimal("0")) for item in items)), "tone": "amber"},
    ]
    return rows, summary


def build_projects_report(context: ReportContext):
    queryset = Project.objects.all()
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(project_code__icontains=context.search)
            | Q(name__icontains=context.search)
            | Q(account_name__icontains=context.search)
            | Q(owner__icontains=context.search)
            | Q(status__icontains=context.search)
        )
    items = list(queryset.order_by("-created_at"))
    rows = [
        {
            "created_at": _serialize_date(item.created_at, include_time=True),
            "project_code": item.project_code,
            "project_name": item.name,
            "account_name": item.account_name or "-",
            "owner": item.owner or "-",
            "status": item.status,
            "priority": item.priority,
            "progress": f"{item.progress}%",
            "due_date": item.due_date.strftime("%d/%m/%Y") if item.due_date else "-",
        }
        for item in items
    ]
    summary = [
        {"key": "total_projects", "label": "Total Projects", "value": str(len(items)), "tone": "mint"},
        {"key": "active_projects", "label": "Active Projects", "value": str(sum(1 for item in items if (item.status or "").lower() == "active")), "tone": "sky"},
        {"key": "completed_projects", "label": "Completed Projects", "value": str(sum(1 for item in items if (item.status or "").lower() == "completed")), "tone": "violet"},
        {"key": "avg_progress", "label": "Avg Progress", "value": f"{round(sum(item.progress for item in items) / len(items)) if items else 0}%", "tone": "amber"},
    ]
    return rows, summary


def build_services_report(context: ReportContext):
    queryset = CRMService.objects.select_related("created_by")
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(service_code__icontains=context.search)
            | Q(service_name__icontains=context.search)
            | Q(delivery_team__icontains=context.search)
            | Q(status__icontains=context.search)
        )
    items = list(queryset.order_by("-created_at"))
    rows = [
        {
            "created_at": _serialize_date(item.created_at, include_time=True),
            "service_code": item.service_code or "-",
            "service_name": item.service_name,
            "status": item.status,
            "delivery_team": item.delivery_team,
            "price": _format_currency(item.price),
            "duration_minutes": str(item.duration_minutes),
            "location_type": item.location_type,
            "created_by": getattr(item.created_by, "name", "") or getattr(item.created_by, "email", "") or "Unassigned",
        }
        for item in items
    ]
    summary = [
        {"key": "total_services", "label": "Total Services", "value": str(len(items)), "tone": "mint"},
        {"key": "active_services", "label": "Active Services", "value": str(sum(1 for item in items if (item.status or "").lower() == "active")), "tone": "sky"},
        {"key": "draft_services", "label": "Draft Services", "value": str(sum(1 for item in items if (item.status or "").lower() == "draft")), "tone": "violet"},
        {"key": "avg_service_price", "label": "Avg Price", "value": _format_currency((sum((item.price or Decimal("0")) for item in items) / len(items)) if items else Decimal("0")), "tone": "amber"},
    ]
    return rows, summary


def build_sales_performance_report(context: ReportContext):
    queryset = Deal.objects.select_related("deal_owner", "stage", "account")
    queryset = _scope_queryset_for_user(queryset, context.user, "deal_owner")
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(deal_owner__name__icontains=context.search)
            | Q(stage__stage_name__icontains=context.search)
            | Q(account__account_name__icontains=context.search)
        )
    grouped: dict[str, dict] = {}
    for item in queryset:
        owner = getattr(item.deal_owner, "name", "") or getattr(item.deal_owner, "email", "") or "Unassigned"
        bucket = grouped.setdefault(owner, {"owner": owner, "total_deals": 0, "won_deals": 0, "pipeline_value": Decimal("0"), "won_value": Decimal("0")})
        bucket["total_deals"] += 1
        bucket["pipeline_value"] += item.expected_revenue or Decimal("0")
        if item.is_won:
            bucket["won_deals"] += 1
            bucket["won_value"] += item.expected_revenue or Decimal("0")
    rows = [
        {
            "owner": bucket["owner"],
            "total_deals": str(bucket["total_deals"]),
            "won_deals": str(bucket["won_deals"]),
            "won_rate": _percent(bucket["won_deals"], bucket["total_deals"]),
            "pipeline_value": _format_currency(bucket["pipeline_value"]),
            "won_value": _format_currency(bucket["won_value"]),
        }
        for bucket in grouped.values()
    ]
    rows.sort(key=lambda item: int(item["won_deals"]), reverse=True)
    total_deals = sum(int(item["total_deals"]) for item in rows)
    total_won = sum(int(item["won_deals"]) for item in rows)
    total_revenue = sum(Decimal(item["won_value"].replace(",", "")) for item in rows) if rows else Decimal("0")
    summary = [
        {"key": "team_deals", "label": "Team Deals", "value": str(total_deals), "tone": "mint"},
        {"key": "team_won", "label": "Won Deals", "value": str(total_won), "tone": "sky"},
        {"key": "team_win_rate", "label": "Win Rate", "value": _percent(total_won, total_deals), "tone": "violet"},
        {"key": "team_revenue", "label": "Won Revenue", "value": _format_currency(total_revenue), "tone": "amber"},
    ]
    return rows, summary


def build_conversion_report(context: ReportContext):
    queryset = Lead.objects.select_related("owner")
    queryset = _scope_queryset_for_user(queryset, context.user, "owner")
    queryset = _apply_date_range(queryset, "created_at", context.date_from, context.date_to)
    if context.search:
        queryset = queryset.filter(
            Q(lead_source__icontains=context.search)
            | Q(owner__name__icontains=context.search)
            | Q(owner__email__icontains=context.search)
        )
    grouped: dict[str, dict] = {}
    total = qualified = converted = 0
    for item in queryset:
        source = item.lead_source or "Unknown"
        bucket = grouped.setdefault(source, {"source": source, "total_leads": 0, "qualified_leads": 0, "converted_leads": 0, "owner_counts": {}})
        bucket["total_leads"] += 1
        total += 1
        owner_name = getattr(item.owner, "name", "") or getattr(item.owner, "email", "") or "Unassigned"
        bucket["owner_counts"][owner_name] = bucket["owner_counts"].get(owner_name, 0) + 1
        if (item.lead_status or "").lower() == "qualified":
            bucket["qualified_leads"] += 1
            qualified += 1
        if (item.lead_status or "").lower() == "converted":
            bucket["converted_leads"] += 1
            converted += 1
    rows = []
    for bucket in grouped.values():
        top_owner = max(bucket["owner_counts"].items(), key=lambda entry: entry[1])[0] if bucket["owner_counts"] else "-"
        rows.append({
            "source": bucket["source"],
            "total_leads": str(bucket["total_leads"]),
            "qualified_leads": str(bucket["qualified_leads"]),
            "converted_leads": str(bucket["converted_leads"]),
            "conversion_rate": _percent(bucket["converted_leads"], bucket["total_leads"]),
            "top_owner": top_owner,
        })
    rows.sort(key=lambda item: int(item["total_leads"]), reverse=True)
    summary = [
        {"key": "all_leads", "label": "All Leads", "value": str(total), "tone": "mint"},
        {"key": "all_qualified", "label": "Qualified", "value": str(qualified), "tone": "sky"},
        {"key": "all_converted", "label": "Converted", "value": str(converted), "tone": "violet"},
        {"key": "overall_rate", "label": "Overall Rate", "value": _percent(converted, total), "tone": "amber"},
    ]
    return rows, summary


GENERATOR_MAP = {
    "build_sales_report": build_sales_report,
    "build_leads_report": build_leads_report,
    "build_contacts_report": build_contacts_report,
    "build_accounts_report": build_accounts_report,
    "build_deals_report": build_deals_report,
    "build_activities_report": build_activities_report,
    "build_invoices_report": build_invoices_report,
    "build_projects_report": build_projects_report,
    "build_services_report": build_services_report,
}


def generate_report(context: ReportContext):
    report_config = REPORT_CATALOG_BY_KEY[context.report_key]
    rows, summary_cards = GENERATOR_MAP[report_config["generator"]](context)
    return _build_rows_with_pagination(report_config, rows, summary_cards, context)


def export_report_file(context: ReportContext, export_format: str):
    payload = generate_report(
        ReportContext(
            user=context.user,
            report_key=context.report_key,
            date_from=context.date_from,
            date_to=context.date_to,
            search=context.search,
            page=1,
            page_size=10000,
        )
    )
    rows = payload["rows"]
    columns = payload["report"]["columns"]
    filename = f"{context.report_key}-{timezone.now().strftime('%Y%m%d-%H%M%S')}"

    if export_format == "csv":
        buffer = StringIO()
        writer = csv.DictWriter(buffer, fieldnames=[column["label"] for column in columns])
        writer.writeheader()
        for row in rows:
            writer.writerow({column["label"]: row.get(column["key"], "") for column in columns})
        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
        return response

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Report"
    sheet.append([column["label"] for column in columns])
    for row in rows:
        sheet.append([row.get(column["key"], "") for column in columns])
    output = BytesIO()
    workbook.save(output)
    response = HttpResponse(
        output.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}.xlsx"'
    return response
