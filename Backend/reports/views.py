from datetime import timedelta

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q, Sum
from django.utils import timezone

from accounts.models import Account
from activities.models import Meeting, Task
from contacts.models import Contact
from deals.models import Deal
from inventory.models import Invoice
from leads.models import Lead
from services.models import ServiceAppointment
from support.models import SupportCase

from .catalog import REPORT_CATALOG_OPTIONS
from .serializers import ExportRequestSerializer, ReportRequestSerializer


class ReportCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            return Response(REPORT_CATALOG_OPTIONS, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response({"detail": f"Failed to load report catalog: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GenerateReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .services import ReportContext, generate_report

        serializer = ReportRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            payload = generate_report(
                ReportContext(
                    user=request.user,
                    report_key=data["report_key"],
                    date_from=data.get("date_from"),
                    date_to=data.get("date_to"),
                    search=data.get("search", ""),
                    page=data.get("page", 1),
                    page_size=data.get("page_size", 25),
                )
            )
            return Response(payload, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response({"detail": f"Failed to generate report: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExportReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .services import ReportContext, export_report_file

        serializer = ExportRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            return export_report_file(
                ReportContext(
                    user=request.user,
                    report_key=data["report_key"],
                    date_from=data.get("date_from"),
                    date_to=data.get("date_to"),
                    search=data.get("search", ""),
                    page=1,
                    page_size=data.get("page_size", 25),
                ),
                data["export_format"],
            )
        except Exception as exc:
            return Response({"detail": f"Failed to export report: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _to_iso(value):
    if not value:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _today_range():
    today = timezone.localdate()
    return today, today


def _normalize_status(value):
    return (value or "").strip().lower()


def _is_closed_status(value):
    status = _normalize_status(value)
    return any(token in status for token in ["closed", "completed", "resolved", "done", "cancelled", "canceled"])


def _is_open_status(value):
    status = _normalize_status(value)
    return any(
        token in status
        for token in [
            "open",
            "new",
            "requested",
            "scheduled",
            "in progress",
            "pending",
            "on hold",
            "not started",
            "deferred",
            "waiting for input",
        ]
    )


class HomeDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        customers = list(Account.objects.select_related("account_owner").all()[:200])
        leads_today = Lead.objects.filter(created_at__date=today).count()
        deals_updated_today_qs = Deal.objects.select_related("account", "lead", "deal_owner", "stage").filter(updated_at__date=today)
        tasks_due_today_qs = Task.objects.filter(due_date=today)
        meetings_today_qs = Meeting.objects.filter(start_date__date=today)

        repeat_revenue = Deal.objects.filter(is_won=True).aggregate(total=Sum("amount")).get("total") or 0
        inactive_customers = Account.objects.filter(updated_at__date__lt=today - timedelta(days=45)).count()
        vip_customers = Deal.objects.filter(Q(amount__gte=300000) | Q(expected_revenue__gte=300000)).values("account_id").distinct().count()

        top_customers = []
        customer_rows = (
            Deal.objects.select_related("account")
            .values("account_id", "account__account_name")
            .annotate(revenue=Sum("amount"), deals=Count("id"))
            .order_by("-revenue")[:5]
        )
        for index, row in enumerate(customer_rows, start=1):
            top_customers.append(
                {
                    "id": row["account_id"] or f"account-{index}",
                    "name": row["account__account_name"] or "Unnamed Account",
                    "status_line": "Revenue-leading account",
                    "revenue": float(row["revenue"] or 0),
                    "deals": int(row["deals"] or 0),
                    "rank": index,
                }
            )

        recent_activity = []
        for deal in deals_updated_today_qs.order_by("-updated_at")[:3]:
            recent_activity.append(
                {
                    "key": f"deal-{deal.id}",
                    "customer": deal.account.account_name if deal.account else (deal.lead.company if deal.lead else deal.deal_name),
                    "type": "Deal update",
                    "context": f"{deal.deal_name} at {deal.amount or 0}",
                    "time": _to_iso(deal.updated_at or deal.created_at),
                    "tag": "VIP" if (deal.amount or 0) >= 300000 else "Repeat",
                }
            )
        for task in tasks_due_today_qs.order_by("due_date")[:3]:
            recent_activity.append(
                {
                    "key": f"task-{task.id}",
                    "customer": task.subject,
                    "type": "Task due today",
                    "context": f"{task.status} task | {task.priority}",
                    "time": _to_iso(task.due_date),
                    "tag": "At Risk",
                }
            )

        payload = {
            "hero": {
                "follow_ups": tasks_due_today_qs.count(),
                "inactive_customers": inactive_customers,
                "repeat_revenue": float(repeat_revenue or 0),
                "tasks_due_today": tasks_due_today_qs.count(),
                "meetings_today": meetings_today_qs.count(),
                "deals_updated_today": deals_updated_today_qs.count(),
                "customers_added_today": Account.objects.filter(created_at__date=today).count(),
            },
            "summary_cards": [
                {
                    "title": "Customers Added Today",
                    "value": Account.objects.filter(created_at__date=today).count(),
                    "note": "New accounts created today",
                    "trend": f"{Lead.objects.filter(created_at__date__gte=today - timedelta(days=6)).count()} leads in the last 7 days",
                },
                {
                    "title": "Deals Updated Today",
                    "value": deals_updated_today_qs.count(),
                    "note": "Deals touched by your CRM today",
                    "trend": f"{float(deals_updated_today_qs.aggregate(total=Sum('amount')).get('total') or 0)} moved through updates",
                },
                {
                    "title": "Tasks Due Today",
                    "value": tasks_due_today_qs.count(),
                    "note": "Follow-up work due today",
                    "trend": f"{tasks_due_today_qs.filter(status__in=[Task.Status.NOT_STARTED, Task.Status.IN_PROGRESS]).count()} still open",
                },
                {
                    "title": "Meetings Today",
                    "value": meetings_today_qs.count(),
                    "note": "Conversations on today’s calendar",
                    "trend": f"{Lead.objects.filter(created_at__date=today).count()} new leads arrived today",
                },
                {
                    "title": "Repeat Revenue In CRM",
                    "value": float(repeat_revenue or 0),
                    "note": "Won revenue visible in current records",
                    "trend": f"{vip_customers} VIP accounts influence this total",
                },
            ],
            "top_insight_chips": [
                {"label": "Due Today", "value": tasks_due_today_qs.count()},
                {"label": "Meetings Today", "value": meetings_today_qs.count()},
                {"label": "Updated Deals", "value": deals_updated_today_qs.count()},
                {"label": "New Customers", "value": Account.objects.filter(created_at__date=today).count()},
            ],
            "action_queue": [
                {"title": "Customers to follow up", "count": tasks_due_today_qs.count()},
                {"title": "High-value customers with no recent orders", "count": vip_customers},
                {"title": "One-time customers ready for conversion", "count": leads_today},
                {"title": "Customers eligible for offers or loyalty rewards", "count": max(vip_customers, 0)},
            ],
            "segments": [
                {"name": "New", "count": Account.objects.filter(created_at__date__gte=today - timedelta(days=6)).count()},
                {"name": "Repeat", "count": Deal.objects.values("account_id").annotate(total=Count("id")).filter(total__gte=2).count()},
                {"name": "VIP", "count": vip_customers},
                {"name": "At-risk", "count": Account.objects.filter(updated_at__date__lt=today - timedelta(days=20), updated_at__date__gte=today - timedelta(days=45)).count()},
                {"name": "Inactive", "count": inactive_customers},
            ],
            "recent_activity": recent_activity[:6],
            "top_customers": top_customers,
        }
        return Response(payload, status=status.HTTP_200_OK)


class AnalyticsDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        start_month = today.replace(day=1)
        previous_month_end = start_month - timedelta(days=1)
        previous_month_start = previous_month_end.replace(day=1)

        leads_today = Lead.objects.filter(created_at__date=today).count()
        leads_yesterday = Lead.objects.filter(created_at__date=yesterday).count()
        accounts_today = Account.objects.filter(created_at__date=today).count()
        accounts_yesterday = Account.objects.filter(created_at__date=yesterday).count()
        deals_today_qs = Deal.objects.filter(created_at__date=today)
        deals_yesterday_qs = Deal.objects.filter(created_at__date=yesterday)
        invoices_today_qs = Invoice.objects.filter(invoice_date=today)
        invoices_yesterday_qs = Invoice.objects.filter(invoice_date=yesterday)
        won_today_qs = Deal.objects.filter(is_won=True, closing_date=today)
        pipeline_qs = Deal.objects.filter(is_closed=False)
        overdue_invoices_qs = Invoice.objects.filter(due_date__lt=today).exclude(status__iexact="paid")
        leads_this_month_qs = Lead.objects.filter(created_at__date__gte=start_month)
        converted_leads_this_month_qs = leads_this_month_qs.filter(
            Q(converted_account__isnull=False)
            | Q(converted_contact__isnull=False)
            | Q(converted_deal__isnull=False)
        )

        daily_series = []
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            daily_series.append(
                {
                    "day": day.strftime("%a"),
                    "leads": Lead.objects.filter(created_at__date=day).count(),
                    "deals": Deal.objects.filter(created_at__date=day).count(),
                    "revenue": float(Invoice.objects.filter(invoice_date=day).aggregate(total=Sum("grand_total")).get("total") or 0),
                }
            )

        lead_sources = []
        for row in (
            Lead.objects.values("lead_source").annotate(value=Count("id")).order_by("-value")[:6]
        ):
            lead_sources.append({"name": row["lead_source"] or "Unknown", "value": int(row["value"] or 0)})

        owner_rows = []
        for index, row in enumerate(
            Deal.objects.filter(is_won=True)
            .values("deal_owner__name", "deal_owner__email")
            .annotate(revenue=Sum("amount"), won_count=Count("id"))
            .order_by("-revenue")[:5],
            start=1,
        ):
            owner_rows.append(
                {
                    "owner": row["deal_owner__name"] or row["deal_owner__email"] or f"Owner {index}",
                    "revenue": float(row["revenue"] or 0),
                    "won": int(row["won_count"] or 0),
                }
            )

        recent_signals = []
        for invoice in Invoice.objects.order_by("-invoice_date", "-created_at")[:3]:
            recent_signals.append(
                {
                    "key": f"invoice-{invoice.id}",
                    "title": invoice.subject,
                    "note": f"{invoice.grand_total} invoice | {invoice.status or 'Open'}",
                    "time": _to_iso(invoice.invoice_date or invoice.created_at),
                    "tone": "alert" if invoice.due_date and invoice.due_date < today else "neutral",
                }
            )
        for deal in Deal.objects.select_related("account").order_by("-updated_at")[:3]:
            recent_signals.append(
                {
                    "key": f"deal-{deal.id}",
                    "title": deal.deal_name,
                    "note": f"{deal.amount or 0} | {deal.stage}",
                    "time": _to_iso(deal.updated_at or deal.created_at),
                    "tone": "good" if deal.is_won else "neutral",
                }
            )

        top_revenue_accounts = []
        for row in (
            Deal.objects.values("account_id", "account__account_name")
            .annotate(revenue=Sum("amount"), deals_count=Count("id"))
            .order_by("-revenue")[:5]
        ):
            top_revenue_accounts.append(
                {
                    "name": row["account__account_name"] or "Unnamed",
                    "revenue": float(row["revenue"] or 0),
                    "deals": int(row["deals_count"] or 0),
                    "last_touched_days": 0,
                }
            )

        payload = {
            "hero": {
                "updated": timezone.now().isoformat(),
                "revenue_today": float(invoices_today_qs.aggregate(total=Sum("grand_total")).get("total") or 0),
                "leads_today": leads_today,
                "deals_today": deals_today_qs.count(),
            },
            "daily_metrics": {
                "leads_today": leads_today,
                "leads_yesterday": leads_yesterday,
                "accounts_today": accounts_today,
                "accounts_yesterday": accounts_yesterday,
                "deals_today": deals_today_qs.count(),
                "deals_yesterday": deals_yesterday_qs.count(),
                "revenue_today": float(invoices_today_qs.aggregate(total=Sum("grand_total")).get("total") or 0),
                "revenue_yesterday": float(invoices_yesterday_qs.aggregate(total=Sum("grand_total")).get("total") or 0),
            },
            "month_scorecard": {
                "leads_created": leads_this_month_qs.count(),
                "contacts_added": Contact.objects.filter(created_at__date__gte=start_month).count(),
                "deals_created": Deal.objects.filter(created_at__date__gte=start_month).count(),
                "deals_won": Deal.objects.filter(is_won=True, closing_date__gte=start_month).count(),
                "revenue_won": float(Deal.objects.filter(is_won=True, closing_date__gte=start_month).aggregate(total=Sum("amount")).get("total") or 0),
                "open_amount": float(pipeline_qs.aggregate(total=Sum("amount")).get("total") or 0),
            },
            "revenue_target": {
                "achieved": float(Invoice.objects.filter(invoice_date__gte=start_month).aggregate(total=Sum("grand_total")).get("total") or 0),
                "won": float(Deal.objects.filter(is_won=True, closing_date__gte=start_month).aggregate(total=Sum("amount")).get("total") or 0),
                "goal": 300000,
            },
            "risk": {
                "stale_pipeline_deals": pipeline_qs.filter(updated_at__date__lt=today - timedelta(days=21)).count(),
                "stale_pipeline_amount": float(pipeline_qs.filter(updated_at__date__lt=today - timedelta(days=21)).aggregate(total=Sum("amount")).get("total") or 0),
                "overdue_invoices": overdue_invoices_qs.count(),
                "overdue_invoice_amount": float(overdue_invoices_qs.aggregate(total=Sum("grand_total")).get("total") or 0),
                "lead_conversion_rate": round((converted_leads_this_month_qs.count() / max(leads_this_month_qs.count(), 1)) * 100),
                "top_source": lead_sources[0] if lead_sources else None,
            },
            "daily_series": daily_series,
            "lead_sources": lead_sources,
            "owner_rows": owner_rows,
            "recent_signals": recent_signals[:7],
            "top_revenue_accounts": top_revenue_accounts,
            "pipeline_health": {
                "open_amount": float(pipeline_qs.aggregate(total=Sum("amount")).get("total") or 0),
                "pipeline_deals": pipeline_qs.count(),
                "won_revenue": float(won_today_qs.aggregate(total=Sum("amount")).get("total") or 0),
                "won_deals": won_today_qs.count(),
            },
        }
        return Response(payload, status=status.HTTP_200_OK)


class MyRequestsDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localdate()

        task_qs = Task.objects.filter(Q(assigned_to=user) | Q(owner=user))
        meeting_qs = Meeting.objects.filter(organizer=user)
        case_qs = SupportCase.objects.filter(owner=user).only(
            "id",
            "case_number",
            "subject",
            "status",
            "priority",
            "created_at",
            "updated_at",
        )
        appointment_qs = ServiceAppointment.objects.filter(assigned_member=user)

        items = []
        for task in task_qs:
            items.append(
                {
                    "id": f"task-{task.id}",
                    "module": "Task",
                    "title": task.subject,
                    "status": task.status,
                    "priority": task.priority,
                    "created_at": _to_iso(task.created_at),
                    "updated_at": _to_iso(task.updated_at),
                    "due_at": _to_iso(task.due_date),
                    "href": f"/tasks/{task.id}",
                    "meta": f"Due {task.due_date}" if task.due_date else "Task",
                }
            )
        for meeting in meeting_qs:
            items.append(
                {
                    "id": f"meeting-{meeting.id}",
                    "module": "Meeting",
                    "title": meeting.title,
                    "status": meeting.status,
                    "created_at": _to_iso(meeting.created_at),
                    "updated_at": _to_iso(meeting.updated_at),
                    "due_at": _to_iso(meeting.start_date),
                    "href": f"/meetings/{meeting.id}",
                    "meta": f"Scheduled {meeting.start_date}",
                }
            )
        for case in case_qs:
            items.append(
                {
                    "id": f"case-{case.id}",
                    "module": "Case",
                    "title": case.subject or case.case_number,
                    "status": case.status or "Open",
                    "priority": case.priority,
                    "created_at": _to_iso(case.created_at),
                    "updated_at": _to_iso(case.updated_at),
                    "href": f"/support/cases/{case.id}",
                    "meta": case.case_number or "Support case",
                }
            )
        for appointment in appointment_qs:
            items.append(
                {
                    "id": f"appointment-{appointment.id}",
                    "module": "Appointment",
                    "title": appointment.service.service_name if appointment.service_id else appointment.appointment_number,
                    "status": appointment.status,
                    "created_at": _to_iso(appointment.created_at),
                    "updated_at": _to_iso(appointment.updated_at),
                    "due_at": _to_iso(appointment.appointment_date),
                    "href": f"/services/appointments/{appointment.id}",
                    "meta": appointment.appointment_for_label or "Service request",
                }
            )

        items.sort(key=lambda item: item.get("updated_at") or item.get("created_at") or item.get("due_at") or "", reverse=True)

        open_items = [item for item in items if _is_open_status(item["status"]) and not _is_closed_status(item["status"])]
        closed_items = [item for item in items if _is_closed_status(item["status"])]
        pending_items = [
            item
            for item in items
            if any(token in _normalize_status(item["status"]) for token in ["pending", "waiting for input"])
        ]
        due_today = [item for item in items if item.get("due_at") and str(item["due_at"]).startswith(str(today))]
        created_today = [item for item in items if item.get("created_at") and str(item["created_at"]).startswith(str(today))]
        updated_today = [item for item in items if item.get("updated_at") and str(item["updated_at"]).startswith(str(today))]
        closed_today = [item for item in closed_items if item.get("updated_at") and str(item["updated_at"]).startswith(str(today))]
        overdue = [item for item in open_items if item.get("due_at") and str(item["due_at"]) < str(today)]
        upcoming = [item for item in open_items if item.get("due_at") and str(item["due_at"]) > str(today)]

        payload = {
            "updated": timezone.now().isoformat(),
            "summary_cards": {
                "created_today": len(created_today),
                "updated_today": len(updated_today),
                "due_today": len(due_today),
                "closed_today": len(closed_today),
            },
            "focus_today": {
                "overdue": len(overdue),
                "due_today": len(due_today),
                "pending": len(pending_items),
            },
            "request_mix": [
                {"module": "Task", "count": task_qs.count()},
                {"module": "Meeting", "count": meeting_qs.count()},
                {"module": "Case", "count": case_qs.count()},
                {"module": "Appointment", "count": appointment_qs.count()},
            ],
            "open_requests": open_items[:12],
            "upcoming_queue": upcoming[:10],
            "closed_history": closed_items[:8],
            "pending_approval": pending_items[:8],
        }
        return Response(payload, status=status.HTTP_200_OK)
