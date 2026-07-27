import type { IntegrationProviderCard, SelectOption } from "./types";

export const providerOptions: SelectOption[] = [
  { value: "zoho_mail", label: "Business Mail" },
  { value: "gmail", label: "Gmail" },
  { value: "yahoo", label: "Yahoo Mail" },
  { value: "office365", label: "Office 365" },
  { value: "outlook", label: "Outlook" },
  { value: "other", label: "Other Mail" },
];

export const protocolOptions: SelectOption[] = [
  { value: "imap_oauth", label: "IMAP + OAuth" },
  { value: "imap", label: "IMAP" },
  { value: "smtp", label: "SMTP" },
  { value: "relay", label: "Relay" },
];

export const emailServiceCards: IntegrationProviderCard[] = [
  { key: "zoho_mail", title: "Business Mail", description: "Connect your business mailbox for syncing, sending, and CRM visibility in SSH Connect.", ctaLabel: "Configure" },
  { key: "gmail", title: "Gmail", description: "Set up Gmail with IMAP or OAuth-based mailbox sync.", ctaLabel: "Get Started" },
  { key: "yahoo", title: "Yahoo Mail", description: "Bring Yahoo conversations into SalesInbox and CRM matching.", ctaLabel: "Configure" },
  { key: "office365", title: "Office 365", description: "Sync Microsoft 365 mailboxes and collaboration workflows.", ctaLabel: "Configure" },
  { key: "outlook", title: "Outlook", description: "Connect Outlook inboxes for send, receive, and timeline sync.", ctaLabel: "Configure" },
  { key: "other", title: "Other Mail", description: "Use IMAP, SMTP, or relay settings for a custom mailbox provider.", ctaLabel: "Configure" },
];

export const deliverabilityTabs: SelectOption[] = [
  { value: "authentication", label: "Email Authentication" },
  { value: "relay", label: "Email Relay" },
  { value: "credibility", label: "Email Credibility" },
];

export const socialTabs: SelectOption[] = [
  { value: "brand", label: "Brand Settings" },
  { value: "admin", label: "Admin Settings" },
  { value: "automation", label: "Automate Lead Generation" },
];

export const integrationsNavTabs: SelectOption[] = [
  { value: "/integrations/email", label: "Email" },
  { value: "/integrations/social", label: "Social" },
  { value: "/integrations/visitors", label: "Visitor Tracking" },
];

export const unsubscribeActionOptions: SelectOption[] = [
  { value: "display_message", label: "Display Message" },
  { value: "redirect_url", label: "Redirect URL" },
];

export const unsubscribeLocationOptions: SelectOption[] = [
  { value: "standard_page", label: "Standard Page" },
  { value: "custom_page", label: "Custom Page" },
];

export const automationTriggerOptions: SelectOption[] = [
  { value: "mention", label: "Mention" },
  { value: "comment", label: "Comment" },
  { value: "like", label: "Like" },
  { value: "retweet", label: "Retweet" },
  { value: "message", label: "Message" },
];

export const socialPlatformOptions: SelectOption[] = [
  { value: "x", label: "X" },
  { value: "facebook", label: "Facebook" },
];

export const sharingModeOptions: SelectOption[] = [
  { value: "private", label: "Private" },
  { value: "public", label: "Public" },
  { value: "shared", label: "Shared" },
  { value: "role_based", label: "Role Based" },
];

export const usageScopeOptions: SelectOption[] = [
  { value: "standard", label: "Standard" },
  { value: "all_users", label: "All Users" },
  { value: "selected_profiles", label: "Selected Profiles" },
];

export const recordTypeOptions: SelectOption[] = [
  { value: "lead", label: "Lead" },
  { value: "contact", label: "Contact" },
  { value: "case", label: "Case" },
  { value: "custom", label: "Custom" },
];

export const secureConnectionOptions: SelectOption[] = [
  { value: "ssl", label: "SSL" },
  { value: "tls", label: "TLS" },
  { value: "never", label: "Never" },
];

export const pushVisitorOptions: SelectOption[] = [
  { value: "lead", label: "Lead" },
  { value: "contact", label: "Contact" },
];

export const sourceTypeOptions: SelectOption[] = [
  { value: "email", label: "Email" },
  { value: "social", label: "Social" },
  { value: "website", label: "Website" },
  { value: "parser", label: "Parser" },
  { value: "bcc_dropbox", label: "BCC Dropbox" },
  { value: "salesiq", label: "SalesIQ" },
];
