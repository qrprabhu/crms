from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import filters, generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BusinessHours, ServiceDomainMapping, ServiceHoliday
from .serializers import (
    AppointmentSerializer,
    BusinessHoursSerializer,
    JobSheetSerializer,
    ServiceCompanyDetailsSerializer,
    ServiceDetailSerializer,
    ServiceDomainMappingSerializer,
    ServiceFiscalYearSettingSerializer,
    ServiceHierarchyPreferenceSerializer,
    ServiceHolidaySerializer,
    ServiceListSerializer,
    ServiceMemberAssignmentSerializer,
    ServiceUserLookupSerializer,
    ServiceWriteSerializer,
    ServicesModuleSettingsSerializer,
)
from .services import (
    cancel_appointment,
    create_or_update_appointment,
    create_or_update_job_sheet,
    delete_business_hours,
    enable_services,
    get_appointment,
    get_company_details,
    get_fiscal_year,
    get_hierarchy_preference,
    get_service,
    get_services_settings,
    build_service_operational_summary,
    list_appointments,
    list_business_hours,
    list_job_sheets,
    list_services,
    remove_service_member,
    reschedule_appointment,
    save_service_members,
    set_default_business_hours,
    update_services_settings,
    verify_domain_mapping,
)

User = get_user_model()


TEAM_TO_DEPARTMENT_MAP = {
    "sales": "sales",
    "support": "support",
    "general": "",
}


def get_assignable_users(user):
    queryset = User.objects.filter(is_active=True)
    role = getattr(user, "role", "")
    if role in ("admin", "sub_admin"):
        return queryset
    if role in ("manager", "team_lead"):
        return queryset.filter(Q(pk=user.pk) | Q(manager=user))
    return queryset.filter(pk=user.pk)


def _filter_users_by_delivery_team(queryset, team):
    if not team:
        return queryset
    if hasattr(User, "department"):
        return queryset.filter(department=TEAM_TO_DEPARTMENT_MAP.get(team, team))
    if hasattr(User, "team"):
        return queryset.filter(team=team)
    return queryset.none()


class ServicesAuthenticatedMixin:
    permission_classes = [IsAuthenticated]


class ServiceTeamMembersAPIView(ServicesAuthenticatedMixin, APIView):
    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        team = (request.query_params.get("team") or "").strip()
        service_id = (request.query_params.get("service_id") or "").strip()
        queryset = get_assignable_users(request.user).order_by("email")
        if service_id:
            service = get_service(service_id)
            team = service.delivery_team
        if team:
            queryset = _filter_users_by_delivery_team(queryset, team)
        if query:
            queryset = queryset.filter(email__icontains=query)
        queryset = queryset[:50]
        return Response(ServiceUserLookupSerializer(queryset, many=True).data)


class AppointmentSummaryAPIView(ServicesAuthenticatedMixin, APIView):
    def get(self, request):
        queryset = list_appointments()
        service_id = request.query_params.get("service")
        assigned_member = request.query_params.get("assigned_member")
        status_value = request.query_params.get("status")
        if service_id:
            queryset = queryset.filter(service_id=service_id)
        if assigned_member:
            queryset = queryset.filter(assigned_member_id=assigned_member)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return Response(build_service_operational_summary(queryset))


