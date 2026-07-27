import django_filters

from .models import Deal


class DealFilter(django_filters.FilterSet):
    account = django_filters.NumberFilter(field_name="account_id")
    contact = django_filters.NumberFilter(field_name="contact_id")
    stage = django_filters.CharFilter(field_name="stage__stage_name", lookup_expr="iexact")
    owner = django_filters.NumberFilter(field_name="deal_owner_id")
    closing_date = django_filters.DateFromToRangeFilter(field_name="closing_date")
    amount = django_filters.RangeFilter(field_name="amount")
    campaign_source = django_filters.CharFilter(field_name="campaign_source", lookup_expr="icontains")

    class Meta:
        model = Deal
        fields = ["account", "contact", "stage", "owner", "closing_date", "amount", "campaign_source"]

