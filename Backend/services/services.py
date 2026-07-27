from __future__ import annotations

import calendar
from datetime import date as date_cls, datetime, time as time_cls

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.models import Account
from activities.services import (
    create_account_activity,
    create_contact_activity,
    create_deal_activity,
    create_lead_activity,
)
from contacts.models import Contact
from deals.models import Deal
from inventory.models import Invoice, Product, SalesOrder
from leads.models import Lead
from support.models import SupportCase
from support.services import add_activity as add_support_activity

from .models import (
    BusinessHours,
    CRMService,
    ServiceAppointment,
    ServiceCompanyDetails,
    ServiceDomainMapping,
    ServiceFiscalYearSetting,
    ServiceHoliday,
    ServiceHierarchyPreference,
    ServiceJobSheet,
    ServiceMemberAssignment,
    ServicesModuleSettings,
)


def get_services_settings() -> ServicesModuleSettings:
    settings_obj, _ = ServicesModuleSettings.objects.get_or_create(
        pk=1,
        defaults={"default_timezone": timezone.get_current_timezone_name()},
    )
    return settings_obj


def update_services_settings(data: dict) -> ServicesModuleSettings:
    settings_obj = get_services_settings()
    for field, value in data.items():
        setattr(settings_obj, field, value)
    settings_obj.save()
    return settings_obj


def enable_services() -> ServicesModuleSettings:
    if not BusinessHours.objects.filter(is_active=True).exists():
        raise ValidationError(
            {
                "business_hours": [
                    "Business hours not configured. To use Services module you need to configure business hours for your organisation."
                ]
            }
        )
    settings_obj = get_services_settings()
    settings_obj.is_services_enabled = True
    settings_obj.save(update_fields=["is_services_enabled", "updated_at"])
    return settings_obj


def get_default_business_hours():
    return BusinessHours.objects.filter(is_active=True, is_default=True).first()


def list_business_hours():
    return BusinessHours.objects.filter(is_active=True).order_by("name", "id")


def set_default_business_hours(instance: BusinessHours) -> BusinessHours:
    with transaction.atomic():
        BusinessHours.objects.filter(is_active=True, is_default=True).exclude(pk=instance.pk).update(is_default=False)
        instance.is_default = True
        instance.save(update_fields=["is_default", "updated_at"])
    return instance


def delete_business_hours(instance: BusinessHours):
    instance.is_active = False
    if instance.is_default:
        instance.is_default = False
    instance.save(update_fields=["is_active", "is_default", "updated_at"])
    replacement = BusinessHours.objects.filter(is_active=True).order_by("id").first()
    if replacement and not BusinessHours.objects.filter(is_active=True, is_default=True).exists():
        set_default_business_hours(replacement)


def list_services():
    return (
        CRMService.objects.filter(is_active=True)
        .select_related("business_hours")
        .prefetch_related("member_assignments__member")
        .annotate(members_count=Count("member_assignments", filter=Q(member_assignments__is_active=True)))
        .order_by("-created_at")
    )


def get_service(pk: int) -> CRMService:
    return CRMService.objects.filter(is_active=True).select_related("business_hours").get(pk=pk)


def get_service_business_hours(service: CRMService | None):
    if not service:
        return get_default_business_hours()
    return service.business_hours or get_default_business_hours()


def get_business_hours_day_slots(business_hours: BusinessHours | None, target_date: date_cls) -> list[dict[str, time_cls | str]]:
    if not business_hours:
        return []

    day_name = target_date.strftime("%A").lower()
    enabled = getattr(business_hours, f"{day_name}_enabled", False)
    if not enabled:
        return []

    start = getattr(business_hours, f"{day_name}_start", None)
    end = getattr(business_hours, f"{day_name}_end", None)
    if not start or not end:
        return []

    return [
        {
            "start": start,
            "end": end,
            "timezone": business_hours.timezone,
        }
    ]


def get_business_hours_payload(business_hours: BusinessHours | None):
    if not business_hours:
        return None
    return {
        "id": business_hours.id,
        "name": business_hours.name,
        "timezone": business_hours.timezone,
        "is_default": business_hours.is_default,
        "days": get_day_slots_summary(business_hours),
    }


def get_day_slots_summary(business_hours: BusinessHours | None):
    if not business_hours:
        return {}
    summary = {}
    for day in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"):
        enabled = getattr(business_hours, f"{day}_enabled", False)
        start = getattr(business_hours, f"{day}_start", None)
        end = getattr(business_hours, f"{day}_end", None)
        summary[day] = {
            "enabled": enabled,
            "slots": [{"start": start, "end": end}] if enabled and start and end else [],
        }
    return summary