class ServicesSetupStatusAPIView(ServicesAuthenticatedMixin, APIView):
    def get(self, request):
        return Response(ServicesModuleSettingsSerializer(get_services_settings()).data)

    def patch(self, request):
        serializer = ServicesModuleSettingsSerializer(get_services_settings(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        settings_obj = update_services_settings(serializer.validated_data)
        return Response(ServicesModuleSettingsSerializer(settings_obj).data)


class ServicesEnableAPIView(ServicesAuthenticatedMixin, APIView):
    def post(self, request):
        settings_obj = enable_services()
        return Response(ServicesModuleSettingsSerializer(settings_obj).data)


class BusinessHoursListCreateAPIView(ServicesAuthenticatedMixin, generics.ListCreateAPIView):
    serializer_class = BusinessHoursSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "timezone"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name", "id"]

    def get_queryset(self):
        return list_business_hours()

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        if instance.is_default or not BusinessHours.objects.filter(is_active=True, is_default=True).exists():
            set_default_business_hours(instance)


class BusinessHoursDetailAPIView(ServicesAuthenticatedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BusinessHoursSerializer
    lookup_url_kwarg = "id"

    def get_queryset(self):
        return list_business_hours()

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.is_default:
            set_default_business_hours(instance)

    def perform_destroy(self, instance):
        delete_business_hours(instance)


class BusinessHoursSetDefaultAPIView(ServicesAuthenticatedMixin, APIView):
    def post(self, request, id):
        instance = list_business_hours().get(pk=id)
        return Response(BusinessHoursSerializer(set_default_business_hours(instance)).data)


class ServiceListCreateAPIView(ServicesAuthenticatedMixin, generics.ListCreateAPIView):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "business_hours", "location_type"]
    search_fields = ["service_code", "service_name", "description", "location"]
    ordering_fields = ["created_at", "updated_at", "service_code", "service_name", "price", "duration_minutes"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = list_services()
        member_id = self.request.query_params.get("member")
        if member_id:
            queryset = queryset.filter(member_assignments__member_id=member_id, member_assignments__is_active=True)
        return queryset

    def get_serializer_class(self):
        return ServiceListSerializer if self.request.method == "GET" else ServiceWriteSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = serializer.save(created_by=request.user, updated_by=request.user)
        return Response(ServiceDetailSerializer(service).data, status=status.HTTP_201_CREATED)


class ServiceDetailAPIView(ServicesAuthenticatedMixin, generics.RetrieveUpdateDestroyAPIView):
    lookup_url_kwarg = "id"

    def get_queryset(self):
        return list_services()

    def get_serializer_class(self):
        return ServiceDetailSerializer if self.request.method == "GET" else ServiceWriteSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save(updated_by=request.user)
        return Response(ServiceDetailSerializer(updated).data)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_active", "updated_by", "updated_at"])


class ServiceMembersAPIView(ServicesAuthenticatedMixin, APIView):
    def get(self, request, id):
        service = get_service(id)
        return Response(
            ServiceMemberAssignmentSerializer(service.member_assignments.filter(is_active=True), many=True).data
        )

    def post(self, request, id):
        service = get_service(id)
        member_ids = request.data.get("member_ids") or []
        primary_member_id = request.data.get("primary_member_id")
        if not isinstance(member_ids, list):
            return Response({"member_ids": ["Member ids must be provided as a list."]}, status=status.HTTP_400_BAD_REQUEST)
        valid_users = User.objects.filter(id__in=member_ids, is_active=True)
        if service.delivery_team:
            valid_users = _filter_users_by_delivery_team(valid_users, service.delivery_team)
        valid_member_ids = set(valid_users.values_list("id", flat=True))
        missing_ids = [member_id for member_id in member_ids if member_id not in valid_member_ids]
        if missing_ids:
            return Response(
                {"member_ids": [f"Invalid members for the selected delivery team: {', '.join(str(member_id) for member_id in missing_ids)}"]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if primary_member_id is not None and primary_member_id not in valid_member_ids:
            return Response({"primary_member_id": ["Primary member must be one of the selected active members."]}, status=status.HTTP_400_BAD_REQUEST)
        save_service_members(service, member_ids, primary_member_id)
        return Response(
            ServiceMemberAssignmentSerializer(service.member_assignments.filter(is_active=True), many=True).data,
            status=status.HTTP_200_OK,
        )


class ServiceMemberDetailAPIView(ServicesAuthenticatedMixin, APIView):
    def delete(self, request, id, assignment_id):
        service = get_service(id)
        remove_service_member(service, assignment_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AppointmentListCreateAPIView(ServicesAuthenticatedMixin, generics.ListCreateAPIView):
    serializer_class = AppointmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        "service",
        "status",
        "assigned_member",
        "appointment_for_type",
        "appointment_date",
        "product",
        "sales_order",
        "invoice",
        "coverage_type",
        "coverage_status",
    ]
    search_fields = [
        "appointment_number",
        "location",
        "notes",
        "customer_asset_name",
        "product_serial_number",
        "completion_notes",
        "sales_order__subject",
        "invoice__subject",
        "product__product_name",
    ]
    ordering_fields = ["appointment_date", "appointment_start_time", "created_at", "updated_at"]
    ordering = ["appointment_date", "appointment_start_time", "id"]

    def get_queryset(self):
        queryset = list_appointments()
        appointment_for_id = self.request.query_params.get("appointment_for_id")
        if appointment_for_id:
            queryset = queryset.filter(appointment_for_id=appointment_for_id)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = create_or_update_appointment(serializer, request.user)
        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)


class AppointmentDetailAPIView(ServicesAuthenticatedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AppointmentSerializer
    lookup_url_kwarg = "id"

    def get_queryset(self):
        return list_appointments()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        appointment = create_or_update_appointment(serializer, request.user)
        return Response(AppointmentSerializer(appointment).data)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_active", "updated_by", "updated_at"])


class AppointmentCancelAPIView(ServicesAuthenticatedMixin, APIView):
    def post(self, request, id):
        return Response(AppointmentSerializer(cancel_appointment(get_appointment(id), request.user)).data)


class AppointmentRescheduleAPIView(ServicesAuthenticatedMixin, APIView):
    def post(self, request, id):
        appointment = get_appointment(id)
        serializer = AppointmentSerializer(appointment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        payload = {
            "appointment_date": serializer.validated_data.get("appointment_date", appointment.appointment_date),
            "appointment_start_time": serializer.validated_data.get(
                "appointment_start_time",
                appointment.appointment_start_time,
            ),
            "appointment_end_time": serializer.validated_data.get(
                "appointment_end_time",
                appointment.appointment_end_time,
            ),
        }
        return Response(AppointmentSerializer(reschedule_appointment(appointment, payload, request.user)).data)


class JobSheetListCreateAPIView(ServicesAuthenticatedMixin, generics.ListCreateAPIView):
    serializer_class = JobSheetSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["service", "appointment", "status", "customer_type", "customer_id"]
    search_fields = ["title"]
    ordering_fields = ["created_at", "updated_at", "title"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return list_job_sheets()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job_sheet = create_or_update_job_sheet(serializer, request.user)
        return Response(JobSheetSerializer(job_sheet).data, status=status.HTTP_201_CREATED)


class JobSheetDetailAPIView(ServicesAuthenticatedMixin, generics.RetrieveUpdateAPIView):
    serializer_class = JobSheetSerializer
    lookup_url_kwarg = "id"

    def get_queryset(self):
        return list_job_sheets()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        job_sheet = create_or_update_job_sheet(serializer, request.user)
        return Response(JobSheetSerializer(job_sheet).data)


class CompanyDetailsAPIView(ServicesAuthenticatedMixin, APIView):
    def get(self, request):
        return Response(ServiceCompanyDetailsSerializer(get_company_details()).data)

    def put(self, request):
        details = get_company_details()
        serializer = ServiceCompanyDetailsSerializer(details, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        details = get_company_details()
        serializer = ServiceCompanyDetailsSerializer(details, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DomainMappingListCreateAPIView(ServicesAuthenticatedMixin, generics.ListCreateAPIView):
    serializer_class = ServiceDomainMappingSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["account_type", "verification_status"]
    search_fields = ["domain", "cname_target"]
    ordering_fields = ["created_at", "updated_at", "domain"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return ServiceDomainMapping.objects.filter(is_active=True)


class DomainMappingDetailAPIView(ServicesAuthenticatedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ServiceDomainMappingSerializer
    lookup_url_kwarg = "id"

    def get_queryset(self):
        return ServiceDomainMapping.objects.filter(is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class DomainMappingVerifyAPIView(ServicesAuthenticatedMixin, APIView):
    def post(self, request):
        mapping_id = request.data.get("id")
        if not mapping_id:
            return Response({"id": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        mapping = ServiceDomainMapping.objects.filter(pk=mapping_id, is_active=True).first()
        if not mapping:
            return Response({"id": ["Domain mapping not found."]}, status=status.HTTP_404_NOT_FOUND)
        return Response(ServiceDomainMappingSerializer(verify_domain_mapping(mapping)).data)


class FiscalYearAPIView(ServicesAuthenticatedMixin, APIView):
    def get(self, request):
        return Response(ServiceFiscalYearSettingSerializer(get_fiscal_year()).data)

    def put(self, request):
        fiscal_year = get_fiscal_year()
        serializer = ServiceFiscalYearSettingSerializer(fiscal_year, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        fiscal_year = get_fiscal_year()
        serializer = ServiceFiscalYearSettingSerializer(fiscal_year, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class HolidayListCreateAPIView(ServicesAuthenticatedMixin, generics.ListCreateAPIView):
    serializer_class = ServiceHolidaySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["date"]
    search_fields = ["name", "description"]
    ordering_fields = ["date", "created_at", "updated_at", "name"]
    ordering = ["date", "id"]

    def get_queryset(self):
        return ServiceHoliday.objects.filter(is_active=True)


class HolidayDetailAPIView(ServicesAuthenticatedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ServiceHolidaySerializer
    lookup_url_kwarg = "id"

    def get_queryset(self):
        return ServiceHoliday.objects.filter(is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class HierarchyPreferenceAPIView(ServicesAuthenticatedMixin, APIView):
    def get(self, request):
        return Response(ServiceHierarchyPreferenceSerializer(get_hierarchy_preference()).data)

    def put(self, request):
        preference = get_hierarchy_preference()
        serializer = ServiceHierarchyPreferenceSerializer(preference, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        preference = get_hierarchy_preference()
        serializer = ServiceHierarchyPreferenceSerializer(preference, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
