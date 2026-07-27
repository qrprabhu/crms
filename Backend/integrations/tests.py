from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
from contacts.models import Contact
from deals.models import Deal, DealStage
from deals.services import ensure_default_stages
from leads.models import Lead
from support.models import SupportCase

from .models import EmailProviderIntegration, EmailRecordLink, SocialLeadAutomationRule, VisitorTrackingPortal, VisitorTrackingSetting
from .services import create_synced_email_message, run_provider_sync
from .utils import build_portal_tracking_key


class IntegrationLinkingTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="integrations@example.com",
            password="StrongPass123",
            is_active=True,
        )
        self.client.force_authenticate(self.user)
        ensure_default_stages()
        self.stage = DealStage.objects.get(stage_name="Qualification")
        self.account = Account.objects.create(
            account_name="Zora",
            account_owner=self.user,
            website="https://zora.com",
        )
        self.contact = Contact.objects.create(
            first_name="Boomika",
            last_name="M",
            email="boomika@zora.com",
            phone="9999999999",
            account=self.account,
            contact_owner=self.user,
        )
        self.deal = Deal.objects.create(
            deal_name="Zora - Boomika Deal",
            account=self.account,
            contact=self.contact,
            deal_owner=self.user,
            stage=self.stage,
            probability=self.stage.probability,
        )
        self.case = SupportCase.objects.create(
            subject="License complaint",
            case_number="CASE-0099",
            owner=self.user,
            related_contact=self.contact,
            account=self.account,
            deal=self.deal,
            email=self.contact.email,
        )
        self.provider = EmailProviderIntegration.objects.create(
            provider_type=EmailProviderIntegration.ProviderType.GMAIL,
            protocol_type=EmailProviderIntegration.ProtocolType.IMAP_OAUTH,
            email_address="crm@zora.com",
            created_by=self.user,
        )
        self.portal = VisitorTrackingPortal.objects.create(
            portal_name="Zora Portal",
            portal_url="https://zora.com",
            created_by=self.user,
        )
        VisitorTrackingSetting.objects.create(
            portal=self.portal,
            push_new_visitors_as=VisitorTrackingSetting.PushAs.LEAD,
            assign_lead_to_user=self.user,
            app_name="Zora Portal",
            tracking_code="<script></script>",
        )

    def test_case_email_endpoint_returns_auto_linked_synced_email(self):
        create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-case-1",
                "subject": "Re: CASE-0099 License complaint",
                "from_email": "boomika@zora.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Need help with the Zora contract renewal.",
            },
            owner=self.user,
        )

        response = self.client.get(f"/api/cases/{self.case.pk}/emails")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["subject"], "Re: CASE-0099 License complaint")
        self.assertEqual(response.data[0]["sent_by_email"], "boomika@zora.com")

    def test_synced_email_matching_lead_also_links_converted_contact_and_account(self):
        lead = Lead.objects.create(
            first_name="Silambarasan",
            last_name="M",
            company="Infosys",
            email="mailsilamburavi@gmail.com",
            owner=self.user,
            converted_contact=self.contact,
            converted_account=self.account,
            converted_deal=self.deal,
        )
        self.contact.created_from_lead = lead
        self.contact.save(update_fields=["created_from_lead"])

        message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-lead-converted-1",
                "subject": "Converted lead follow up",
                "from_email": "mailsilamburavi@gmail.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Interested in the CRM product.",
            },
            owner=self.user,
        )

        self.assertEqual(message.lead_id, lead.pk)
        self.assertEqual(message.contact_id, self.contact.pk)
        self.assertEqual(message.account_id, self.account.pk)
        self.assertEqual(message.deal_id, self.deal.pk)

    def test_social_message_can_create_case_and_record_endpoint_data(self):
        SocialLeadAutomationRule.objects.create(
            platform=SocialLeadAutomationRule.Platform.FACEBOOK,
            trigger_type=SocialLeadAutomationRule.TriggerType.MESSAGE,
            action_type=SocialLeadAutomationRule.ActionType.CREATE_CASE,
            assign_to_user=self.user,
        )

        response = self.client.post(
            "/api/integrations/social/messages",
            {
                "platform": "facebook",
                "sender_name": "Boomika M",
                "sender_email": "boomika@zora.com",
                "message": "Complaint: the CRM license is not working for our team.",
                "external_message_id": "fb-msg-1",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(response.data["support_case"])

        social_response = self.client.get(f"/api/cases/{response.data['support_case']}/social")
        self.assertEqual(social_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(social_response.data), 1)
        self.assertEqual(social_response.data[0]["contact_name"], "Boomika M")

    def test_visitor_event_can_auto_convert_to_lead_and_be_listed(self):
        response = self.client.post(
            "/api/visitors/events",
            {
                "portal": self.portal.pk,
                "session_id": "session-123",
                "visitor_name": "New Visitor",
                "identified_email": "visitor@example.com",
                "page_url": "https://zora.com/pricing/enterprise",
                "event_type": "visit",
                "source_reference": "pricing-visit",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        lead = Lead.objects.get(email="visitor@example.com")
        self.assertEqual(response.data["linked_lead"], lead.pk)

        visitor_response = self.client.get(f"/api/leads/{lead.pk}/visitor-events")
        self.assertEqual(visitor_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(visitor_response.data), 1)
        self.assertEqual(visitor_response.data[0]["page_url"], "https://zora.com/pricing/enterprise")

    def test_provider_sync_generates_project_messages_and_links_them(self):
        log = run_provider_sync(
            provider_integration=self.provider,
            sync_type="incremental_sync",
            triggered_by=self.user,
        )

        self.assertEqual(log.status, "success")
        self.assertGreaterEqual(log.metadata.get("messages_processed", 0), 1)

        response = self.client.get("/api/integrations/email/sales-inbox/feed")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        self.assertGreaterEqual(len(results), 1)
        self.assertTrue(any(item["contact_name"] or item["lead_name"] for item in results))

        first_message = self.provider.synced_messages.order_by("-created_at").first()
        self.assertIsNotNone(first_message)
        self.assertTrue(EmailRecordLink.objects.filter(email_message=first_message).exists())

    @patch("integrations.services.fetch_provider_messages")
    def test_provider_sync_skips_unwanted_job_study_mail(self, fetch_provider_messages_mock):
        fetch_provider_messages_mock.return_value = [
            {
                "external_message_id": "gmail-junk-mail-1",
                "subject": "Job alert: internship opportunities",
                "from_email": "noreply@internshala.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Latest internships for students. Unsubscribe any time.",
                "direction": "incoming",
            }
        ]

        log = run_provider_sync(
            provider_integration=self.provider,
            sync_type="incremental_sync",
            triggered_by=self.user,
        )

        self.assertEqual(log.status, "success")
        self.assertEqual(log.metadata.get("messages_processed"), 0)
        self.assertEqual(log.metadata.get("messages_skipped"), 1)
        self.assertFalse(
            self.provider.synced_messages.filter(external_message_id="gmail-junk-mail-1").exists()
        )

    @patch("integrations.services.fetch_provider_messages")
    def test_provider_sync_keeps_known_contact_mail_even_with_junk_keywords(self, fetch_provider_messages_mock):
        fetch_provider_messages_mock.return_value = [
            {
                "external_message_id": "gmail-known-contact-mail-1",
                "subject": "Career plan for CRM rollout",
                "from_email": self.contact.email,
                "to_emails": ["crm@zora.com"],
                "body_text": "Need your CRM rollout proposal and pricing details.",
                "direction": "incoming",
            }
        ]

        log = run_provider_sync(
            provider_integration=self.provider,
            sync_type="incremental_sync",
            triggered_by=self.user,
        )

        self.assertEqual(log.status, "success")
        self.assertEqual(log.metadata.get("messages_processed"), 1)
        message = self.provider.synced_messages.get(external_message_id="gmail-known-contact-mail-1")
        self.assertEqual(message.contact_id, self.contact.pk)

    def test_public_tracker_collect_endpoint_creates_event(self):
        portal_key = build_portal_tracking_key(self.portal.pk, self.portal.portal_name)

        response = self.client.post(
            "/api/integrations/visitors/collect",
            {
                "portal_key": portal_key,
                "session_id": "public-session-1",
                "visitor_name": "Tracked Visitor",
                "identified_email": "tracked@example.com",
                "page_url": "https://zora.com/pricing",
                "source_url": "https://google.com/search?q=zora",
                "event_type": "visit",
                "source_reference": "/pricing",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        lead = Lead.objects.get(email="tracked@example.com")
        self.assertEqual(response.data["linked_lead"], lead.pk)

    def test_crm_email_inbox_and_record_endpoints_return_linked_messages(self):
        message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-lead-1",
                "subject": "Madhu follow up",
                "from_email": "boomika@zora.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Need latest status.",
            },
            owner=self.user,
        )

        inbox_response = self.client.get("/api/email/inbox/?filter=linked_to_contact")
        self.assertEqual(inbox_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item["id"] == message.id for item in inbox_response.data))

        record_response = self.client.get(f"/api/email/record/contacts/{self.contact.pk}/")
        self.assertEqual(record_response.status_code, status.HTTP_200_OK)
        self.assertEqual(record_response.data[0]["contact_id"], self.contact.pk)

    def test_unread_count_only_returns_lead_linked_incoming_messages(self):
        lead = Lead.objects.create(
            first_name="Prospect",
            last_name="One",
            company="Acme",
            email="prospect@acme.com",
            owner=self.user,
        )

        lead_message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-lead-unread-1",
                "subject": "Lead follow up",
                "from_email": lead.email,
                "to_emails": ["crm@zora.com"],
                "body_text": "Please share the demo schedule.",
            },
            owner=self.user,
        )
        lead_message.lead = lead
        lead_message.save(update_fields=["lead", "updated_at"])

        create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-nonlead-unread-1",
                "subject": "Newsletter",
                "from_email": "hello@use.ai",
                "to_emails": ["crm@zora.com"],
                "body_text": "Product update for subscribers.",
            },
            owner=self.user,
        )

        response = self.client.get("/api/email/unread-count/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unread_count"], 1)
        self.assertEqual(len(response.data["recent"]), 1)
        self.assertEqual(response.data["recent"][0]["id"], lead_message.id)

    def test_record_email_list_endpoint_returns_body_fields_for_crm_modules(self):
        message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-linked-record-1",
                "subject": "(No subject)",
                "from_email": "boomika@zora.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Interested to buy crms software",
            },
            owner=self.user,
        )
        message.contact = self.contact
        message.account = self.account
        message.deal = self.deal
        message.save(update_fields=["contact", "account", "deal", "updated_at"])

        response = self.client.get(f"/api/integrations/deals/{self.deal.pk}/emails/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["id"], message.id)
        self.assertEqual(response.data[0]["body_text"], "Interested to buy crms software")
        self.assertEqual(response.data[0]["preview_text"], "Interested to buy crms software")

    def test_unrelated_external_job_mail_does_not_auto_create_placeholder_lead(self):
        before_count = Lead.objects.count()

        message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-job-junk-1",
                "subject": "Hiring now: opportunities at Teamware Solutions and more",
                "from_email": "student@internshala.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Explore internships and job openings curated for candidates.",
            },
            owner=self.user,
        )

        self.assertIsNone(message.lead_id)
        self.assertEqual(Lead.objects.count(), before_count)

    def test_relevant_outside_business_mail_can_auto_create_placeholder_lead(self):
        message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-new-lead-1",
                "subject": "Need CRM pricing",
                "from_email": "prospect@example.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Hi, I need CRM pricing for 15 users.",
            },
            owner=self.user,
        )

        self.assertIsNotNone(message.lead_id)
        self.assertEqual(message.lead.email, "prospect@example.com")

    def test_contact_email_list_does_not_include_other_account_contact_emails(self):
        sibling_contact = Contact.objects.create(
            first_name="Kanmani",
            last_name="U",
            email="kanmaniulaganathan17@gmail.com",
            phone="8888888888",
            account=self.account,
            contact_owner=self.user,
        )

        create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-sibling-contact-1",
                "subject": "(no subject)",
                "from_email": sibling_contact.email,
                "to_emails": ["crm@zora.com"],
                "body_text": "Interested to buy crms software",
            },
            owner=self.user,
        )

        response = self.client.get(f"/api/integrations/contacts/{self.contact.pk}/emails/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(any(item["body_text"] == "Interested to buy crms software" for item in response.data))

    def test_deal_email_list_does_not_include_other_account_contact_emails(self):
        sibling_contact = Contact.objects.create(
            first_name="Kanmani",
            last_name="U",
            email="kanmaniulaganathan17@gmail.com",
            phone="8888888888",
            account=self.account,
            contact_owner=self.user,
        )

        create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-sibling-deal-1",
                "subject": "(no subject)",
                "from_email": sibling_contact.email,
                "to_emails": ["crm@zora.com"],
                "body_text": "Interested to buy crms software",
            },
            owner=self.user,
        )

        response = self.client.get(f"/api/integrations/deals/{self.deal.pk}/emails/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(any(item["body_text"] == "Interested to buy crms software" for item in response.data))

    def test_support_intent_prefers_open_case_over_deal(self):
        message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-support-intent-1",
                "subject": "Need help urgently",
                "from_email": "boomika@zora.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Our CRM is not working and we need support immediately.",
            },
            owner=self.user,
        )

        self.assertEqual(message.support_case_id, self.case.pk)
        self.assertEqual(message.contact_id, self.contact.pk)
        self.assertEqual(message.account_id, self.account.pk)
        self.assertEqual(message.deal_id, self.deal.pk)

    def test_sales_intent_prefers_active_deal_over_open_case(self):
        message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-sales-intent-1",
                "subject": "Pricing request",
                "from_email": "boomika@zora.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "We want to buy more CRM licenses. Please share pricing.",
            },
            owner=self.user,
        )

        self.assertEqual(message.deal_id, self.deal.pk)
        self.assertEqual(message.contact_id, self.contact.pk)
        self.assertEqual(message.account_id, self.account.pk)
        self.assertIsNone(message.support_case_id)

    def test_same_thread_keeps_previous_case_routing_without_keywords(self):
        first_message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-thread-case-1",
                "thread_id": "thread-case-1",
                "subject": "Re: CASE-0099 License complaint",
                "from_email": "boomika@zora.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Need help with the contract issue.",
            },
            owner=self.user,
        )

        follow_up = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-thread-case-2",
                "thread_id": "thread-case-1",
                "subject": "Re: following up",
                "from_email": "boomika@zora.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Any update from your side?",
            },
            owner=self.user,
        )

        self.assertEqual(first_message.support_case_id, self.case.pk)
        self.assertEqual(follow_up.support_case_id, self.case.pk)
        self.assertEqual(follow_up.contact_id, self.contact.pk)
        self.assertEqual(follow_up.account_id, self.account.pk)

    def test_case_reference_supports_cas_format(self):
        self.case.case_number = "CAS0099"
        self.case.save(update_fields=["case_number", "updated_at"])

        message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-case-cas-1",
                "subject": "Re: CAS0099",
                "from_email": "boomika@zora.com",
                "to_emails": ["crm@zora.com"],
                "body_text": "Following up on the support request.",
            },
            owner=self.user,
        )

        self.assertEqual(message.support_case_id, self.case.pk)
        self.assertEqual(message.contact_id, self.contact.pk)

    @patch("integrations.views.create_outgoing_crm_email")
    def test_crm_email_send_endpoint_uses_live_send_path(self, create_outgoing_mock):
        message = create_synced_email_message(
            provider_integration=self.provider,
            payload={
                "external_message_id": "gmail-outgoing-1",
                "subject": "Outgoing mail",
                "from_email": "crm@zora.com",
                "to_emails": ["boomika@zora.com"],
                "direction": "outgoing",
                "status": "sent",
                "body_text": "Hello from CRM",
            },
            owner=self.user,
        )
        create_outgoing_mock.return_value = message

        response = self.client.post(
            "/api/email/send/",
            {
                "provider_account_id": self.provider.pk,
                "to": ["boomika@zora.com"],
                "subject": "Hello from CRM",
                "body": "<p>Hello</p>",
                "contact_id": self.contact.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(create_outgoing_mock.called)
        self.assertTrue(create_outgoing_mock.call_args.kwargs["send_live"])

    def test_public_tracker_collect_rejects_wrong_portal_origin(self):
        portal_key = build_portal_tracking_key(self.portal.pk, self.portal.portal_name)

        response = self.client.post(
            "/api/integrations/visitors/collect",
            {
                "portal_key": portal_key,
                "session_id": "bad-origin-1",
                "visitor_name": "Tracked Visitor",
                "identified_email": "wrong-origin@example.com",
                "page_url": "https://evil.example.com/pricing",
                "source_url": "https://evil.example.com/pricing",
                "event_type": "visit",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