def get_holiday_on(target_date: date_cls):
    return ServiceHoliday.objects.filter(is_active=True, date=target_date).first()


def save_service_members(service: CRMService, member_ids: list[int], primary_member_id: int | None = None):
    existing_assignments = {
        assignment.member_id: assignment
        for assignment in service.member_assignments.filter(is_active=True)
    }
    kept_ids = set()
    for member_id in member_ids:
        assignment = existing_assignments.get(member_id)
        if assignment:
            assignment.is_primary = member_id == primary_member_id
            assignment.save(update_fields=["is_primary", "updated_at"])
        else:
            ServiceMemberAssignment.objects.create(
                service=service,
                member_id=member_id,
                is_primary=member_id == primary_member_id,
            )
        kept_ids.add(member_id)
    service.member_assignments.filter(is_active=True).exclude(member_id__in=kept_ids).update(is_active=False)


def remove_service_member(service: CRMService, assignment_id: int):
    assignment = service.member_assignments.filter(pk=assignment_id, is_active=True).first()
    if not assignment:
        raise ValidationError({"member": ["Assigned member not found."]})
    assignment.is_active = False
    assignment.save(update_fields=["is_active", "updated_at"])


def _resolve_record(model, pk: int | None):
    if not model or not pk:
        return None
    queryset = model.objects.filter(pk=pk)
    if any(field.name == "is_active" for field in model._meta.fields):
        queryset = queryset.filter(is_active=True)
    return queryset.first()


def get_linked_record_model(record_type: str | None):
    model_map = {
        ServiceAppointment.AppointmentForType.CONTACT: Contact,
        ServiceAppointment.AppointmentForType.ACCOUNT: Account,
        ServiceAppointment.AppointmentForType.LEAD: Lead,
        ServiceAppointment.AppointmentForType.DEAL: Deal,
        ServiceAppointment.AppointmentForType.CASE: SupportCase,
        ServiceAppointment.AppointmentForType.PRODUCT: Product,
    }
    return model_map.get(record_type or "")


def get_linked_record(record_type: str | None, record_id: int | None):
    return _resolve_record(get_linked_record_model(record_type), record_id)


def get_first_product_for_document(sales_order: SalesOrder | None = None, invoice: Invoice | None = None):
    if invoice:
        invoice_item = invoice.items.filter(is_active=True).select_related("product").first()
        if invoice_item and invoice_item.product and invoice_item.product.is_active:
            return invoice_item.product
    if sales_order:
        sales_order_item = sales_order.items.filter(is_active=True).select_related("product").first()
        if sales_order_item and sales_order_item.product and sales_order_item.product.is_active:
            return sales_order_item.product
    return None


def build_service_operational_summary(queryset=None):
    queryset = queryset or list_appointments()
    today = timezone.localdate()
    total = queryset.count()
    active_pipeline_statuses = [
        ServiceAppointment.Status.REQUESTED,
        ServiceAppointment.Status.SCHEDULED,
        ServiceAppointment.Status.CONFIRMED,
        ServiceAppointment.Status.IN_PROGRESS,
        ServiceAppointment.Status.RESCHEDULED,
    ]
    by_status = list(
        queryset.values("status").annotate(count=Count("id")).order_by("status")
    )
    by_coverage = list(
        queryset.exclude(coverage_type=ServiceAppointment.CoverageType.NONE)
        .values("coverage_type")
        .annotate(count=Count("id"))
        .order_by("coverage_type")
    )
    workload = list(
        queryset.values("assigned_member__email")
        .annotate(count=Count("id"))
        .order_by("-count", "assigned_member__email")[:5]
    )
    return {
        "total_appointments": total,
        "today_appointments": queryset.filter(appointment_date=today).count(),
        "active_pipeline": queryset.filter(status__in=active_pipeline_statuses).count(),
        "completed_appointments": queryset.filter(
            status__in=[ServiceAppointment.Status.COMPLETED, ServiceAppointment.Status.CLOSED]
        ).count(),
        "covered_appointments": queryset.exclude(
            coverage_type=ServiceAppointment.CoverageType.NONE
        ).count(),
        "by_status": by_status,
        "by_coverage": by_coverage,
        "top_workload": workload,
    }


def get_public_booking_base_url():
    verified = (
        ServiceDomainMapping.objects.filter(
            is_active=True,
            verification_status=ServiceDomainMapping.VerificationStatus.VERIFIED,
        )
        .order_by("-created_at")
        .first()
    )
    if verified:
        return f"https://{verified.domain}"
    return "http://localhost:5173"


def get_service_public_booking_url(service: CRMService | None):
    if not service:
        return None
    return f"{get_public_booking_base_url().rstrip('/')}/services/catalog/{service.pk}"


