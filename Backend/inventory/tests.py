from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
from contacts.models import Contact
from deals.models import Deal, DealStage
from deals.services import ensure_default_stages

from .models import InventoryLinkedRecord, PriceBook, Product, Quote, Vendor


class InventoryLinkingTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="inventory@example.com",
            password="StrongPass123",
            is_active=True,
        )
        self.client.force_authenticate(self.user)
        ensure_default_stages()
        self.stage = DealStage.objects.get(stage_name="Qualification")
        self.account = Account.objects.create(
            account_name="Zora",
            account_number="ACC-1001",
            account_owner=self.user,
        )
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
            product_name="CRM Suite",
            product_code="CRM-SUITE-001",
            unit_price="50000.00",
            tax="2500.00",
        )
        self.price_book = PriceBook.objects.create(
            owner=self.user,
            name="Enterprise Pricing",
            pricing_model=PriceBook.PricingModel.FIXED,
        )

    def test_price_book_product_endpoint_adds_and_lists_products(self):
        create_response = self.client.post(
            f"/api/price-books/{self.price_book.pk}/products",
            {
                "product": self.product.pk,
                "list_price": "47000.00",
                "active": True,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        list_response = self.client.get(f"/api/price-books/{self.price_book.pk}/products")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["id"], self.product.pk)

    def test_quote_create_links_price_book_and_product_records(self):
        self.client.post(
            f"/api/price-books/{self.price_book.pk}/products",
            {
                "product": self.product.pk,
                "list_price": "47000.00",
                "active": True,
            },
            format="json",
        )

        response = self.client.post(
            "/api/quotes",
            {
                "subject": "Zora Quote",
                "quote_stage": "Draft",
                "price_book": self.price_book.pk,
                "account": self.account.pk,
                "contact": self.contact.pk,
                "deal": self.deal.pk,
                "items": [
                    {
                        "product": self.product.pk,
                        "quantity": "2",
                        "list_price": "0",
                        "discount": "0",
                        "tax": "0",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        quote = Quote.objects.get(pk=response.data["id"])
        self.assertEqual(quote.price_book, self.price_book)
        self.assertEqual(response.data["price_book_name"], "Enterprise Pricing")
        self.assertEqual(str(quote.items.get().list_price), "47000.00")
        self.assertTrue(
            InventoryLinkedRecord.objects.filter(
                quote=quote,
                product=self.product,
                account=self.account,
                contact=self.contact,
                deal=self.deal,
            ).exists()
        )

    def test_sales_order_and_invoice_can_inherit_from_source_documents(self):
        quote_response = self.client.post(
            "/api/quotes",
            {
                "subject": "Zora Quote",
                "quote_stage": "Draft",
                "account": self.account.pk,
                "contact": self.contact.pk,
                "deal": self.deal.pk,
                "items": [
                    {
                        "product": self.product.pk,
                        "quantity": "1",
                        "list_price": "50000.00",
                        "discount": "0",
                        "tax": "2500.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(quote_response.status_code, status.HTTP_201_CREATED)

        sales_order_response = self.client.post(
            "/api/sales-orders",
            {
                "subject": "Zora Sales Order",
                "quote": quote_response.data["id"],
                "status": "Created",
            },
            format="json",
        )
        self.assertEqual(sales_order_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(sales_order_response.data["account_name"], "Zora")
        self.assertEqual(sales_order_response.data["contact_name"], "Boomika M")
        self.assertEqual(sales_order_response.data["customer_no"], "ACC-1001")

        invoice_response = self.client.post(
            "/api/invoices",
            {
                "subject": "Zora Invoice",
                "sales_order": sales_order_response.data["id"],
                "status": "Draft",
            },
            format="json",
        )
        self.assertEqual(invoice_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(invoice_response.data["account_name"], "Zora")
        self.assertEqual(invoice_response.data["contact_name"], "Boomika M")
        self.assertEqual(len(invoice_response.data["items"]), 1)

    def test_sales_order_customer_number_defaults_from_account(self):
        response = self.client.post(
            "/api/sales-orders",
            {
                "subject": "Zora Sales Order",
                "account": self.account.pk,
                "contact": self.contact.pk,
                "deal": self.deal.pk,
                "status": "Created",
                "items": [
                    {
                        "product": self.product.pk,
                        "quantity": "1",
                        "list_price": "50000.00",
                        "discount": "0",
                        "tax": "2500.00",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["customer_no"], "ACC-1001")

    def test_purchase_order_po_number_auto_generates(self):
        vendor = Vendor.objects.create(vendor_name="Zora Supplier Pvt Ltd")
        response = self.client.post(
            "/api/purchase-orders",
            {
                "subject": "Zora Purchase Order",
                "vendor": vendor.pk,
                "status": "Draft",
                "items": [
                    {
                        "product": self.product.pk,
                        "quantity": "1",
                        "list_price": "50000.00",
                        "discount": "0",
                        "tax": "2500.00",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(str(response.data["po_number"]).startswith("PO"))

    def test_inventory_documents_apply_default_statuses_when_blank(self):
        sales_order_response = self.client.post(
            "/api/sales-orders",
            {
                "subject": "Default Sales Order",
                "account": self.account.pk,
                "contact": self.contact.pk,
                "deal": self.deal.pk,
                "items": [
                    {
                        "product": self.product.pk,
                        "quantity": "1",
                        "list_price": "50000.00",
                        "discount": "0",
                        "tax": "2500.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(sales_order_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(sales_order_response.data["status"], "Created")

        vendor = Vendor.objects.create(vendor_name="Default Vendor")
        purchase_order_response = self.client.post(
            "/api/purchase-orders",
            {
                "subject": "Default Purchase Order",
                "vendor": vendor.pk,
                "items": [
                    {
                        "product": self.product.pk,
                        "quantity": "1",
                        "list_price": "50000.00",
                        "discount": "0",
                        "tax": "2500.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(purchase_order_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(purchase_order_response.data["status"], "Draft")

        invoice_response = self.client.post(
            "/api/invoices",
            {
                "subject": "Default Invoice",
                "sales_order": sales_order_response.data["id"],
            },
            format="json",
        )
        self.assertEqual(invoice_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(invoice_response.data["status"], "Draft")
        self.assertTrue(invoice_response.data["invoice_date"])
        self.assertTrue(invoice_response.data["due_date"])

    def test_product_related_quote_endpoint_returns_linked_quotes(self):
        quote = Quote.objects.create(
            owner=self.user,
            subject="Product Linked Quote",
            account=self.account,
            contact=self.contact,
            deal=self.deal,
        )
        quote.items.create(
            product=self.product,
            quantity="1",
            list_price="50000.00",
            amount="50000.00",
            discount="0.00",
            tax="2500.00",
            total="52500.00",
        )

        response = self.client.get(f"/api/products/{self.product.pk}/quotes")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["subject"], "Product Linked Quote")

    def test_product_create_auto_generates_prd_code(self):
        existing_count = Product.objects.count()
        response = self.client.post(
            "/api/products",
            {
                "product_name": "Auto Code Product",
                "unit_price": "1200.00",
                "tax": "120.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["product_code"], f"PRD{existing_count + 2:04d}")

        second_response = self.client.post(
            "/api/products",
            {
                "product_name": "Auto Code Product 2",
                "unit_price": "2200.00",
                "tax": "220.00",
            },
            format="json",
        )

        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.data["product_code"], f"PRD{existing_count + 3:04d}")
