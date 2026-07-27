from datetime import time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
from activities.models import Meeting, Task
from contacts.models import Contact
from deals.models import Deal, DealStage
from deals.services import ensure_default_stages
from inventory.models import Invoice
from leads.models import Lead
from services.models import CRMService, ServiceAppointment
from support.models import SupportCase


User = get_user_model()


class ReportDashboardTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="dashboard@example.com",
            password="StrongPass123",
            name="Dashboard User",
            role="manager",
            department="sales",
            is_active=True,
        )
        self.client.force_authenticate(self.user)
        ensure_default_stages()
        self.today = timezone.localdate()
        self.now = timezone.now()
        self.stage = DealStage.objects.get(stage_name="Closed Won")
        self.account = Account.objects.create(
            account_name="Zora CRM",
            account_owner=self.user,
            account_type=Account.AccountType.CUSTOMER,
            annual_revenue="500000.00",
        )
        self.contact = Contact.objects.create(
            first_name="Boomika",
            last_name="M",
            email="boomika@example.com",
            contact_owner=self.user,
            account=self.account,
        )
        self.lead = Lead.objects.create(
            first_name="Asha",
            last_name="K",
            company="Zora CRM",
            email="asha@example.com",
            lead_source="Advertisement",
            lead_status="Qualified",
            owner=self.user,
        )
        self.deal = Deal.objects.create(
            deal_name="Zora CRM Expansion",
            account=self.account,
            contact=self.contact,
            lead=self.lead,
            deal_owner=self.user,
            stage=self.stage,
            probability=self.stage.probability,
            amount="250000.00",
            expected_revenue="250000.00",
            is_closed=True,
            is_won=True,
            closing_date=self.today,
        )
        self.service = CRMService.objects.create(
            service_name="Onboarding",
            price="1500.00",
            duration_minutes=60,
            location_type=CRMService.LocationType.REMOTE,
            status=CRMService.Status.ACTIVE,
            delivery_team=CRMService.DeliveryTeam.SERVICE,
        )

    def test_home_dashboard_returns_key_summary_metrics(self):
        Task.objects.create(
            subject="Call customer",
            due_date=self.today,
            owner=self.user,
            assigned_to=self.user,
            status=Task.Status.NOT_STARTED,
            priority=Task.Priority.HIGH,
        )
        Meeting.objects.create(
            title="Kickoff",
            start_date=self.now,
            organizer=self.user,
            status=Meeting.Status.SCHEDULED,
        )

        response = self.client.get("/api/dashboard/home/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["hero"]["customers_added_today"], 1)
        self.assertEqual(response.data["hero"]["tasks_due_today"], 1)
        self.assertEqual(response.data["hero"]["meetings_today"], 1)
        self.assertEqual(response.data["top_customers"][0]["name"], "Zora CRM")

    def test_analytics_dashboard_reports_current_month_activity(self):
        Invoice.objects.create(
            subject="Invoice-001",
            owner=self.user,
            account=self.account,
            grand_total="125000.00",
            invoice_date=self.today,
            due_date=self.today + timedelta(days=7),
            status="Unpaid",
        )
        Contact.objects.create(
            first_name="Priya",
            last_name="S",
            email="priya@example.com",
            contact_owner=self.user,
            account=self.account,
        )

        response = self.client.get("/api/dashboard/analytics/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["hero"]["leads_today"], 1)
        self.assertEqual(response.data["hero"]["deals_today"], 1)
        self.assertEqual(response.data["daily_metrics"]["revenue_today"], 125000.0)
        self.assertEqual(response.data["month_scorecard"]["contacts_added"], 2)
        self.assertEqual(response.data["risk"]["top_source"]["name"], "Advertisement")
        self.assertEqual(response.data["pipeline_health"]["won_deals"], 1)

    def test_my_requests_dashboard_includes_task_statuses_that_are_still_open(self):
        Task.objects.create(
            subject="Follow up proposal",
            due_date=self.today + timedelta(days=2),
            owner=self.user,
            assigned_to=self.user,
            status=Task.Status.NOT_STARTED,
            priority=Task.Priority.NORMAL,
        )
        Task.objects.create(
            subject="Closed task",
            due_date=self.today - timedelta(days=1),
            owner=self.user,
            assigned_to=self.user,
            status=Task.Status.COMPLETED,
            priority=Task.Priority.LOW,
        )
        Meeting.objects.create(
            title="Sales sync",
            start_date=self.now + timedelta(days=1),
            organizer=self.user,
            status=Meeting.Status.SCHEDULED,
        )
        SupportCase.objects.create(
            subject="Portal issue",
            owner=self.user,
            status="Open",
            priority="High",
        )
        ServiceAppointment.objects.create(
            service=self.service,
            appointment_for_type=ServiceAppointment.AppointmentForType.OTHER,
            appointment_for_label="Existing customer",
            appointment_date=self.today + timedelta(days=1),
            appointment_start_time=time(10, 0),
            assigned_member=self.user,
            status=ServiceAppointment.Status.REQUESTED,
        )

        response = self.client.get("/api/dashboard/my-requests/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["request_mix"][0]["count"], 2)
        self.assertTrue(any(item["title"] == "Follow up proposal" for item in response.data["open_requests"]))
        self.assertEqual(response.data["summary_cards"]["due_today"], 0)
        self.assertEqual(response.data["focus_today"]["pending"], 0)