def get_appointment_public_booking_url(appointment: ServiceAppointment | None):
    if not appointment:
        return None
    return f"{get_public_booking_base_url().rstrip('/')}/services/appointments/{appointment.pk}"


def _time_in_slots(start_time, end_time, slots):
    for slot in slots:
        if start_time >= slot["start"] and end_time <= slot["end"]:
            return True
    return False


def validate_member_availability(
    *,
    assigned_member,
    appointment_date,
    start_time,
    end_time,
    exclude_appointment_id: int | None = None,
):
    if not assigned_member:
        return

    queryset = ServiceAppointment.objects.filter(
        is_active=True,
        assigned_member=assigned_member,
        appointment_date=appointment_date,
    ).exclude(status=ServiceAppointment.Status.CANCELLED)
    if exclude_appointment_id:
        queryset = queryset.exclude(pk=exclude_appointment_id)

    overlap = queryset.filter(
        appointment_start_time__lt=end_time,
        appointment_end_time__gt=start_time,
    ).first()
    if overlap:
        raise ValidationError(
            {"assigned_member": ["Selected member already has another appointment in this time window."]}
        )


def validate_appointment_window(service: CRMService, appointment_date, start_time, end_time, assigned_member=None, exclude_appointment_id: int | None = None):
    holiday = get_holiday_on(appointment_date)
    if holiday:
        raise ValidationError({"appointment_date": [f"{holiday.name} is a holiday. Appointments cannot be booked on this date."]})

    business_hours = get_service_business_hours(service)
    slots = get_business_hours_day_slots(business_hours, appointment_date)
    if not slots:
        raise ValidationError({"appointment_date": ["Selected day is outside configured business hours."]})

    if not _time_in_slots(start_time, end_time, slots):
        raise ValidationError({"appointment_start_time": ["Appointment time must fall within business hours."]})

    validate_member_availability(
        assigned_member=assigned_member,
        appointment_date=appointment_date,
        start_time=start_time,
        end_time=end_time,
        exclude_appointment_id=exclude_appointment_id,
    )


def derive_appointment_location(service: CRMService, current_location: str | None = None):
    if current_location:
        return current_location
    location = (service.location or "").strip()
    if service.location_type == CRMService.LocationType.REMOTE:
        return location or "Virtual meeting"
    if service.location_type == CRMService.LocationType.HYBRID:
        return location or "Hybrid service"
    return location


def _log_appointment_activity(appointment: ServiceAppointment, user, action: str):
    description = (
        f"{appointment.service.service_name} on {appointment.appointment_date} "
        f"at {appointment.appointment_start_time}-{appointment.appointment_end_time}"
    )
    record = get_linked_record(appointment.appointment_for_type, appointment.appointment_for_id)
    if appointment.appointment_for_type == ServiceAppointment.AppointmentForType.LEAD and record:
        create_lead_activity(lead=record, action=action, description=description, user=user)
    elif appointment.appointment_for_type == ServiceAppointment.AppointmentForType.CONTACT and record:
        create_contact_activity(contact=record, action=action, description=description, user=user)
    elif appointment.appointment_for_type == ServiceAppointment.AppointmentForType.ACCOUNT and record:
        create_account_activity(account=record, action=action, description=description, user=user)
    elif appointment.appointment_for_type == ServiceAppointment.AppointmentForType.DEAL and record:
        create_deal_activity(deal=record, action=action, description=description, user=user)
    elif appointment.appointment_for_type == ServiceAppointment.AppointmentForType.CASE and record:
        add_support_activity(
            "case",
            record,
            {
                "action": action,
                "description": description,
            },
            user,
        )


def list_appointments():
    return ServiceAppointment.objects.filter(
        is_active=True,
        service__is_active=True,
    ).select_related(
        "service",
        "service__business_hours",
        "assigned_member",
        "product",
        "sales_order",
        "invoice",
    ).order_by(
        "appointment_date",
        "appointment_start_time",
        "id",
    )


def get_appointment(pk: int) -> ServiceAppointment:
    return ServiceAppointment.objects.filter(
        is_active=True,
        service__is_active=True,
    ).select_related(
        "service",
        "service__business_hours",
        "assigned_member",
        "product",
        "sales_order",
        "invoice",
    ).get(pk=pk)


