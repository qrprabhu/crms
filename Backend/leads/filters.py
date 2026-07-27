import django_filters
from .models import Lead

class LeadFilter(django_filters.FilterSet):
    class Meta:
        model = Lead
        # Explicitly specify the exact filter fields requested
        fields = ['lead_status', 'lead_source', 'industry', 'owner', 'created_at']
