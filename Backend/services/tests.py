from datetime import date, time

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APITestCase

from contacts.models import Contact
from leads.models import Lead
from support.models import SupportCase

from .models import CRMService, ServiceAppointment, ServiceMemberAssignment
from .serializers import AppointmentSerializer, JobSheetSerializer, ServiceDetailSerializer
from .services import create_or_update_appointment

User = get_user_model()


class ServicesTestMixin:
    def create_user(self, email: str) -> User:
        return User.objects.create_user(email=email, password="password123")

    def create_service(self, **overrides) -> CRMService:
        defaults = {
            "service_name": "Installation",
            "price": "100.00",
            "duration_minutes": 60,
            "location_type": CRMService.LocationType.CUSTOM,
            "status": CRMService.Status.ACTIVE,
        }
        defaults.update(overrides)
        return CRMService.objects.create(**defaults)

    def create_contact(self, **overrides) -> Contact:
        defaults = {
            "first_name": "Jane",
            "last_name": "Customer",
            "email": f"contact-{Contact.objects.count() + 1}@example.com",
        }
        defaults.update(overrides)
        return Contact.objects.create(**defaults)

    def create_lead(self, **overrides) -> Lead:
        defaults = {
            "first_name": "Service",
            "last_name": "Lead",
            "company": "Example Co",
            "email": f"lead-{Lead.objects.count() + 1}@example.com",
        }
        defaults.update(overrides)
        return Lead.objects.create(**defaults)

    def create_case(self, **overrides) -> SupportCase:
        defaults = {
            "subject": "Installation needed",
        }
        defaults.update(overrides)
        return SupportCase.objects.create(**defaults)


class ServiceDetailSerializerTests(ServicesTestMixin, TestCase):
    def test_members_only_include_active_assignments(self):
        service = self.create_service()
        active_member = self.create_user("active-member@example.com")
        inactive_member = self.create_user("inactive-member@example.com")
        ServiceMemberAssignment.objects.create(service=service, member=active_member, is_primary=True)
        ServiceMemberAssignment.objects.create(service=service, member=inactive_member, is_active=False)

        data = ServiceDetailSerializer(service).data

        self.assertEqual(len(data["members"]), 1)
        self.assertEqual(data["members"][0]["member"], active_member.id)


