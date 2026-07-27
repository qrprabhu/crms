import django_filters

from .models import Contact


class ContactFilter(django_filters.FilterSet):
    owner = django_filters.NumberFilter(field_name="contact_owner_id")
    account = django_filters.NumberFilter(field_name="account_id")
    lead_source = django_filters.CharFilter(field_name="lead_source", lookup_expr="iexact")
    created_date = django_filters.DateFromToRangeFilter(field_name="created_at")
    activities = django_filters.BooleanFilter(method="filter_has_activities")
    campaigns = django_filters.CharFilter(method="filter_campaigns")

    class Meta:
        model = Contact
        fields = ["owner", "account", "lead_source", "created_date", "activities", "campaigns"]

    def filter_has_activities(self, queryset, name, value):
        if value is True:
            return queryset.filter(activities__isnull=False).distinct()
        if value is False:
            return queryset.filter(activities__isnull=True)
        return queryset

    def filter_campaigns(self, queryset, name, value):
        # Campaign support is schema-dependent in this codebase.
        # Apply the filter only when campaign relations/fields exist.
        if "campaigns" in [field.name for field in Contact._meta.get_fields()]:
            return queryset.filter(campaigns__name__icontains=value).distinct()
        if "campaign" in [field.name for field in Contact._meta.get_fields()]:
            return queryset.filter(campaign__icontains=value)
        return queryset

