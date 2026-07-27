from __future__ import annotations

from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from accounts.models import Account
from contacts.models import Contact
from deals.models import Deal
from inventory.models import Invoice, Product, SalesOrder
from leads.models import Lead
from support.models import SupportCase

from .models import (
    BusinessHours,
    CRMService,
    ServiceAppointment,
    ServiceCompanyDetails,
    ServiceDomainMapping,
    ServiceFiscalYearSetting,
    ServiceHierarchyPreference,
    ServiceHoliday,
    ServiceJobSheet,
    ServiceJobSheetField,
    ServiceMemberAssignment,
    ServicesModuleSettings,
)
from .services import (
    build_service_operational_summary,
    get_appointment_public_booking_url,
    get_first_product_for_document,
    get_business_hours_payload,
    get_fiscal_year_context,
    get_linked_record,
    get_public_booking_base_url,
    get_service_business_hours,
    get_service_public_booking_url,
)

User = get_user_model()


def _active_queryset(model):
    queryset = model.objects.all()
    if any(field.name == "is_active" for field in model._meta.fields):
        queryset = queryset.filter(is_active=True)
    return queryset


def _record_exists(model, pk):
    if not model or not pk:
        return False
    return _active_queryset(model).filter(pk=pk).exists()


class ServicesModuleSettingsSerializer(serializers.ModelSerializer):
    business_hours_configured = serializers.SerializerMethodField()
    fiscal_year_configured = serializers.SerializerMethodField()
    domain_mapping_configured = serializers.SerializerMethodField()
    company_details = serializers.SerializerMethodField()
    public_booking_base_url = serializers.SerializerMethodField()

    class Meta:
        model = ServicesModuleSettings
        fields = [
            "id",
            "is_services_enabled",
            "default_timezone",
            "hide_promo",
            "business_hours_configured",
            "fiscal_year_configured",
            "domain_mapping_configured",
            "company_details",
            "public_booking_base_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_business_hours_configured(self, obj):
        return BusinessHours.objects.filter(is_active=True).exists()

    def get_fiscal_year_configured(self, obj):
        return ServiceFiscalYearSetting.objects.filter(is_active=True).exists()

    def get_domain_mapping_configured(self, obj):
        return ServiceDomainMapping.objects.filter(
            is_active=True,
            verification_status=ServiceDomainMapping.VerificationStatus.VERIFIED,
        ).exists()

    def get_company_details(self, obj):
        details = ServiceCompanyDetails.objects.filter(is_active=True).order_by("id").first()
        if details:
            return {
                "company_name": details.company_name,
                "company_email": details.company_email,
                "contact_person": details.contact_person,
                "phone": details.phone,
                "address": details.address,
            }
        return None

    def get_public_booking_base_url(self, obj):
        return get_public_booking_base_url()


class ServiceUserLookupSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    team = serializers.SerializerMethodField()
    team_label = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()

    def get_label(self, obj):
        if hasattr(obj, "email"):
            return obj.email
        return obj.get("email")

    def get_team(self, obj):
        if hasattr(obj, "department"):
            return obj.department or "general"
        if hasattr(obj, "team"):
            return obj.team
        return obj.get("team", "general")

    def get_team_label(self, obj):
        if hasattr(obj, "get_department_display"):
            return obj.get_department_display() if obj.department else "General"
        if hasattr(obj, "get_team_display"):
            return obj.get_team_display()
        return obj.get("team_label") or obj.get("team") or "General"


class BusinessHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessHours
        fields = [
            "id",
            "name",
            "timezone",
            "is_default",
            "monday_enabled",
            "monday_start",
            "monday_end",
            "tuesday_enabled",
            "tuesday_start",
            "tuesday_end",
            "wednesday_enabled",
            "wednesday_start",
            "wednesday_end",
            "thursday_enabled",
            "thursday_start",
            "thursday_end",
            "friday_enabled",
            "friday_start",
            "friday_end",
            "saturday_enabled",
            "saturday_start",
            "saturday_end",
            "sunday_enabled",
            "sunday_start",
            "sunday_end",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        instance = self.instance
        for day in (
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ):
            enabled = attrs.get(f"{day}_enabled", getattr(instance, f"{day}_enabled", False) if instance else False)
            start = attrs.get(f"{day}_start", getattr(instance, f"{day}_start", None) if instance else None)
            end = attrs.get(f"{day}_end", getattr(instance, f"{day}_end", None) if instance else None)
            if enabled:
                if not start or not end:
                    raise serializers.ValidationError(
                        {f"{day}_start": f"{day.title()} start and end times are required when enabled."}
                    )
                if start >= end:
                    raise serializers.ValidationError({f"{day}_end": f"{day.title()} end time must be after start time."})
            elif start or end:
                raise serializers.ValidationError(
                    {f"{day}_start": f"{day.title()} start/end must be empty when the day is disabled."}
                )
        return attrs


class ServiceMemberAssignmentSerializer(serializers.ModelSerializer):
    member_email = serializers.SerializerMethodField()

    class Meta:
        model = ServiceMemberAssignment
        fields = ["id", "service", "member", "member_email", "is_primary", "created_at", "updated_at"]
        read_only_fields = ["service", "created_at", "updated_at", "member_email"]

    def get_member_email(self, obj):
        return getattr(obj.member, "email", None)


class ServiceListSerializer(serializers.ModelSerializer):
    members_count = serializers.IntegerField(read_only=True)
    business_hours_name = serializers.SerializerMethodField()
    business_hours_timezone = serializers.SerializerMethodField()
    location_behavior = serializers.SerializerMethodField()
    public_booking_url = serializers.SerializerMethodField()

    class Meta:
        model = CRMService
        fields = [
            "id",
            "service_code",
            "service_name",
            "price",
            "duration_minutes",
            "location_type",
            "location",
            "status",
            "delivery_team",
            "available_days_mode",
            "available_time_mode",
            "business_hours",
            "business_hours_name",
            "business_hours_timezone",
            "members_count",
            "location_behavior",
            "public_booking_url",
            "created_at",
            "updated_at",
        ]

    def get_business_hours_name(self, obj):
        business_hours = get_service_business_hours(obj)
        return business_hours.name if business_hours else None

    def get_business_hours_timezone(self, obj):
        business_hours = get_service_business_hours(obj)
        return business_hours.timezone if business_hours else None

    def get_location_behavior(self, obj):
        if obj.location_type == CRMService.LocationType.REMOTE:
            return "online"
        if obj.location_type == CRMService.LocationType.HYBRID:
            return "hybrid"
        return "offline"

    def get_public_booking_url(self, obj):
        return get_service_public_booking_url(obj)


class ServiceWriteSerializer(serializers.ModelSerializer):
    business_hours = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(BusinessHours),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = CRMService
        fields = [
            "id",
            "service_code",
            "service_name",
            "description",
            "price",
            "duration_minutes",
            "location_type",
            "location",
            "status",
            "delivery_team",
            "available_days_mode",
            "available_time_mode",
            "business_hours",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["service_code", "created_by", "updated_by", "created_at", "updated_at"]

    def validate_service_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Service name is required.")
        return value

    def validate_price(self, value):
        if value is None:
            raise serializers.ValidationError("Price is required.")
        if value < 0:
            raise serializers.ValidationError("Price must be greater than or equal to 0.")
        return value

    def validate_duration_minutes(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Duration must be a positive number of minutes.")
        return value

    def validate(self, attrs):
        business_hours = attrs.get("business_hours", getattr(self.instance, "business_hours", None))
        available_days_mode = attrs.get("available_days_mode", getattr(self.instance, "available_days_mode", None))
        available_time_mode = attrs.get("available_time_mode", getattr(self.instance, "available_time_mode", None))
        location_type = attrs.get("location_type", getattr(self.instance, "location_type", None))
        location = (attrs.get("location", getattr(self.instance, "location", "")) or "").strip()

        if (available_days_mode == CRMService.AvailabilityMode.BUSINESS_HOURS or available_time_mode == CRMService.AvailabilityMode.BUSINESS_HOURS) and not business_hours:
            default_hours = BusinessHours.objects.filter(is_active=True, is_default=True).first()
            if default_hours:
                attrs["business_hours"] = default_hours

        if location_type == CRMService.LocationType.REMOTE and not location:
            attrs["location"] = "Virtual meeting"
        elif location_type == CRMService.LocationType.HYBRID and not location:
            attrs["location"] = "Hybrid service"

        return attrs


class ServiceDetailSerializer(ServiceWriteSerializer):
    members = serializers.SerializerMethodField()
    members_count = serializers.SerializerMethodField()
    business_hours_name = serializers.SerializerMethodField()
    business_hours_timezone = serializers.SerializerMethodField()
    business_hours_details = serializers.SerializerMethodField()
    location_behavior = serializers.SerializerMethodField()
    public_booking_url = serializers.SerializerMethodField()

    class Meta(ServiceWriteSerializer.Meta):
        fields = ServiceWriteSerializer.Meta.fields + [
            "members",
            "members_count",
            "business_hours_name",
            "business_hours_timezone",
            "business_hours_details",
            "location_behavior",
            "public_booking_url",
            "delivery_team",
        ]

    def get_members(self, obj):
        assignments = obj.member_assignments.filter(is_active=True).select_related("member")
        return ServiceMemberAssignmentSerializer(assignments, many=True).data

    def get_members_count(self, obj):
        return getattr(obj, "members_count", None) or obj.member_assignments.filter(is_active=True).count()

    def get_business_hours_name(self, obj):
        business_hours = get_service_business_hours(obj)
        return business_hours.name if business_hours else None

    def get_business_hours_timezone(self, obj):
        business_hours = get_service_business_hours(obj)
        return business_hours.timezone if business_hours else None

    def get_business_hours_details(self, obj):
        return get_business_hours_payload(get_service_business_hours(obj))

    def get_location_behavior(self, obj):
        if obj.location_type == CRMService.LocationType.REMOTE:
            return "online"
        if obj.location_type == CRMService.LocationType.HYBRID:
            return "hybrid"
        return "offline"

    def get_public_booking_url(self, obj):
        return get_service_public_booking_url(obj)


class AppointmentSerializer(serializers.ModelSerializer):
    service = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(CRMService))
    assigned_member = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(User),
        allow_null=True,
        required=False,
    )
    product = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Product),
        allow_null=True,
        required=False,
    )
    sales_order = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(SalesOrder),
        allow_null=True,
        required=False,
    )
    invoice = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(Invoice),
        allow_null=True,
        required=False,
    )
    service_name = serializers.SerializerMethodField()
    service_duration_minutes = serializers.SerializerMethodField()
    business_hours_name = serializers.SerializerMethodField()
    business_hours_timezone = serializers.SerializerMethodField()
    business_hours_details = serializers.SerializerMethodField()
    location_type = serializers.SerializerMethodField()
    assigned_member_email = serializers.SerializerMethodField()
    appointment_for_display = serializers.SerializerMethodField()
    public_booking_url = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    sales_order_subject = serializers.SerializerMethodField()
    invoice_subject = serializers.SerializerMethodField()
    completion_proof_file_url = serializers.SerializerMethodField()
    completion_proof_file_name = serializers.SerializerMethodField()
    clear_completion_proof_file = serializers.BooleanField(required=False, write_only=True, default=False)

    class Meta:
        model = ServiceAppointment
        fields = [
            "id",
            "appointment_number",
            "service",
            "service_name",
            "service_duration_minutes",
            "business_hours_name",
            "business_hours_timezone",
            "business_hours_details",
            "location_type",
            "appointment_for_type",
            "appointment_for_id",
            "appointment_for_label",
            "appointment_for_display",
            "appointment_date",
            "appointment_start_time",
            "appointment_end_time",
            "assigned_member",
            "assigned_member_email",
            "product",
            "product_name",
            "sales_order",
            "sales_order_subject",
            "invoice",
            "invoice_subject",
            "customer_asset_name",
            "product_serial_number",
            "coverage_type",
            "coverage_status",
            "location",
            "status",
            "notes",
            "completion_notes",
            "completion_proof_url",
            "completion_proof_file",
            "completion_proof_file_url",
            "completion_proof_file_name",
            "clear_completion_proof_file",
            "completed_at",
            "public_booking_url",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "appointment_number",
            "service_name",
            "service_duration_minutes",
            "business_hours_name",
            "business_hours_timezone",
            "business_hours_details",
            "location_type",
            "assigned_member_email",
            "product_name",
            "sales_order_subject",
            "invoice_subject",
            "completion_proof_file_url",
            "completion_proof_file_name",
            "appointment_for_display",
            "public_booking_url",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        instance = self.instance
        clear_completion_proof_file = attrs.pop("clear_completion_proof_file", False)
        service = attrs.get("service", getattr(instance, "service", None))
        appointment_date = attrs.get("appointment_date", getattr(instance, "appointment_date", None))
        start_time = attrs.get("appointment_start_time", getattr(instance, "appointment_start_time", None))
        end_time = attrs.get("appointment_end_time", getattr(instance, "appointment_end_time", None))
        appointment_for_type = attrs.get("appointment_for_type", getattr(instance, "appointment_for_type", None))
        appointment_for_id = attrs.get("appointment_for_id", getattr(instance, "appointment_for_id", None))
        assigned_member = attrs.get("assigned_member", getattr(instance, "assigned_member", None))
        product = attrs.get("product", getattr(instance, "product", None))
        sales_order = attrs.get("sales_order", getattr(instance, "sales_order", None))
        invoice = attrs.get("invoice", getattr(instance, "invoice", None))
        status_value = attrs.get("status", getattr(instance, "status", ServiceAppointment.Status.SCHEDULED))
        coverage_type = attrs.get("coverage_type", getattr(instance, "coverage_type", ServiceAppointment.CoverageType.NONE))
        coverage_status = attrs.get(
            "coverage_status",
            getattr(instance, "coverage_status", ServiceAppointment.CoverageStatus.NOT_APPLICABLE),
        )

        if not service:
            raise serializers.ValidationError({"service": "Service is required."})
        if not appointment_date:
            raise serializers.ValidationError({"appointment_date": "Appointment date is required."})
        if not start_time:
            raise serializers.ValidationError({"appointment_start_time": "Appointment start time is required."})

        if not end_time:
            combined = datetime.combine(appointment_date, start_time) + timedelta(minutes=service.duration_minutes)
            attrs["appointment_end_time"] = combined.time()
            end_time = attrs["appointment_end_time"]

        if start_time >= end_time:
            raise serializers.ValidationError({"appointment_end_time": "Appointment end time must be after start time."})

        if appointment_for_type and appointment_for_type != ServiceAppointment.AppointmentForType.OTHER and not appointment_for_id:
            raise serializers.ValidationError({"appointment_for_id": "Appointment target is required."})
        if appointment_for_type == ServiceAppointment.AppointmentForType.OTHER:
            label = (attrs.get("appointment_for_label", getattr(instance, "appointment_for_label", "")) or "").strip()
            if not label:
                raise serializers.ValidationError({"appointment_for_label": "Appointment label is required for Other."})
            attrs["appointment_for_label"] = label
            attrs["appointment_for_id"] = None
        else:
            attrs["appointment_for_label"] = None
            model_map = {
                ServiceAppointment.AppointmentForType.CONTACT: Contact,
                ServiceAppointment.AppointmentForType.ACCOUNT: Account,
                ServiceAppointment.AppointmentForType.LEAD: Lead,
                ServiceAppointment.AppointmentForType.DEAL: Deal,
                ServiceAppointment.AppointmentForType.CASE: SupportCase,
                ServiceAppointment.AppointmentForType.PRODUCT: Product,
            }
            model = model_map.get(appointment_for_type)
            if appointment_for_type and not model:
                raise serializers.ValidationError({"appointment_for_type": "Unsupported appointment target type."})
            if model and not _record_exists(model, appointment_for_id):
                raise serializers.ValidationError({"appointment_for_id": "Appointment target not found."})

        if invoice and sales_order and invoice.sales_order_id and invoice.sales_order_id != sales_order.id:
            raise serializers.ValidationError({"invoice": "Selected invoice does not belong to the selected sales order."})

        if invoice and not sales_order and invoice.sales_order_id:
            attrs["sales_order"] = invoice.sales_order
            sales_order = invoice.sales_order

        if invoice and not appointment_for_id:
            if invoice.contact_id:
                attrs["appointment_for_type"] = ServiceAppointment.AppointmentForType.CONTACT
                attrs["appointment_for_id"] = invoice.contact_id
            elif invoice.account_id:
                attrs["appointment_for_type"] = ServiceAppointment.AppointmentForType.ACCOUNT
                attrs["appointment_for_id"] = invoice.account_id
            elif invoice.deal_id:
                attrs["appointment_for_type"] = ServiceAppointment.AppointmentForType.DEAL
                attrs["appointment_for_id"] = invoice.deal_id
            appointment_for_type = attrs.get("appointment_for_type", appointment_for_type)
            appointment_for_id = attrs.get("appointment_for_id", appointment_for_id)

        if sales_order and not appointment_for_id:
            if sales_order.contact_id:
                attrs["appointment_for_type"] = ServiceAppointment.AppointmentForType.CONTACT
                attrs["appointment_for_id"] = sales_order.contact_id
            elif sales_order.account_id:
                attrs["appointment_for_type"] = ServiceAppointment.AppointmentForType.ACCOUNT
                attrs["appointment_for_id"] = sales_order.account_id
            elif sales_order.deal_id:
                attrs["appointment_for_type"] = ServiceAppointment.AppointmentForType.DEAL
                attrs["appointment_for_id"] = sales_order.deal_id
            appointment_for_type = attrs.get("appointment_for_type", appointment_for_type)
            appointment_for_id = attrs.get("appointment_for_id", appointment_for_id)

        if not product:
            inferred_product = get_first_product_for_document(sales_order=sales_order, invoice=invoice)
            if inferred_product:
                attrs["product"] = inferred_product
                product = inferred_product

        if product and not attrs.get("customer_asset_name") and not getattr(instance, "customer_asset_name", None):
            attrs["customer_asset_name"] = product.product_name

        if product and coverage_type == ServiceAppointment.CoverageType.NONE:
            today = appointment_date or timezone.localdate()
            if product.support_expiry_date:
                attrs["coverage_type"] = ServiceAppointment.CoverageType.WARRANTY
                attrs["coverage_status"] = (
                    ServiceAppointment.CoverageStatus.ACTIVE
                    if product.support_expiry_date >= today
                    else ServiceAppointment.CoverageStatus.EXPIRED
                )
                coverage_type = attrs["coverage_type"]
                coverage_status = attrs["coverage_status"]

        if product and appointment_for_type == ServiceAppointment.AppointmentForType.PRODUCT and appointment_for_id:
            if product.id != appointment_for_id:
                raise serializers.ValidationError({"product": "Selected product must match the linked product record."})

        if product and appointment_for_type != ServiceAppointment.AppointmentForType.PRODUCT and not appointment_for_id:
            attrs["appointment_for_type"] = ServiceAppointment.AppointmentForType.PRODUCT
            attrs["appointment_for_id"] = product.id

        if coverage_type == ServiceAppointment.CoverageType.NONE:
            attrs["coverage_status"] = ServiceAppointment.CoverageStatus.NOT_APPLICABLE
        elif coverage_status == ServiceAppointment.CoverageStatus.NOT_APPLICABLE:
            raise serializers.ValidationError(
                {"coverage_status": "Choose an active, expired, or pending status for warranty/AMC/paid services."}
            )

        if assigned_member:
            assignment_exists = service.member_assignments.filter(member=assigned_member, is_active=True).exists()
            active_assignments = service.member_assignments.filter(is_active=True)
            if active_assignments.exists() and not assignment_exists:
                raise serializers.ValidationError(
                    {"assigned_member": "Assigned member must be a member of the selected service."}
                )
            assigned_team = getattr(assigned_member, "department", None)
            if assigned_team is None:
                assigned_team = getattr(assigned_member, "team", None)
            assigned_team = assigned_team or "general"
            if not active_assignments.exists() and assigned_team != service.delivery_team:
                raise serializers.ValidationError(
                    {"assigned_member": "Assigned member must belong to the selected service delivery team."}
                )

        if status_value in {
            ServiceAppointment.Status.IN_PROGRESS,
            ServiceAppointment.Status.COMPLETED,
            ServiceAppointment.Status.CLOSED,
        } and not assigned_member:
            raise serializers.ValidationError(
                {"assigned_member": "Assigned member is required before moving this service into execution or closure."}
            )

        completion_notes = (
            attrs.get("completion_notes", getattr(instance, "completion_notes", "")) or ""
        ).strip()
        if status_value in {
            ServiceAppointment.Status.COMPLETED,
            ServiceAppointment.Status.CLOSED,
        } and not completion_notes:
            raise serializers.ValidationError(
                {"completion_notes": "Completion notes are required when marking a service as completed or closed."}
            )
        if "completion_notes" in attrs:
            attrs["completion_notes"] = completion_notes or None

        if clear_completion_proof_file:
            attrs["completion_proof_file"] = None

        if status_value in {
            ServiceAppointment.Status.COMPLETED,
            ServiceAppointment.Status.CLOSED,
        }:
            attrs["completed_at"] = attrs.get("completed_at") or getattr(instance, "completed_at", None) or timezone.now()
        elif "completed_at" not in attrs and instance and instance.status not in {
            ServiceAppointment.Status.COMPLETED,
            ServiceAppointment.Status.CLOSED,
        }:
            attrs["completed_at"] = None

        return attrs

    def get_service_name(self, obj):
        return obj.service.service_name if obj.service else None

    def get_service_duration_minutes(self, obj):
        return obj.service.duration_minutes if obj.service else None

    def get_business_hours_name(self, obj):
        business_hours = get_service_business_hours(obj.service)
        return business_hours.name if business_hours else None

    def get_business_hours_timezone(self, obj):
        business_hours = get_service_business_hours(obj.service)
        return business_hours.timezone if business_hours else None

    def get_business_hours_details(self, obj):
        return get_business_hours_payload(get_service_business_hours(obj.service))

    def get_location_type(self, obj):
        return obj.service.location_type if obj.service else None

    def get_assigned_member_email(self, obj):
        return getattr(obj.assigned_member, "email", None)

    def get_product_name(self, obj):
        return getattr(obj.product, "product_name", None)

    def get_sales_order_subject(self, obj):
        return getattr(obj.sales_order, "subject", None)

    def get_invoice_subject(self, obj):
        return getattr(obj.invoice, "subject", None)

    def get_completion_proof_file_url(self, obj):
        request = self.context.get("request")
        if obj.completion_proof_file and request:
            return request.build_absolute_uri(obj.completion_proof_file.url)
        return str(obj.completion_proof_file) if obj.completion_proof_file else None

    def get_completion_proof_file_name(self, obj):
        return obj.completion_proof_file.name.split("/")[-1] if obj.completion_proof_file else None

    def get_appointment_for_display(self, obj):
        model_map = {
            ServiceAppointment.AppointmentForType.CONTACT: Contact,
            ServiceAppointment.AppointmentForType.ACCOUNT: Account,
            ServiceAppointment.AppointmentForType.LEAD: Lead,
            ServiceAppointment.AppointmentForType.DEAL: Deal,
            ServiceAppointment.AppointmentForType.CASE: SupportCase,
            ServiceAppointment.AppointmentForType.PRODUCT: Product,
        }
        model = model_map.get(obj.appointment_for_type)
        if obj.appointment_for_type == ServiceAppointment.AppointmentForType.OTHER:
            return obj.appointment_for_label or None
        if not model or not obj.appointment_for_id:
            return None
        record = get_linked_record(obj.appointment_for_type, obj.appointment_for_id)
        if not record:
            return None
        if isinstance(record, Contact):
            return f"{record.first_name} {record.last_name}".strip()
        if isinstance(record, Account):
            return record.account_name
        if isinstance(record, Lead):
            return f"{record.first_name} {record.last_name}".strip()
        if isinstance(record, Deal):
            return record.deal_name
        if isinstance(record, SupportCase):
            return record.case_number or record.subject
        if isinstance(record, Product):
            return record.product_name
        return str(record)

    def get_public_booking_url(self, obj):
        return get_appointment_public_booking_url(obj)


class JobSheetFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceJobSheetField
        fields = ["id", "field_name", "field_label", "field_type", "field_value", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate_field_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Field name is required.")
        return value

    def validate_field_label(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Field label is required.")
        return value


class JobSheetSerializer(serializers.ModelSerializer):
    service = serializers.PrimaryKeyRelatedField(queryset=_active_queryset(CRMService))
    appointment = serializers.PrimaryKeyRelatedField(
        queryset=_active_queryset(ServiceAppointment),
        allow_null=True,
        required=False,
    )
    fields = JobSheetFieldSerializer(many=True)
    service_name = serializers.SerializerMethodField()

    class Meta:
        model = ServiceJobSheet
        fields = [
            "id",
            "appointment",
            "service",
            "service_name",
            "customer_type",
            "customer_id",
            "title",
            "status",
            "fields",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_by", "updated_by", "created_at", "updated_at", "service_name"]

    def validate_title(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Title is required.")
        return value

    def validate(self, attrs):
        instance = self.instance
        service = attrs.get("service", getattr(instance, "service", None))
        appointment = attrs.get("appointment", getattr(instance, "appointment", None))
        customer_type = attrs.get("customer_type", getattr(instance, "customer_type", None))
        customer_id = attrs.get("customer_id", getattr(instance, "customer_id", None))

        if not service:
            raise serializers.ValidationError({"service": "Service is required."})

        if appointment and appointment.service_id != service.id:
            raise serializers.ValidationError({"appointment": "Appointment must belong to the selected service."})

        if bool(customer_type) != bool(customer_id):
            raise serializers.ValidationError(
                {"customer_type": "Customer type and customer id must either both be provided or both be empty."}
            )

        if customer_type and customer_id:
            model_map = {
                ServiceAppointment.AppointmentForType.CONTACT: Contact,
                ServiceAppointment.AppointmentForType.ACCOUNT: Account,
                ServiceAppointment.AppointmentForType.LEAD: Lead,
                ServiceAppointment.AppointmentForType.DEAL: Deal,
                ServiceAppointment.AppointmentForType.CASE: SupportCase,
                ServiceAppointment.AppointmentForType.PRODUCT: Product,
            }
            model = model_map.get(customer_type)
            if not model:
                raise serializers.ValidationError({"customer_type": "Unsupported customer type."})
            if not _record_exists(model, customer_id):
                raise serializers.ValidationError({"customer_id": "Customer record not found."})

        if appointment and not customer_type and appointment.appointment_for_type != ServiceAppointment.AppointmentForType.OTHER:
            attrs["customer_type"] = appointment.appointment_for_type
            attrs["customer_id"] = appointment.appointment_for_id

        return attrs

    def create(self, validated_data):
        fields = validated_data.pop("fields", [])
        job_sheet = ServiceJobSheet.objects.create(**validated_data)
        for field in fields:
            ServiceJobSheetField.objects.create(job_sheet=job_sheet, **field)
        return job_sheet

    def update(self, instance, validated_data):
        fields = validated_data.pop("fields", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if fields is not None:
            instance.fields.all().delete()
            for field in fields:
                ServiceJobSheetField.objects.create(job_sheet=instance, **field)
        return instance

    def get_service_name(self, obj):
        return obj.service.service_name if obj.service else None


class ServiceHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceHoliday
        fields = ["id", "name", "date", "description", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Holiday name is required.")
        return value

    def validate(self, attrs):
        instance = self.instance
        holiday_date = attrs.get("date", getattr(instance, "date", None))
        if ServiceHoliday.objects.filter(is_active=True, date=holiday_date).exclude(pk=getattr(instance, "pk", None)).exists():
            raise serializers.ValidationError({"date": "A holiday already exists for this date."})
        return attrs


class ServiceDomainMappingSerializer(serializers.ModelSerializer):
    public_booking_base_url = serializers.SerializerMethodField()

    class Meta:
        model = ServiceDomainMapping
        fields = [
            "id",
            "account_type",
            "domain",
            "cname_target",
            "verification_status",
            "public_booking_base_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["cname_target", "created_at", "updated_at"]

    def validate_domain(self, value):
        value = (value or "").strip().lower()
        if not value:
            raise serializers.ValidationError("Domain is required.")
        return value

    def get_public_booking_base_url(self, obj):
        if obj.verification_status == ServiceDomainMapping.VerificationStatus.VERIFIED:
            return f"https://{obj.domain}"
        return get_public_booking_base_url()


class ServiceFiscalYearSettingSerializer(serializers.ModelSerializer):
    current_period_start = serializers.SerializerMethodField()
    current_period_end = serializers.SerializerMethodField()
    fiscal_year_label = serializers.SerializerMethodField()

    class Meta:
        model = ServiceFiscalYearSetting
        fields = [
            "id",
            "fiscal_year_type",
            "starts_in_month",
            "current_period_start",
            "current_period_end",
            "fiscal_year_label",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_starts_in_month(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError("Fiscal year month must be between 1 and 12.")
        return value

    def get_current_period_start(self, obj):
        return get_fiscal_year_context()["current_period_start"]

    def get_current_period_end(self, obj):
        return get_fiscal_year_context()["current_period_end"]

    def get_fiscal_year_label(self, obj):
        return get_fiscal_year_context()["label"]


class ServiceCompanyDetailsSerializer(serializers.ModelSerializer):
    public_booking_base_url = serializers.SerializerMethodField()
    service_contact_name = serializers.SerializerMethodField()
    service_contact_email = serializers.SerializerMethodField()
    default_timezone = serializers.SerializerMethodField()

    class Meta:
        model = ServiceCompanyDetails
        fields = [
            "id",
            "company_name",
            "company_email",
            "contact_person",
            "phone",
            "address",
            "public_booking_base_url",
            "service_contact_name",
            "service_contact_email",
            "default_timezone",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_public_booking_base_url(self, obj):
        return get_public_booking_base_url()

    def get_service_contact_name(self, obj):
        return obj.contact_person or obj.company_name or ""

    def get_service_contact_email(self, obj):
        return obj.company_email or ""

    def get_default_timezone(self, obj):
        return ServicesModuleSettings.objects.filter(pk=1).values_list("default_timezone", flat=True).first() or timezone.get_current_timezone_name()


class ServiceHierarchyPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceHierarchyPreference
        fields = ["id", "preference", "description", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]
