from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from .views import get_tenant_user_for_email


class TenantLookupTests(TestCase):
    @patch("authentication.views.configure_tenant_database_in_settings")
    @patch("authentication.views.User")
    @patch("authentication.views.Company")
    def test_get_tenant_user_for_email_configures_tenant_db_before_lookup(
        self,
        company_model,
        user_model,
        configure_tenant_database,
    ):
        from types import SimpleNamespace
        from unittest.mock import MagicMock

        company = SimpleNamespace(db_name="tenant_acme", status="Active")
        tenant_user = SimpleNamespace(email="client@example.com", is_active=True, is_admin=True)

        company_model.objects.filter.return_value = [company]
        queryset = MagicMock()
        queryset.filter.return_value = queryset
        queryset.first.return_value = tenant_user
        user_model.objects.using.return_value = queryset

        db_name, user = get_tenant_user_for_email("client@example.com")

        self.assertEqual(db_name, "tenant_acme")
        self.assertEqual(user, tenant_user)
        configure_tenant_database.assert_called_once_with("tenant_acme")
        user_model.objects.using.assert_called_once_with("tenant_acme")


class AuthenticationApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="client@example.com",
            password="StrongPass123",
            is_admin=True,
            is_active=True,
        )

    @patch("authentication.views.get_tokens_for_user")
    @patch("authentication.views.authenticate")
    @patch("authentication.views.get_tenant_user_for_email")
    def test_login_returns_tenant_context_for_client_credentials(
        self,
        tenant_lookup,
        mocked_authenticate,
        mocked_tokens,
    ):
        tenant_lookup.return_value = ("tenant_client_one", self.user)
        mocked_authenticate.return_value = self.user
        mocked_tokens.return_value = {
            "access_token": "access-token",
            "refresh_token": "refresh-token",
        }

        response = self.client.post(
            "/api/auth/login",
            {"email": "client@example.com", "password": "StrongPass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["tenant_db"], "tenant_client_one")
        self.assertEqual(response.data["data"]["user"]["email"], "client@example.com")
