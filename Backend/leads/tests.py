from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
from contacts.models import Contact
from deals.models import Deal
from integrations.models import EmailProviderIntegration

from .models import Lead


class LeadDetailActionsTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="owner@example.com",
            password="StrongPass123",
            is_active=True,
        )
        self.client.force_authenticate(self.user)
        self.lead = Lead.objects.create(
            first_name="James",
            last_name="Merced",
            company="Kwik Kopy Printing",
            title="Procurement Head",
            email="james@example.com",
            phone="1234567890",
            mobile="9876543210",
            website="https://example.com",
            lead_source=Lead.LeadSource.WEB_DOWNLOAD,
            lead_status=Lead.LeadStatus.NEW,
            industry="Printing",
            annual_revenue="120000.00",
            employee_count=25,
            rating="Warm",
            owner=self.user,
            street="Main Street",
            city="Pune",
            state="MH",
            country="India",
            zip_code="411001",
            skype_id="james.m",
            secondary_email="james.secondary@example.com",
            description="Interested in a product demo.",
        )

    def test_retrieve_lead_detail_contains_required_fields(self):
        response = self.client.get(f"/api/leads/{self.lead.pk}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Procurement Head")
        self.assertEqual(response.data["lead_status"], Lead.LeadStatus.NEW)
        self.assertEqual(response.data["company"], "Kwik Kopy Printing")
        self.assertEqual(response.data["owner_name"], "owner@example.com")
        self.assertEqual(response.data["lead_name"], "James Merced")

    def test_create_lead_defaults_owner_to_authenticated_user(self):
        response = self.client.post(
            "/api/leads",
            {
                "first_name": "Boomika",
                "last_name": "M",
                "company": "Zora",
                "email": "boomika@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_lead = Lead.objects.get(pk=response.data["id"])
        self.assertEqual(created_lead.owner, self.user)
        self.assertEqual(response.data["owner_name"], "owner@example.com")

    def test_clone_creates_new_lead_and_timeline_entry(self):
        response = self.client.post(f"/api/leads/{self.lead.pk}/clone")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        cloned_lead = Lead.objects.get(pk=response.data["lead_id"])
        self.assertEqual(cloned_lead.company, self.lead.company)
        self.assertNotEqual(cloned_lead.email, self.lead.email)
        self.assertEqual(cloned_lead.activities.first().action, "Lead Cloned")

    def test_notes_endpoint_creates_and_lists_notes(self):
        create_response = self.client.post(
            f"/api/leads/{self.lead.pk}/notes",
            {"note": "Customer asked for a pricing follow-up."},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        list_response = self.client.get(f"/api/leads/{self.lead.pk}/notes")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["note"], "Customer asked for a pricing follow-up.")

    def test_convert_creates_account_contact_and_deal(self):
        response = self.client.post(
            f"/api/leads/{self.lead.pk}/convert",
            {
                "create_deal": True,
                "deal_name": "Kwik Kopy Expansion",
                "deal_value": "50000.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.lead_status, Lead.LeadStatus.CONVERTED)
        self.assertTrue(Account.objects.filter(pk=response.data["account_id"]).exists())
        self.assertTrue(Contact.objects.filter(pk=response.data["contact_id"]).exists())
        self.assertTrue(Deal.objects.filter(pk=response.data["deal_id"]).exists())
        self.assertEqual(self.lead.converted_account_id, response.data["account_id"])
        self.assertEqual(self.lead.converted_contact_id, response.data["contact_id"])
        self.assertEqual(self.lead.converted_deal_id, response.data["deal_id"])
        self.assertEqual(Deal.objects.get(pk=response.data["deal_id"]).stage, Deal.DealStage.QUALIFICATION)
        account = Account.objects.get(pk=response.data["account_id"])
        contact = Contact.objects.get(pk=response.data["contact_id"])
        deal = Deal.objects.get(pk=response.data["deal_id"])
        self.assertEqual(account.account_owner, self.user)
        self.assertEqual(contact.contact_owner, self.user)
        self.assertEqual(contact.account, account)
        self.assertEqual(deal.account, account)
        self.assertEqual(deal.contact, contact)
        self.assertEqual(deal.deal_owner, self.user)
        self.assertEqual(deal.deal_name, "Kwik Kopy Expansion")

    def test_timeline_lists_logged_activities(self):
        self.client.patch(
            f"/api/leads/{self.lead.pk}",
            {"lead_status": Lead.LeadStatus.CONTACTED},
            format="json",
        )

        response = self.client.get(f"/api/leads/{self.lead.pk}/timeline")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["action"], "Lead Updated")

    def test_convert_reuses_existing_account_by_company_name(self):
        existing_account = Account.objects.create(
            name="Kwik Kopy Printing",
            owner=self.user,
        )

        response = self.client.post(
            f"/api/leads/{self.lead.pk}/convert",
            {"create_deal": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["account_id"], existing_account.pk)
        self.assertEqual(Account.objects.filter(name="Kwik Kopy Printing").count(), 1)

    def test_convert_reuses_existing_contact_for_same_lead(self):
        account = Account.objects.create(name="Kwik Kopy Printing", owner=self.user)
        existing_contact = Contact.objects.create(
            first_name="James",
            last_name="Merced",
            email="james@example.com",
            account=account,
            contact_owner=self.user,
            created_from_lead=self.lead,
        )

        response = self.client.post(
            f"/api/leads/{self.lead.pk}/convert",
            {"create_deal": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["contact_id"], existing_contact.pk)
        self.assertEqual(Contact.objects.filter(created_from_lead=self.lead).count(), 1)

    def test_convert_requires_company_name(self):
        self.lead.company = ""
        self.lead.save(update_fields=["company"])

        response = self.client.post(
            f"/api/leads/{self.lead.pk}/convert",
            {"create_deal": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Account creation requires company.")

    def test_list_hides_bare_email_generated_placeholder_leads(self):
        placeholder = Lead.objects.create(
            first_name="Newsletter",
            last_name="Bot",
            company="Email Inbox",
            email="newsletter@example.com",
            owner=self.user,
            lead_source="Integration",
            lead_status="New",
        )
        placeholder.integration_source_events.create(
            source_type="email",
            source_reference="msg-1",
            payload={"subject": "Weekly newsletter"},
            status="processed",
        )

        response = self.client.get("/api/leads")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data["results"]}
        self.assertNotIn(placeholder.id, returned_ids)
        self.assertIn(self.lead.id, returned_ids)

    def test_list_keeps_enriched_integration_leads_visible(self):
        lead = Lead.objects.create(
            first_name="Prospect",
            last_name="One",
            company="Acme",
            email="prospect@example.com",
            owner=self.user,
            lead_source="Integration",
            lead_status="New",
            phone="9999999999",
        )
        lead.integration_source_events.create(
            source_type="email",
            source_reference="msg-2",
            payload={"subject": "Need CRM pricing"},
            status="processed",
        )

        response = self.client.get("/api/leads")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data["results"]}
        self.assertIn(lead.id, returned_ids)
