from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
from contacts.models import Contact
from deals.models import Deal, DealStage
from deals.services import ensure_default_stages
from inventory.models import Product

from .models import SupportCase, SupportLinkedRecord, SupportSolution


class SupportSmartDefaultsTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="support@example.com",
            password="StrongPass123",
            is_active=True,
        )
        self.client.force_authenticate(self.user)
        ensure_default_stages()
        self.stage = DealStage.objects.get(stage_name="Qualification")
        self.account = Account.objects.create(account_name="Zora", account_owner=self.user)
        self.contact = Contact.objects.create(
            first_name="Boomika",
            last_name="M",
            email="boomika@example.com",
            phone="9876543210",
            account=self.account,
            contact_owner=self.user,
        )
        self.deal = Deal.objects.create(
            deal_name="Zora - Boomika Deal",
            account=self.account,
            contact=self.contact,
            deal_owner=self.user,
            stage=self.stage,
            probability=self.stage.probability,
        )
        self.product = Product.objects.create(
            owner=self.user,
            product_name="CRM Software License",
            product_code="CRM-LIC-001",
            unit_price="50000.00",
        )

    def test_case_creation_auto_generates_defaults_and_links(self):
        response = self.client.post(
            "/api/cases",
            {
                "related_contact": self.contact.pk,
                "product": self.product.pk,
                "type": "Complaint",
                "subject": "CRM Software License Issue - Boomika",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        case = SupportCase.objects.get(pk=response.data["id"])
        self.assertEqual(case.case_number, "CAS0001")
        self.assertEqual(case.owner, self.user)
        self.assertEqual(case.status, "Open")
        self.assertEqual(case.priority, "Medium")
        self.assertEqual(case.case_origin, "Web")
        self.assertEqual(case.case_reason, "Product Issue")
        self.assertEqual(case.account, self.account)
        self.assertEqual(case.deal, self.deal)
        self.assertEqual(case.email, "boomika@example.com")
        self.assertEqual(case.phone, "9876543210")
        self.assertTrue(
            SupportLinkedRecord.objects.filter(
                case=case,
                contact=self.contact,
                account=self.account,
                deal=self.deal,
                product=self.product,
            ).exists()
        )

    def test_solution_creation_from_case_autofills_relationships(self):
        case = SupportCase.objects.create(
            subject="CRM Software License Issue - Boomika",
            owner=self.user,
            product=self.product,
            related_contact=self.contact,
            account=self.account,
            deal=self.deal,
        )

        response = self.client.post(
            "/api/solutions",
            {
                "source_case": case.pk,
                "solution_title": "CRM Software License - Issue Resolution",
                "question": "CRM Software License Issue - Boomika",
                "answer": "Restart the license sync and refresh the portal.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        solution = SupportSolution.objects.get(pk=response.data["id"])
        self.assertEqual(solution.solution_number, "SOL0001")
        self.assertEqual(solution.owner, self.user)
        self.assertEqual(solution.status, "Draft")
        self.assertEqual(solution.product, self.product)
        self.assertEqual(solution.source_case, case)
        self.assertTrue(
            SupportLinkedRecord.objects.filter(
                solution=solution,
                contact=self.contact,
                account=self.account,
                deal=self.deal,
                product=self.product,
            ).exists()
        )