def create_or_update_appointment(serializer, user):
    instance = serializer.instance
    service = serializer.validated_data.get("service", getattr(instance, "service", None))
    appointment_date = serializer.validated_data.get("appointment_date", getattr(instance, "appointment_date", None))
    appointment_start_time = serializer.validated_data.get(
        "appointment_start_time",
        getattr(instance, "appointment_start_time", None),
    )
    appointment_end_time = serializer.validated_data.get("appointment_end_time", getattr(instance, "appointment_end_time", None))
    assigned_member = serializer.validated_data.get("assigned_member", getattr(instance, "assigned_member", None))
    serializer.validated_data["location"] = derive_appointment_location(
        service,
        serializer.validated_data.get("location", getattr(instance, "location", None)),
    )
    validate_appointment_window(
        service,
        appointment_date,
        appointment_start_time,
        appointment_end_time,
        assigned_member=assigned_member,
        exclude_appointment_id=getattr(instance, "pk", None),
    )
    appointment = serializer.save(created_by=getattr(instance, "created_by", user), updated_by=user)
    _log_appointment_activity(
        appointment,
        user,
        "Service appointment updated" if instance else "Service appointment scheduled",
    )
    return appointment


def cancel_appointment(appointment: ServiceAppointment, user):
    appointment.status = ServiceAppointment.Status.CANCELLED
    appointment.updated_by = user
    appointment.save(update_fields=["status", "updated_by", "updated_at"])
    _log_appointment_activity(appointment, user, "Service appointment cancelled")
    return appointment


def reschedule_appointment(appointment: ServiceAppointment, data: dict, user):
    appointment.appointment_date = data["appointment_date"]
    appointment.appointment_start_time = data["appointment_start_time"]
    appointment.appointment_end_time = data["appointment_end_time"]
    appointment.status = ServiceAppointment.Status.RESCHEDULED
    appointment.updated_by = user
    validate_appointment_window(
        appointment.service,
        appointment.appointment_date,
        appointment.appointment_start_time,
        appointment.appointment_end_time,
        assigned_member=appointment.assigned_member,
        exclude_appointment_id=appointment.pk,
    )
    appointment.save(
        update_fields=[
            "appointment_date",
            "appointment_start_time",
            "appointment_end_time",
            "status",
            "updated_by",
            "updated_at",
        ]
    )
    _log_appointment_activity(appointment, user, "Service appointment rescheduled")
    return appointment


def list_job_sheets():
    return (
        ServiceJobSheet.objects.filter(
            is_active=True,
            service__is_active=True,
        )
        .select_related("service", "appointment")
        .prefetch_related("fields")
    )


def get_job_sheet(pk: int) -> ServiceJobSheet:
    return (
        ServiceJobSheet.objects.filter(is_active=True, service__is_active=True)
        .select_related("service", "appointment")
        .prefetch_related("fields")
        .get(pk=pk)
    )


def create_or_update_job_sheet(serializer, user):
    if serializer.instance:
        job_sheet = serializer.save(updated_by=user)
    else:
        job_sheet = serializer.save(created_by=user, updated_by=user)

    appointment = getattr(job_sheet, "appointment", None)
    if appointment:
        next_status = None
        if job_sheet.status == "completed":
            next_status = ServiceAppointment.Status.COMPLETED
        elif job_sheet.status in {"submitted", "in_progress"}:
            next_status = ServiceAppointment.Status.IN_PROGRESS

        if next_status and appointment.status != next_status:
            appointment.status = next_status
            appointment.updated_by = user
            appointment.save(update_fields=["status", "updated_by", "updated_at"])

    return job_sheet


def get_company_details():
    details, _ = ServiceCompanyDetails.objects.get_or_create(pk=1)
    return details


def get_fiscal_year():
    return ServiceFiscalYearSetting.objects.get_or_create(pk=1, defaults={"starts_in_month": 1})[0]


def get_fiscal_year_context():
    fiscal_year = get_fiscal_year()
    today = timezone.now().date()
    start_year = today.year
    if today.month < fiscal_year.starts_in_month:
        start_year -= 1
    start_date = date_cls(start_year, fiscal_year.starts_in_month, 1)
    if fiscal_year.starts_in_month == 1:
        end_date = date_cls(start_year, 12, 31)
    else:
        end_year = start_year + 1
        end_month = fiscal_year.starts_in_month - 1
        last_day = calendar.monthrange(end_year, end_month)[1]
        end_date = date_cls(end_year, end_month, last_day)
    return {
        "record": fiscal_year,
        "current_period_start": start_date,
        "current_period_end": end_date,
        "label": f"FY {start_date.year}-{str(end_date.year)[-2:]}",
    }


def get_hierarchy_preference():
    return ServiceHierarchyPreference.objects.get_or_create(pk=1)[0]


def verify_domain_mapping(mapping: ServiceDomainMapping):
    mapping.verification_status = ServiceDomainMapping.VerificationStatus.VERIFIED
    mapping.save(update_fields=["verification_status", "updated_at"])
    return mapping
