import django_filters

from .models import Account


class AccountFilter(django_filters.FilterSet):
    owner = django_filters.NumberFilter(field_name="account_owner_id")
    account_name = django_filters.CharFilter(field_name="account_name", lookup_expr="icontains")
    account_type = django_filters.CharFilter(field_name="account_type", lookup_expr="iexact")
    account_site = django_filters.CharFilter(field_name="account_site", lookup_expr="icontains")
    annual_revenue = django_filters.RangeFilter(field_name="annual_revenue")
    billing_address = django_filters.CharFilter(field_name="billing_address", lookup_expr="icontains")
    industry = django_filters.CharFilter(field_name="industry", lookup_expr="iexact")

    class Meta:
        model = Account
        fields = [
            "owner",
            "account_name",
            "account_type",
            "account_site",
            "annual_revenue",
            "billing_address",
            "industry",
        ]