class AppointmentSerializerTests(ServicesTestMixin, TestCase):
    def test_rejects_invalid_linked_record(self):
        service = self.create_service()
        serializer = AppointmentSerializer(
            data={
                "service": service.id,
                "appointment_for_type": ServiceAppointment.AppointmentForType.CONTACT,
                "appointment_for_id": 999999,
                "appointment_date": date(2026, 3, 19),
                "appointment_start_time": time(10, 0),
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("appointment_for_id", serializer.errors)

    def test_other_target_clears_stale_record_id(self):
        service = self.create_service()
        serializer = AppointmentSerializer(
            data={
                "service": service.id,
                "appointment_for_type": ServiceAppointment.AppointmentForType.OTHER,
                "appointment_for_id": 123,
                "appointment_for_label": "Walk-in customer",
                "appointment_date": date(2026, 3, 19),
                "appointment_start_time": time(10, 0),
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIsNone(serializer.validated_data["appointment_for_id"])

    def test_lead_target_validation_works_without_is_active_field(self):
        service = self.create_service()
        lead = self.create_lead()
        serializer = AppointmentSerializer(
            data={
                "service": service.id,
                "appointment_for_type": ServiceAppointment.AppointmentForType.LEAD,
                "appointment_for_id": lead.id,
                "appointment_date": date(2026, 3, 19),
                "appointment_start_time": time(10, 0),
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_case_target_display(self):
        service = self.create_service()
        support_case = self.create_case()
        appointment = ServiceAppointment.objects.create(
            service=service,
            appointment_for_type=ServiceAppointment.AppointmentForType.CASE,
            appointment_for_id=support_case.id,
            appointment_date=date(2026, 3, 19),
            appointment_start_time=time(11, 0),
            appointment_end_time=time(12, 0),
        )

        data = AppointmentSerializer(appointment).data

        self.assertEqual(data["appointment_for_display"], support_case.case_number)


class JobSheetSerializerTests(ServicesTestMixin, TestCase):
    def test_rejects_appointment_from_different_service(self):
        service = self.create_service(service_name="Service A")
        other_service = self.create_service(service_name="Service B")
        contact = self.create_contact()
        appointment = ServiceAppointment.objects.create(
            service=other_service,
            appointment_for_type=ServiceAppointment.AppointmentForType.CONTACT,
            appointment_for_id=contact.id,
            appointment_date=date(2026, 3, 19),
            appointment_start_time=time(9, 0),
            appointment_end_time=time(10, 0),
        )

        serializer = JobSheetSerializer(
            data={
                "service": service.id,
                "appointment": appointment.id,
                "title": "Install checklist",
                "status": "draft",
                "fields": [{"field_name": "serial", "field_label": "Serial Number", "field_type": "text", "field_value": ""}],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("appointment", serializer.errors)

    def test_derived_customer_fields_from_appointment(self):
        service = self.create_service()
        contact = self.create_contact()
        appointment = ServiceAppointment.objects.create(
            service=service,
            appointment_for_type=ServiceAppointment.AppointmentForType.CONTACT,
            appointment_for_id=contact.id,
            appointment_date=date(2026, 3, 19),
            appointment_start_time=time(9, 0),
            appointment_end_time=time(10, 0),
        )

        serializer = JobSheetSerializer(
            data={
                "service": service.id,
                "appointment": appointment.id,
                "title": "Install checklist",
                "status": "draft",
                "fields": [{"field_name": "serial", "field_label": "Serial Number", "field_type": "text", "field_value": ""}],
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            serializer.validated_data["customer_type"],
            ServiceAppointment.AppointmentForType.CONTACT,
        )
        self.assertEqual(serializer.validated_data["customer_id"], contact.id)


class ServiceMembersApiTests(ServicesTestMixin, APITestCase):
    def setUp(self):
        self.user = self.create_user("owner@example.com")
        self.client.force_authenticate(self.user)
        self.service = self.create_service(created_by=self.user, updated_by=self.user)
        self.member = self.create_user("member@example.com")
        ServiceMemberAssignment.objects.create(service=self.service, member=self.member, is_primary=True)

    def test_can_clear_all_members(self):
        response = self.client.post(
            f"/api/services/{self.service.id}/members/",
            {"member_ids": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])
        self.assertFalse(self.service.member_assignments.filter(is_active=True).exists())


class AppointmentRulesApiTests(ServicesTestMixin, APITestCase):
    def setUp(self):
        self.user = self.create_user("scheduler@example.com")
        self.client.force_authenticate(self.user)
        self.service = self.create_service(created_by=self.user, updated_by=self.user)
        self.member = self.create_user("tech@example.com")
        ServiceMemberAssignment.objects.create(service=self.service, member=self.member, is_primary=True)
        self.business_hours = self.service.business_hours = None

    def test_holiday_blocks_booking(self):
        from .models import ServiceHoliday

        ServiceHoliday.objects.create(name="Festival", date=date(2026, 3, 19))
        serializer = AppointmentSerializer(
            data={
                "service": self.service.id,
                "appointment_for_type": ServiceAppointment.AppointmentForType.OTHER,
                "appointment_for_label": "Walk-in",
                "appointment_date": date(2026, 3, 19),
                "appointment_start_time": time(10, 0),
                "assigned_member": self.member.id,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(ValidationError):
            create_or_update_appointment(serializer, self.user)

    def test_member_overlap_is_blocked(self):
        from .models import BusinessHours

        hours = BusinessHours.objects.create(
            name="Default",
            timezone="Asia/Calcutta",
            is_default=True,
            monday_enabled=True,
            monday_start=time(9, 0),
            monday_end=time(18, 0),
            tuesday_enabled=True,
            tuesday_start=time(9, 0),
            tuesday_end=time(18, 0),
            wednesday_enabled=True,
            wednesday_start=time(9, 0),
            wednesday_end=time(18, 0),
            thursday_enabled=True,
            thursday_start=time(9, 0),
            thursday_end=time(18, 0),
            friday_enabled=True,
            friday_start=time(9, 0),
            friday_end=time(18, 0),
        )
        self.service.business_hours = hours
        self.service.save(update_fields=["business_hours", "updated_at"])

        ServiceAppointment.objects.create(
            service=self.service,
            appointment_for_type=ServiceAppointment.AppointmentForType.OTHER,
            appointment_for_label="Existing",
            appointment_date=date(2026, 3, 19),
            appointment_start_time=time(10, 0),
            appointment_end_time=time(11, 0),
            assigned_member=self.member,
        )

        response = self.client.post(
            "/api/services/appointments/",
            {
                "service": self.service.id,
                "appointment_for_type": "other",
                "appointment_for_label": "New booking",
                "appointment_date": "2026-03-19",
                "appointment_start_time": "10:30",
                "appointment_end_time": "11:30",
                "assigned_member": self.member.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assigned_member", response.json())
