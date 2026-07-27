import django_filters

from .models import Campaign


class CampaignFilter(django_filters.FilterSet):
    campaign_name = django_filters.CharFilter(field_name="campaign_name", lookup_expr="icontains")
    campaign_owner = django_filters.NumberFilter(field_name="campaign_owner_id")
    actual_cost = django_filters.RangeFilter(field_name="actual_cost")
    budgeted_cost = django_filters.RangeFilter(field_name="budgeted_cost")
    created_time = django_filters.DateFromToRangeFilter(field_name="created_at")
    end_date = django_filters.DateFromToRangeFilter(field_name="end_date")
    expected_response = django_filters.RangeFilter(field_name="expected_response")
    type = django_filters.CharFilter(field_name="type", lookup_expr="iexact")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    start_date = django_filters.DateFromToRangeFilter(field_name="start_date")

    class Meta:
        model = Campaign
        fields = [
            "campaign_name",
            "campaign_owner",
            "actual_cost",
            "budgeted_cost",
            "created_time",
            "end_date",
            "expected_response",
            "type",
            "status",
            "start_date",
        ]

