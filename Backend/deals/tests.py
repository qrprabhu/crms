from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
from contacts.models import Contact
from inventory.models import InventoryLinkedRecord, Product

from .models import Deal, DealStage
from .services import ensure_default_stages


class DealProductsTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="dealowner@example.com",
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
            product_name="CRM License",
            product_code="CRM-LIC-001",
            unit_price="50000.00",
        )

    def test_add_product_to_deal_creates_line_item_and_updates_total(self):
        response = self.client.post(
            f"/api/deals/{self.deal.pk}/products",
            {
                "product": self.product.pk,
                "quantity": "2",
                "unit_price": "50000.00",
                "discount": "5000.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.deal.refresh_from_db()
        self.assertEqual(str(self.deal.amount), "95000.00")
        self.assertEqual(str(self.deal.expected_revenue), "95000.00")
        self.assertEqual(
            InventoryLinkedRecord.objects.filter(
                product=self.product,
                deal=self.deal,
                account=self.account,
                contact=self.contact,
            ).count(),
            1,
        )

    def test_get_deal_products_returns_added_line_items(self):
        self.client.post(
            f"/api/deals/{self.deal.pk}/products",
            {
                "product": self.product.pk,
                "quantity": "1",
                "unit_price": "50000.00",
            },
            format="json",
        )

        response = self.client.get(f"/api/deals/{self.deal.pk}/products")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["product_name"], "CRM License")
        self.assertEqual(response.data[0]["product_code"], "CRM-LIC-001")
