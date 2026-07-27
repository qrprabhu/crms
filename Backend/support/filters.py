from __future__ import annotations

import django_filters
from django.db.models import Q

from .models import SupportCase, SupportSolution


class SupportCaseFilter(django_filters.FilterSet):
    account_name = django_filters.CharFilter(field_name="account__account_name", lookup_expr="icontains")
    case_number = django_filters.CharFilter(field_name="case_number", lookup_expr="icontains")
    case_origin = django_filters.CharFilter(field_name="case_origin", lookup_expr="iexact")
    case_owner = django_filters.NumberFilter(field_name="owner_id")
    case_reason = django_filters.CharFilter(field_name="case_reason", lookup_expr="icontains")
    company = django_filters.CharFilter(field_name="company", lookup_expr="icontains")
    connected_to = django_filters.CharFilter(method="filter_connected_to")
    country = django_filters.CharFilter(field_name="country", lookup_expr="icontains")
    created_by = django_filters.NumberFilter(field_name="created_by_id")
    created_time = django_filters.DateFromToRangeFilter(field_name="created_at")
    deal_name = django_filters.CharFilter(field_name="deal__deal_name", lookup_expr="icontains")
    email = django_filters.CharFilter(field_name="email", lookup_expr="icontains")
    last_activity_time = django_filters.DateFromToRangeFilter(field_name="last_activity_at")
    priority = django_filters.CharFilter(field_name="priority", lookup_expr="iexact")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    related_contact = django_filters.NumberFilter(field_name="related_contact_id")
    owner = django_filters.NumberFilter(field_name="owner_id")
    product = django_filters.NumberFilter(field_name="product_id")
    account = django_filters.NumberFilter(field_name="account_id")
    deal = django_filters.NumberFilter(field_name="deal_id")
    lead = django_filters.NumberFilter(field_name="lead_id")

    class Meta:
        model = SupportCase
        fields = [
            "account_name",
            "case_number",
            "case_origin",
            "case_owner",
            "case_reason",
            "company",
            "connected_to",
            "country",
            "created_by",
            "created_time",
            "deal_name",
            "email",
            "last_activity_time",
            "priority",
            "status",
            "related_contact",
            "owner",
            "product",
            "account",
            "deal",
            "lead",
        ]

    def filter_connected_to(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(related_contact__first_name__icontains=value)
            | Q(related_contact__last_name__icontains=value)
            | Q(account__account_name__icontains=value)
            | Q(deal__deal_name__icontains=value)
            | Q(product__product_name__icontains=value)
            | Q(lead__first_name__icontains=value)
            | Q(lead__last_name__icontains=value)
        ).distinct()


class SupportSolutionFilter(django_filters.FilterSet):
    account = django_filters.NumberFilter(method="filter_account")
    contact = django_filters.NumberFilter(method="filter_contact")
    connected_to = django_filters.CharFilter(method="filter_connected_to")
    created_by = django_filters.NumberFilter(field_name="created_by_id")
    deal = django_filters.NumberFilter(method="filter_deal")
    created_time = django_filters.DateFromToRangeFilter(field_name="created_at")
    last_activity_time = django_filters.DateFromToRangeFilter(field_name="last_activity_at")
    modified_by = django_filters.NumberFilter(field_name="updated_by_id")
    modified_time = django_filters.DateFromToRangeFilter(field_name="updated_at")
    no_of_comments = django_filters.RangeFilter(field_name="no_of_comments")
    product = django_filters.NumberFilter(field_name="product_id")
    product_name = django_filters.CharFilter(field_name="product__product_name", lookup_expr="icontains")
    solution_number = django_filters.CharFilter(field_name="solution_number", lookup_expr="icontains")
    solution_owner = django_filters.NumberFilter(field_name="owner_id")
    solution_title = django_filters.CharFilter(field_name="solution_title", lookup_expr="icontains")
    source_case = django_filters.NumberFilter(field_name="source_case_id")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    vendor = django_filters.NumberFilter(field_name="linked_records__vendor_id")
    lead = django_filters.NumberFilter(method="filter_lead")

    class Meta:
        model = SupportSolution
        fields = [
            "account",
            "contact",
            "connected_to",
            "created_by",
            "created_time",
            "deal",
            "last_activity_time",
            "modified_by",
            "modified_time",
            "no_of_comments",
            "product",
            "product_name",
            "solution_number",
            "solution_owner",
            "solution_title",
            "source_case",
            "status",
            "vendor",
            "lead",
        ]

    def filter_connected_to(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(linked_records__account__account_name__icontains=value)
            | Q(linked_records__contact__first_name__icontains=value)
            | Q(linked_records__contact__last_name__icontains=value)
            | Q(linked_records__deal__deal_name__icontains=value)
            | Q(linked_records__product__product_name__icontains=value)
            | Q(linked_records__vendor__vendor_name__icontains=value)
            | Q(linked_records__lead__first_name__icontains=value)
            | Q(linked_records__lead__last_name__icontains=value)
        ).distinct()

    def filter_account(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(linked_records__account_id=value) | Q(source_case__account_id=value)
        ).distinct()

    def filter_contact(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(linked_records__contact_id=value) | Q(source_case__related_contact_id=value)
        ).distinct()

    def filter_deal(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(linked_records__deal_id=value) | Q(source_case__deal_id=value)
        ).distinct()

    def filter_lead(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(linked_records__lead_id=value) | Q(source_case__lead_id=value)
        ).distinct()
