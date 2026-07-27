import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileText, Search } from "lucide-react";
import DashboardLayout from "../layout/DashboardLayout";
import { apiRequest } from "../../api/client";
import { addLeadNote, getLeads } from "../../lib/api/leadsApi";
import type { LeadRecord } from "../../lib/shared/crmTypes";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

type CRMImportPageProps = {
  pageTitle: string;
  moduleLabel: string;
  mode: "module" | "notes";
  backPath: string;
  initialTargetRecordId?: string;
};

type ModuleField = {
  key: string;
  label: string;
  required?: boolean;
  virtual?: boolean;
};

type ModuleConfig = {
  endpoint: string;
  fields: ModuleField[];
  aliasDictionary: Record<string, string>;
  emailFields: Set<string>;
  phoneFields: Set<string>;
  numberFields: Set<string>;
  integerFields: Set<string>;
  dateFields: Set<string>;
  duplicateField?: string;
};

const MAX_ROWS = 5000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const PREVIEW_ROWS = 5;

let papaModulePromise: Promise<typeof import("papaparse")> | null = null;
let jsZipModulePromise: Promise<unknown> | null = null;
let pdfModulePromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf")> | null = null;
let xlsxModulePromise: Promise<typeof import("xlsx")> | null = null;

const loadPapaModule = async () => {
  papaModulePromise ??= import("papaparse");
  return papaModulePromise;
};

const loadJsZipModule = async () => {
  jsZipModulePromise ??= import("jszip");
  return jsZipModulePromise;
};

const loadPdfModule = async () => {
  pdfModulePromise ??= import("pdfjs-dist/legacy/build/pdf");
  const pdfModule = await pdfModulePromise;
  pdfModule.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return pdfModule;
};

const loadXlsxModule = async () => {
  xlsxModulePromise ??= import("xlsx");
  return xlsxModulePromise;
};

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeKeySlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const levenshtein = (a: string, b: string) => {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
};

const similarity = (a: string, b: string) => {
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const phonePattern = /^\+?[0-9\-().\s]{7,20}$/;

const buildNotesConfig = (moduleKey: string): ModuleConfig | null => {
  if (moduleKey !== "leads") return null;

  return {
    endpoint: "",
    fields: [
      { key: "title", label: "Title" },
      { key: "note", label: "Note", required: true },
    ],
    aliasDictionary: {
      note: "note",
      notes: "note",
      content: "note",
      body: "note",
      description: "note",
      title: "title",
      subject: "title",
      heading: "title",
    },
    emailFields: new Set<string>(),
    phoneFields: new Set<string>(),
    numberFields: new Set<string>(),
    integerFields: new Set<string>(),
    dateFields: new Set<string>(),
  };
};

const buildModuleConfig = (moduleKey: string): ModuleConfig | null => {
  if (moduleKey === "leads") {
    return {
      endpoint: "/leads/import/",
      fields: [
        { key: "full_name", label: "Full Name", virtual: true },
        { key: "first_name", label: "First Name", required: true },
        { key: "last_name", label: "Last Name", required: true },
        { key: "company", label: "Company", required: true },
        { key: "owner", label: "Lead Owner" },
        { key: "email", label: "Email", required: true },
        { key: "phone", label: "Phone" },
        { key: "mobile", label: "Mobile" },
        { key: "title", label: "Title" },
        { key: "website", label: "Website" },
        { key: "lead_source", label: "Lead Source" },
        { key: "lead_status", label: "Lead Status" },
        { key: "industry", label: "Industry" },
        { key: "annual_revenue", label: "Annual Revenue" },
        { key: "employee_count", label: "Employees" },
        { key: "rating", label: "Rating" },
        { key: "street", label: "Street" },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
        { key: "country", label: "Country" },
        { key: "zip_code", label: "Zip Code" },
        { key: "skype_id", label: "Skype ID" },
        { key: "secondary_email", label: "Secondary Email" },
        { key: "description", label: "Description" },
        { key: "tags", label: "Tags" },
      ],
      aliasDictionary: {
        lead_name: "full_name",
        name: "full_name",
        fullname: "full_name",
        "full name": "full_name",
        firstname: "first_name",
        "first name": "first_name",
        lastname: "last_name",
        "last name": "last_name",
        company: "company",
        organization: "company",
        business: "company",
        mail: "email",
        "email address": "email",
        phone: "phone",
        mobile: "mobile",
        "contact number": "phone",
        "annual revenue": "annual_revenue",
        employees: "employee_count",
        "employee count": "employee_count",
        "lead source": "lead_source",
        "lead status": "lead_status",
        zipcode: "zip_code",
        "zip code": "zip_code",
        "postal code": "zip_code",
        "secondary email": "secondary_email",
        "skype id": "skype_id",
        "country/region": "country",
        "state/province": "state",
        "lead owner": "owner",
        owner: "owner",
        tags: "tags",
      },
      emailFields: new Set(["email", "secondary_email"]),
      phoneFields: new Set(["phone", "mobile"]),
      numberFields: new Set(["annual_revenue"]),
      integerFields: new Set(["employee_count"]),
      dateFields: new Set<string>(),
      duplicateField: "email",
    };
  }

  if (moduleKey === "contacts") {
    return {
      endpoint: "/contacts/import/",
      fields: [
        { key: "contact_id", label: "Contact ID", virtual: true },
        { key: "full_name", label: "Full Name", virtual: true },
        { key: "first_name", label: "First Name", required: true },
        { key: "last_name", label: "Last Name", required: true },
        { key: "contact_owner", label: "Contact Owner" },
        { key: "owner", label: "Owner" },
        { key: "contact_owner_id", label: "Contact Owner ID", virtual: true },
        { key: "account", label: "Account ID" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "mobile", label: "Mobile" },
        { key: "account_name", label: "Account Name" },
        { key: "salutation", label: "Salutation" },
        { key: "secondary_email", label: "Secondary Email" },
        { key: "other_phone", label: "Other Phone" },
        { key: "home_phone", label: "Home Phone" },
        { key: "assistant_phone", label: "Assistant Phone" },
        { key: "title", label: "Title" },
        { key: "department", label: "Department" },
        { key: "assistant", label: "Assistant" },
        { key: "date_of_birth", label: "Date of Birth" },
        { key: "lead_source", label: "Lead Source" },
        { key: "vendor_name", label: "Vendor Name" },
        { key: "fax", label: "Fax" },
        { key: "country", label: "Country" },
        { key: "street", label: "Street" },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
        { key: "zip_code", label: "Zip Code" },
        { key: "description", label: "Description" },
        { key: "vendor_id", label: "Vendor ID", virtual: true },
        { key: "email_opt_out", label: "Email Opt Out", virtual: true },
        { key: "skype_id", label: "Skype ID", virtual: true },
        { key: "created_by", label: "Created By", virtual: true },
        { key: "created_by_id", label: "Created By ID", virtual: true },
        { key: "modified_by", label: "Modified By", virtual: true },
        { key: "modified_by_id", label: "Modified By ID", virtual: true },
        { key: "created_time", label: "Created Time", virtual: true },
        { key: "modified_time", label: "Modified Time", virtual: true },
        { key: "last_activity_time", label: "Last Activity Time", virtual: true },
        { key: "twitter", label: "Twitter", virtual: true },
        { key: "tag", label: "Tag", virtual: true },
        { key: "reporting_to", label: "Reporting To", virtual: true },
        { key: "reporting_to_id", label: "Reporting To ID", virtual: true },
        { key: "unsubscribed_mode", label: "Unsubscribed Mode", virtual: true },
        { key: "unsubscribed_time", label: "Unsubscribed Time", virtual: true },
        { key: "record_id", label: "Record ID", virtual: true },
        { key: "change_log_time", label: "Change Log Time", virtual: true },
        { key: "mailing_address", label: "Mailing Address", virtual: true },
        { key: "other_address", label: "Other Address", virtual: true },
        { key: "connected_to", label: "Connected To", virtual: true },
        { key: "connected_to_id", label: "Connected To Id", virtual: true },
        { key: "most_recent_visit", label: "Most Recent Visit", virtual: true },
        { key: "first_page_visited", label: "First Page Visited", virtual: true },
        { key: "average_time_spent_minutes", label: "Average Time Spent (Minutes)", virtual: true },
        { key: "number_of_chats", label: "Number Of Chats", virtual: true },
        { key: "referrer", label: "Referrer", virtual: true },
        { key: "visitor_score", label: "Visitor Score", virtual: true },
        { key: "first_visit", label: "First Visit", virtual: true },
        { key: "days_visited", label: "Days Visited", virtual: true },
        { key: "mailing_address_coordinates", label: "Mailing Address - Coordinates", virtual: true },
        { key: "mailing_address_flat_house_no_building_apartment_name", label: "Mailing Address - Flat / House No./ Building / Apartment Name", virtual: true },
        { key: "mailing_address_street_address", label: "Mailing Address - Street Address", virtual: true },
        { key: "mailing_address_city", label: "Mailing Address - City", virtual: true },
        { key: "mailing_address_state_province", label: "Mailing Address - State / Province", virtual: true },
        { key: "mailing_address_zip_postal_code", label: "Mailing Address - Zip / Postal Code", virtual: true },
        { key: "mailing_address_country_region", label: "Mailing Address - Country / Region", virtual: true },
        { key: "mailing_address_latitude", label: "Mailing Address - Latitude", virtual: true },
        { key: "mailing_address_longitude", label: "Mailing Address - Longitude", virtual: true },
        { key: "other_address_coordinates", label: "Other Address - Coordinates", virtual: true },
        { key: "other_address_flat_house_no_building_apartment_name", label: "Other Address - Flat / House No./ Building / Apartment Name", virtual: true },
        { key: "other_address_street_address", label: "Other Address - Street Address", virtual: true },
        { key: "other_address_city", label: "Other Address - City", virtual: true },
        { key: "other_address_state_province", label: "Other Address - State / Province", virtual: true },
        { key: "other_address_zip_postal_code", label: "Other Address - Zip / Postal Code", virtual: true },
        { key: "other_address_country_region", label: "Other Address - Country / Region", virtual: true },
        { key: "other_address_latitude", label: "Other Address - Latitude", virtual: true },
        { key: "other_address_longitude", label: "Other Address - Longitude", virtual: true },
      ],
      aliasDictionary: {
        contact_name: "full_name",
        name: "full_name",
        fullname: "full_name",
        "full name": "full_name",
        firstname: "first_name",
        "first name": "first_name",
        lastname: "last_name",
        "last name": "last_name",
        mail: "email",
        "email address": "email",
        phone: "phone",
        mobile: "mobile",
        "contact number": "phone",
        "account name": "account_name",
        "secondary email": "secondary_email",
        "other phone": "other_phone",
        "home phone": "home_phone",
        "assistant phone": "assistant_phone",
        "date of birth": "date_of_birth",
        "lead source": "lead_source",
        "contact owner": "contact_owner",
        owner: "owner",
        account: "account",
        fax: "fax",
        country: "country",
        street: "street",
        city: "city",
        state: "state",
        zipcode: "zip_code",
        "zip code": "zip_code",
        description: "description",
        vendor: "vendor_name",
        "contact id": "contact_id",
        "contact owner id": "contact_owner_id",
        "vendor id": "vendor_id",
        "asst phone": "assistant_phone",
        "email opt out": "email_opt_out",
        "skype id": "skype_id",
        "created by": "created_by",
        "created by id": "created_by_id",
        "modified by": "modified_by",
        "modified by id": "modified_by_id",
        "created time": "created_time",
        "modified time": "modified_time",
        "last activity time": "last_activity_time",
        twitter: "twitter",
        tag: "tag",
        "reporting to": "reporting_to",
        "reporting to id": "reporting_to_id",
        "unsubscribed mode": "unsubscribed_mode",
        "unsubscribed time": "unsubscribed_time",
        "record id": "record_id",
        "change log time": "change_log_time",
        "mailing address": "mailing_address",
        "other address": "other_address",
        "connected to": "connected_to",
        "connected to id": "connected_to_id",
        "most recent visit": "most_recent_visit",
        "first page visited": "first_page_visited",
        "average time spent minutes": "average_time_spent_minutes",
        "number of chats": "number_of_chats",
        referrer: "referrer",
        "visitor score": "visitor_score",
        "first visit": "first_visit",
        "days visited": "days_visited",
      },
      emailFields: new Set(["email", "secondary_email"]),
      phoneFields: new Set(["phone", "mobile", "other_phone", "home_phone", "assistant_phone"]),
      numberFields: new Set<string>(),
      integerFields: new Set<string>(),
      dateFields: new Set(["date_of_birth"]),
      duplicateField: "email",
    };
  }

  if (moduleKey === "accounts") {
    return {
      endpoint: "/accounts/import/",
      fields: [
        { key: "account_id", label: "Account ID", virtual: true },
        { key: "owner", label: "Account Owner" },
        { key: "account_owner_id", label: "Account Owner ID", virtual: true },
        { key: "account_name", label: "Account Name", required: true },
        { key: "name", label: "Name" },
        { key: "account_number", label: "Account Number" },
        { key: "account_type", label: "Account Type" },
        { key: "account_site", label: "Account Site" },
        { key: "parent_account", label: "Parent Account" },
        { key: "industry", label: "Industry" },
        { key: "annual_revenue", label: "Annual Revenue" },
        { key: "employees", label: "Employees" },
        { key: "employee_count", label: "Employee Count" },
        { key: "sic_code", label: "SIC Code" },
        { key: "ownership", label: "Ownership" },
        { key: "rating", label: "Rating" },
        { key: "phone", label: "Phone" },
        { key: "fax", label: "Fax" },
        { key: "website", label: "Website" },
        { key: "ticker_symbol", label: "Ticker Symbol" },
        { key: "billing_address", label: "Billing Address" },
        { key: "shipping_address", label: "Shipping Address" },
        { key: "description", label: "Description" },
        { key: "created_by", label: "Created By", virtual: true },
        { key: "created_by_id", label: "Created By ID", virtual: true },
        { key: "modified_by", label: "Modified By", virtual: true },
        { key: "modified_by_id", label: "Modified By ID", virtual: true },
        { key: "created_time", label: "Created Time", virtual: true },
        { key: "modified_time", label: "Modified Time", virtual: true },
        { key: "last_activity_time", label: "Last Activity Time", virtual: true },
        { key: "tag", label: "Tag", virtual: true },
        { key: "record_id", label: "Record ID", virtual: true },
        { key: "change_log_time", label: "Change Log Time", virtual: true },
        { key: "connected_to", label: "Connected To", virtual: true },
        { key: "connected_to_id", label: "Connected To Id", virtual: true },
        { key: "billing_address_coordinates", label: "Billing Address - Coordinates", virtual: true },
        { key: "billing_address_flat_house_no_building_apartment_name", label: "Billing Address - Flat / House No./ Building / Apartment Name", virtual: true },
        { key: "billing_address_street_address", label: "Billing Address - Street Address", virtual: true },
        { key: "billing_address_city", label: "Billing Address - City", virtual: true },
        { key: "billing_address_state_province", label: "Billing Address - State / Province", virtual: true },
        { key: "billing_address_zip_postal_code", label: "Billing Address - Zip / Postal Code", virtual: true },
        { key: "billing_address_country_region", label: "Billing Address - Country / Region", virtual: true },
        { key: "billing_address_latitude", label: "Billing Address - Latitude", virtual: true },
        { key: "billing_address_longitude", label: "Billing Address - Longitude", virtual: true },
        { key: "shipping_address_coordinates", label: "Shipping Address - Coordinates", virtual: true },
        { key: "shipping_address_flat_house_no_building_apartment_name", label: "Shipping Address - Flat / House No./ Building / Apartment Name", virtual: true },
        { key: "shipping_address_street_address", label: "Shipping Address - Street Address", virtual: true },
        { key: "shipping_address_city", label: "Shipping Address - City", virtual: true },
        { key: "shipping_address_state_province", label: "Shipping Address - State / Province", virtual: true },
        { key: "shipping_address_zip_postal_code", label: "Shipping Address - Zip / Postal Code", virtual: true },
        { key: "shipping_address_country_region", label: "Shipping Address - Country / Region", virtual: true },
        { key: "shipping_address_latitude", label: "Shipping Address - Latitude", virtual: true },
        { key: "shipping_address_longitude", label: "Shipping Address - Longitude", virtual: true },
      ],
      aliasDictionary: {
        name: "account_name",
        "account id": "account_id",
        owner: "owner",
        "account owner": "owner",
        "account owner id": "account_owner_id",
        "account name": "account_name",
        "account number": "account_number",
        "account type": "account_type",
        "account site": "account_site",
        "parent account": "parent_account",
        industry: "industry",
        "annual revenue": "annual_revenue",
        employees: "employees",
        "employee count": "employees",
        "sic code": "sic_code",
        ownership: "ownership",
        rating: "rating",
        "billing address": "billing_address",
        "shipping address": "shipping_address",
        "created by": "created_by",
        "created by id": "created_by_id",
        "modified by": "modified_by",
        "modified by id": "modified_by_id",
        "created time": "created_time",
        "modified time": "modified_time",
        "last activity time": "last_activity_time",
        tag: "tag",
        "record id": "record_id",
        "change log time": "change_log_time",
        "connected to": "connected_to",
        "connected to id": "connected_to_id",
        "billing address coordinates": "billing_address_coordinates",
        "billing address flat house no building apartment name": "billing_address_flat_house_no_building_apartment_name",
        "billing address street address": "billing_address_street_address",
        "billing address city": "billing_address_city",
        "billing address state province": "billing_address_state_province",
        "billing address zip postal code": "billing_address_zip_postal_code",
        "billing address country region": "billing_address_country_region",
        "billing address latitude": "billing_address_latitude",
        "billing address longitude": "billing_address_longitude",
        "shipping address coordinates": "shipping_address_coordinates",
        "shipping address flat house no building apartment name": "shipping_address_flat_house_no_building_apartment_name",
        "shipping address street address": "shipping_address_street_address",
        "shipping address city": "shipping_address_city",
        "shipping address state province": "shipping_address_state_province",
        "shipping address zip postal code": "shipping_address_zip_postal_code",
        "shipping address country region": "shipping_address_country_region",
        "shipping address latitude": "shipping_address_latitude",
        "shipping address longitude": "shipping_address_longitude",
      },
      emailFields: new Set<string>(),
      phoneFields: new Set(["phone", "fax"]),
      numberFields: new Set(["annual_revenue"]),
      integerFields: new Set(["employees", "employee_count"]),
      dateFields: new Set<string>(),
    };
  }

  if (moduleKey === "deals") {
    return {
      endpoint: "/deals/import/",
      fields: [
        { key: "deal_owner", label: "Deal Owner" },
        { key: "owner", label: "Owner" },
        { key: "deal_name", label: "Deal Name", required: true },
        { key: "name", label: "Name" },
        { key: "account", label: "Account ID" },
        { key: "account_name", label: "Account Name", required: true },
        { key: "contact", label: "Contact ID" },
        { key: "contact_email", label: "Contact Email" },
        { key: "lead", label: "Lead ID" },
        { key: "lead_email", label: "Lead Email" },
        { key: "amount", label: "Amount" },
        { key: "expected_revenue", label: "Expected Revenue" },
        { key: "value", label: "Value" },
        { key: "stage", label: "Stage" },
        { key: "probability", label: "Probability" },
        { key: "closing_date", label: "Closing Date" },
        { key: "type", label: "Type" },
        { key: "lead_source", label: "Lead Source" },
        { key: "campaign_source", label: "Campaign Source" },
        { key: "next_step", label: "Next Step" },
        { key: "forecast_category", label: "Forecast Category" },
        { key: "description", label: "Description" },
      ],
      aliasDictionary: {
        name: "deal_name",
        owner: "owner",
        "deal owner": "deal_owner",
        "deal name": "deal_name",
        account: "account",
        "account name": "account_name",
        contact: "contact",
        "contact email": "contact_email",
        lead: "lead",
        "lead email": "lead_email",
        "expected revenue": "expected_revenue",
        value: "value",
        "close date": "closing_date",
        "closing date": "closing_date",
        nextstep: "next_step",
        "next step": "next_step",
        "forecast category": "forecast_category",
        description: "description",
      },
      emailFields: new Set(["contact_email", "lead_email"]),
      phoneFields: new Set<string>(),
      numberFields: new Set(["amount", "expected_revenue", "value", "probability"]),
      integerFields: new Set(["probability"]),
      dateFields: new Set(["closing_date"]),
    };
  }

  return null;
};

type ParsedFile = {
  headers: string[];
  rows: Record<string, unknown>[];
};

type ImportErrorItem = {
  row?: number;
  errors?: Record<string, unknown>;
};

const SUPPORTED_EXTENSIONS = ["csv", "xml", "docx", "pdf", "xlsx", "txt"] as const;

const getFileExtension = (file: File) => file.name.split(".").pop()?.toLowerCase() ?? "";

const detectDelimiter = (line: string) => {
  if (line.includes("\t")) return "\t";
  if (line.includes("|")) return "|";
  return ",";
};

const flattenImportErrors = (value: unknown): string[] => {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(flattenImportErrors);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) => {
      const messages = flattenImportErrors(nested);
      if (!messages.length) return [];
      return messages.map((message) => `${key}: ${message}`);
    });
  }
  return [];
};

const parseTextRows = (text: string): ParsedFile => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Text formats require a header row plus at least one data row.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((value) => value.trim());
  if (headers.length === 0) {
    throw new Error("Could not detect columns in the uploaded file.");
  }

  const rows = lines
    .slice(1)
    .map((line) => {
      const cells = line.split(delimiter);
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        const cell = cells[index]?.trim();
        if (cell) {
          record[header] = cell;
        }
      });
      return record;
    })
    .filter((record) => Object.keys(record).length > 0);

  if (rows.length === 0) {
    throw new Error("No data rows could be parsed from the file.");
  }

  return { headers, rows };
};

const parseXmlRecords = (text: string): ParsedFile => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");
  const candidates = Array.from(
    xml.querySelectorAll("record, row, item, entry, data, document")
  );
  const effectiveNodes = candidates.length
    ? candidates
    : xml.documentElement.children.length
    ? Array.from(xml.documentElement.children)
    : [];

  if (effectiveNodes.length === 0) {
    throw new Error("XML file contains no record nodes.");
  }

  const headersSet = new Set<string>();
  const rows = effectiveNodes
    .map((node) => {
      const record: Record<string, unknown> = {};
      Array.from(node.children).forEach((child) => {
        const name = child.tagName.split(":").pop() ?? child.tagName;
        const value = child.textContent?.trim();
        if (value) {
          record[name] = value;
          headersSet.add(name);
        }
      });
      return record;
    })
    .filter((record) => Object.keys(record).length > 0);

  if (rows.length === 0) {
    throw new Error("XML nodes did not contain any usable data.");
  }

  return { headers: Array.from(headersSet), rows };
};

const extractDocxText = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const jsZipModule = await loadJsZipModule();
  const JSZip = (jsZipModule as { default?: { loadAsync: (data: ArrayBuffer) => Promise<any> } }).default
    ?? (jsZipModule as { loadAsync: (data: ArrayBuffer) => Promise<any> });
  const zip = await JSZip.loadAsync(buffer);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new Error("DOCX file is missing the document.xml entry.");
  }

  const documentXml = await documentFile.async("string");
  const parser = new DOMParser();
  const xml = parser.parseFromString(documentXml, "application/xml");
  const paragraphs = Array.from(xml.querySelectorAll("w\\:p, p"));
  const lines = paragraphs
    .map((para) =>
      Array.from(para.querySelectorAll("w\\:t, t"))
        .map((node) => node.textContent ?? "")
        .join("")
    )
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("DOCX file contains no textual content.");
  }

  return lines.join("\n");
};

const extractPdfText = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const { getDocument } = await loadPdfModule();
  const loadingTask = getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const textChunks: string[] = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdf.getPage(i);
    // eslint-disable-next-line no-await-in-loop
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str ?? "" : ""))
      .join(" ");
    textChunks.push(pageText);
  }

  pdf.destroy();
  return textChunks.join("\n");
};

const parseCsvFile = async (file: File): Promise<ParsedFile> => {
  const content = await file.text();
  const Papa = await loadPapaModule();
  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: "greedy",
  });

  if (parsed.errors?.length) {
    throw new Error(parsed.errors[0]?.message || "Invalid CSV format.");
  }

  const cleanedRows = (parsed.data || []).filter((row) =>
    Object.values(row || {}).some((value) => String(value ?? "").trim() !== "")
  );

  const headers = parsed.meta.fields ?? [];
  if (headers.length === 0) {
    throw new Error("CSV file has no headers.");
  }

  return { headers, rows: cleanedRows };
};

const parseXlsxFile = async (file: File): Promise<ParsedFile> => {
  const buffer = await file.arrayBuffer();
  const XLSX = await loadXlsxModule();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file contains no worksheets.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    blankrows: false,
  });

  if (rawRows.length === 0) {
    throw new Error("Excel file contains no rows.");
  }

  const headerRow = rawRows[0] as unknown[];
  const headers = headerRow.map((value, index) => {
    const label = String(value ?? "").trim();
    return label || `column_${index + 1}`;
  });

  const rows = rawRows
    .slice(1)
    .map((row: unknown) => {
      const cells = Array.isArray(row)
        ? row
        : row && typeof row === "object"
          ? Object.values(row)
          : [];
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        const cell = cells[index];
        if (cell !== undefined && cell !== null && String(cell).trim() !== "") {
          record[header] = cell;
        }
      });
      return record;
    })
    .filter((record) => Object.keys(record).length > 0);

  if (rows.length === 0) {
    throw new Error("Excel file contains no data rows.");
  }

  return { headers, rows };
};

const extractRawTextFromFile = async (file: File): Promise<string> => {
  const ext = getFileExtension(file);
  switch (ext) {
    case "docx":
      return extractDocxText(file);
    case "pdf":
      return extractPdfText(file);
    default:
      return file.text();
  }
};

const parseFileByExtension = async (file: File): Promise<ParsedFile> => {
  const ext = getFileExtension(file);
  if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
    throw new Error(
      `Unsupported format. Please upload one of ${SUPPORTED_EXTENSIONS.join(", ").toUpperCase()}.`
    );
  }

  switch (ext) {
    case "csv":
      return parseCsvFile(file);
    case "xml":
      return parseXmlRecords(await file.text());
    case "docx":
      return parseTextRows(await extractDocxText(file));
    case "pdf":
      return parseTextRows(await extractPdfText(file));
    case "xlsx":
      return parseXlsxFile(file);
    case "txt":
      return parseTextRows(await file.text());
    default:
      throw new Error("Unsupported file format.");
  }
};

export default function CRMImportPage({
  pageTitle,
  moduleLabel,
  mode,
  backPath,
  initialTargetRecordId,
}: CRMImportPageProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<Record<string, unknown> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [leadOptions, setLeadOptions] = useState<LeadRecord[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState(initialTargetRecordId ?? "");
  const [leadOptionsLoading, setLeadOptionsLoading] = useState(false);
  const [noteText, setNoteText] = useState("");

  const moduleKey = useMemo(
    () => backPath.replace("/", "").toLowerCase(),
    [backPath]
  );

  const isNotesMode = mode === "notes";

  const moduleConfig = useMemo(
    () => (isNotesMode ? buildNotesConfig(moduleKey) : buildModuleConfig(moduleKey)),
    [isNotesMode, moduleKey]
  );

  const fieldOptions = useMemo(() => moduleConfig?.fields ?? [], [moduleConfig]);

  const mappedFieldKeys = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);

  useEffect(() => {
    if (!isNotesMode || moduleKey !== "leads") return;

    let cancelled = false;
    const loadLeadOptions = async () => {
      try {
        setLeadOptionsLoading(true);
        const records = await getLeads({ pageSize: 200, maxPages: 5, cacheTtlMs: 60_000 });
        if (!cancelled) {
          setLeadOptions(records);
          if (initialTargetRecordId && records.some((record) => record.id === initialTargetRecordId)) {
            setSelectedLeadId(initialTargetRecordId);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(error instanceof Error ? error.message : "Failed to load leads.");
        }
      } finally {
        if (!cancelled) {
          setLeadOptionsLoading(false);
        }
      }
    };

    void loadLeadOptions();
    return () => {
      cancelled = true;
    };
  }, [initialTargetRecordId, isNotesMode, moduleKey]);

  const filteredLeadOptions = useMemo(() => {
    if (!leadSearch.trim()) return leadOptions.slice(0, 12);
    const query = leadSearch.trim().toLowerCase();
    return leadOptions
      .filter((lead) =>
        [lead.leadName, lead.company, lead.email]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
      )
      .slice(0, 12);
  }, [leadOptions, leadSearch]);

  const selectedLead = useMemo(
    () => leadOptions.find((lead) => lead.id === selectedLeadId) ?? null,
    [leadOptions, selectedLeadId]
  );

  const mapHeaderToField = (header: string) => {
    if (!moduleConfig) return "";
    const normalizedHeader = normalizeKey(header);
    const normalizedSlug = normalizeKeySlug(header);

    const directMatch = fieldOptions.find(
      (field) => normalizeKeySlug(field.key) === normalizedSlug
    );
    if (directMatch) return directMatch.key;

    const aliasMatch = moduleConfig.aliasDictionary[normalizedHeader];
    if (aliasMatch) return aliasMatch;

    let bestField = "";
    let bestScore = 0;
    fieldOptions.forEach((field) => {
      const fieldSlug = normalizeKeySlug(field.key);
      const fieldLabel = normalizeKey(field.label);
      const score = Math.max(
        similarity(normalizedSlug, fieldSlug),
        similarity(normalizedHeader, fieldLabel)
      );
      if (score > bestScore) {
        bestScore = score;
        bestField = field.key;
      }
    });

    return bestScore >= 0.82 ? bestField : "";
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    if (!moduleConfig) {
      setErrorMsg("Unsupported module for import.");
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setImportSummary(null);

    const extension = getFileExtension(file);
    if (!SUPPORTED_EXTENSIONS.includes(extension as (typeof SUPPORTED_EXTENSIONS)[number])) {
      setErrorMsg(
        `Unsupported format. Please upload one of ${SUPPORTED_EXTENSIONS.join(", ").toUpperCase()}.`
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg("File size exceeds 10MB.");
      return;
    }

    setIsProcessing(true);
    try {
      if (isNotesMode) {
        const rawText = await extractRawTextFromFile(file);
        if (!rawText.trim()) {
          throw new Error("The file appears to be empty.");
        }
        setSelectedFile(file);
        setNoteText(rawText.trim());
        setStep(2);
        setSuccessMsg("File uploaded successfully.");
      } else {
        const parsedFile = await parseFileByExtension(file);
        const parsedHeaders = parsedFile.headers;
        const parsedRows = parsedFile.rows;

        if (parsedRows.length > MAX_ROWS) {
          throw new Error(`File exceeds the limit of ${MAX_ROWS} rows.`);
        }

        const initialMapping: Record<string, string> = {};
        parsedHeaders.forEach((header) => {
          initialMapping[header] = mapHeaderToField(header);
        });

        setSelectedFile(file);
        setHeaders(parsedHeaders);
        setRows(parsedRows);
        setMapping(initialMapping);
        setStep(2);
        setSuccessMsg("File uploaded successfully.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read file.";
      setErrorMsg(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const normalizeValue = (value: unknown, field: string) => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    if (moduleConfig?.emailFields.has(field)) {
      return raw.toLowerCase();
    }
    if (moduleConfig?.integerFields.has(field)) {
      const parsed = Number.parseInt(raw.replace(/,/g, ""), 10);
      return Number.isNaN(parsed) ? raw : parsed;
    }
    if (moduleConfig?.numberFields.has(field)) {
      const parsed = Number.parseFloat(raw.replace(/,/g, ""));
      return Number.isNaN(parsed) ? raw : parsed;
    }
    if (moduleConfig?.dateFields.has(field)) {
      const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      }
      const altMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (altMatch) {
        return `${altMatch[3]}-${altMatch[1]}-${altMatch[2]}`;
      }
    }
    return raw;
  };

  const buildRecords = () => {
    if (!moduleConfig) return [];
    const virtualFieldKeys = new Set(
      moduleConfig.fields.filter((field) => field.virtual).map((field) => field.key)
    );
    const records: Record<string, unknown>[] = [];
    rows.forEach((row) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header) => {
        const fieldKey = mapping[header];
        if (!fieldKey) return;
        const value = normalizeValue(row[header], fieldKey);
        if (value === null) return;

        if (fieldKey === "full_name") {
          const parts = String(value).split(/\s+/).filter(Boolean);
          const firstName = parts.shift() ?? "";
          const lastName = parts.join(" ");
          if (!record.first_name && firstName) record.first_name = firstName;
          if (!record.last_name && lastName) record.last_name = lastName;
          return;
        }

        if (virtualFieldKeys.has(fieldKey)) {
          return;
        }

        if (!(fieldKey in record)) {
          record[fieldKey] = value;
        }
      });
      if (Object.keys(record).length > 0) {
        records.push(record);
      }
    });
    return records;
  };

  const mappingComplete = useMemo(() => {
    if (!moduleConfig) return false;
    const requiredFields = moduleConfig.fields.filter((field) => field.required);
    const mapped = new Set(Object.values(mapping).filter(Boolean));
    const hasFullName = mapped.has("full_name");

    return requiredFields.every((field) => {
      if (field.key === "first_name" || field.key === "last_name") {
        return mapped.has(field.key) || hasFullName;
      }
      if (field.key === "account_name" && moduleKey === "deals") {
        return mapped.has("account_name") || mapped.has("account");
      }
      return mapped.has(field.key);
    });
  }, [moduleConfig, mapping, moduleKey]);

  const mappingErrors = useMemo(() => {
    if (!moduleConfig) return [];
    const errors: string[] = [];
    const mapped = new Set(Object.values(mapping).filter(Boolean));
    const hasFullName = mapped.has("full_name");
    moduleConfig.fields
      .filter((field) => field.required)
      .forEach((field) => {
        if ((field.key === "first_name" || field.key === "last_name") && hasFullName) {
          return;
        }
        if (field.key === "account_name" && moduleKey === "deals") {
          if (mapped.has("account_name") || mapped.has("account")) return;
        }
        if (!mapped.has(field.key)) {
          errors.push(`${field.label} is required.`);
        }
      });
    return errors;
  }, [moduleConfig, mapping, moduleKey]);

  const unmappedHeaders = useMemo(
    () => headers.filter((header) => !mapping[header]),
    [headers, mapping]
  );

  const previewRows = useMemo(() => buildRecords().slice(0, PREVIEW_ROWS), [rows, mapping]);
  const previewColumns = useMemo(() => {
    const columns = new Set<string>();
    previewRows.forEach((row) => {
      Object.keys(row).forEach((key) => columns.add(key));
    });
    return Array.from(columns);
  }, [previewRows]);

  const handleImport = async () => {
    if (!moduleConfig) return;
    setErrorMsg(null);
    setImportSummary(null);
    setIsProcessing(true);

    try {
      if (isNotesMode) {
        if (moduleKey !== "leads") {
          throw new Error("Notes import is currently available only for leads.");
        }
        if (!selectedLeadId) {
          throw new Error("Please choose which lead should receive these notes.");
        }
        if (!noteText.trim()) {
          throw new Error("Note content is empty.");
        }

        let imported = 0;
        const errors: ImportErrorItem[] = [];

        try {
          await addLeadNote(selectedLeadId, noteText.trim());
          imported = 1;
        } catch (error) {
          errors.push({
            row: 1,
            errors: { note: error instanceof Error ? error.message : "Failed to import note." },
          });
        }

        setImportSummary({
          total: 1,
          imported,
          skipped: 0,
          errors: errors.length,
          errorDetails: errors,
          targetRecordName: selectedLead?.leadName ?? "Selected lead",
        });

        setStep(4);
        window.dispatchEvent(
          new CustomEvent("crm:imported", {
            detail: { module: moduleKey, recordId: selectedLeadId, importType: "notes" },
          })
        );
        return;
      }

      const records = buildRecords();
      if (records.length === 0) {
        throw new Error("No valid records found.");
      }
      if (records.length > MAX_ROWS) {
        throw new Error(`CSV exceeds the limit of ${MAX_ROWS} rows.`);
      }

      const emailDuplicates = new Set<string>();
      const seenEmails = new Set<string>();

      records.forEach((record) => {
        if (moduleConfig.duplicateField && typeof record[moduleConfig.duplicateField] === "string") {
          const email = String(record[moduleConfig.duplicateField]).toLowerCase();
          if (seenEmails.has(email)) emailDuplicates.add(email);
          seenEmails.add(email);
          record[moduleConfig.duplicateField] = email;
        }
      });

      if (emailDuplicates.size > 0) {
        throw new Error(
          `Duplicate emails in file: ${Array.from(emailDuplicates).slice(0, 10).join(", ")}`
        );
      }

      const invalids: string[] = [];
      records.forEach((record, index) => {
        moduleConfig.emailFields.forEach((field) => {
          const value = record[field];
          if (value && !emailPattern.test(String(value))) {
            invalids.push(`Row ${index + 2}: Invalid email in ${field}`);
          }
        });
        moduleConfig.phoneFields.forEach((field) => {
          const value = record[field];
          if (value && !phonePattern.test(String(value))) {
            invalids.push(`Row ${index + 2}: Invalid phone in ${field}`);
          }
        });
      });

      if (invalids.length > 0) {
        throw new Error(invalids.slice(0, 5).join("; "));
      }

      const batches = [];
      for (let i = 0; i < records.length; i += 500) {
        batches.push(records.slice(i, i + 500));
      }

      let imported = 0;
      let skipped = 0;
      const errors: unknown[] = [];

      for (const batch of batches) {
        const response = await apiRequest<{
          imported_count?: number;
          skipped_count?: number;
          error_count?: number;
          errors?: unknown[];
        }>(moduleConfig.endpoint, {
          method: "POST",
          body: JSON.stringify({ records: batch }),
        });

        imported += response.imported_count ?? 0;
        skipped += response.skipped_count ?? 0;
        if (response.errors) errors.push(...response.errors);
      }

      setImportSummary({
        total: records.length,
        imported,
        skipped,
        errors: errors.length,
        errorDetails: errors,
      });

      setStep(4);
      window.dispatchEvent(new CustomEvent("crm:imported", { detail: { module: moduleKey } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      setErrorMsg(message);
    } finally {
      setIsProcessing(false);
    }
  };

  

  return (
    <DashboardLayout>
      <div className="h-full overflow-hidden bg-[#f0fdf4]">
        <div className="border-b border-[#d9e1ef] bg-[#f0fdf4] px-6 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-[16px] font-semibold text-[#1f2d3d]">
              {moduleLabel}
            </h1>
          </div>
        </div>

        <div className="h-[calc(100%-57px)] overflow-y-auto">
          <div className="px-8 py-6">
            <h2 className="mb-4 text-[18px] font-semibold text-[#1f2d3d]">
              {pageTitle}
            </h2>

   

            {errorMsg && (
              <div className="mb-4 rounded-[6px] border border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-700">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-4 rounded-[6px] border border-green-200 bg-green-50 px-4 py-2 text-[13px] text-green-700">
                {successMsg}
              </div>
            )}

            {isNotesMode && moduleKey === "leads" && (
              <div className="mb-6 rounded-[14px] border border-[#d6def2] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-[#1f2d3d]">Choose the lead for these imported notes</p>
                    <p className="mt-1 text-[13px] text-slate-500">
                      Every imported row will be attached to the lead you select here.
                    </p>
                  </div>
                  {selectedLead ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700">
                      <CheckCircle2 size={14} />
                      {selectedLead.leadName}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 rounded-[12px] border border-slate-200 bg-slate-50/80 p-4">
                  <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Search Lead
                  </label>
                  <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2">
                    <Search size={16} className="text-slate-400" />
                    <input
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      placeholder="Search by name, company, or email"
                      className="w-full bg-transparent text-sm text-slate-700 outline-none"
                    />
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {leadOptionsLoading ? (
                      <div className="rounded-[10px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                        Loading leads...
                      </div>
                    ) : filteredLeadOptions.length > 0 ? (
                      filteredLeadOptions.map((lead) => {
                        const isSelected = lead.id === selectedLeadId;
                        return (
                          <button
                            key={lead.id}
                            type="button"
                            onClick={() => setSelectedLeadId(lead.id)}
                            className={`rounded-[12px] border px-4 py-3 text-left transition ${
                              isSelected
                                ? "border-green-500 bg-green-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-blue-200 hover:bg-green-50/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800">{lead.leadName}</p>
                                <p className="mt-1 truncate text-xs text-slate-500">{lead.company || "No company"}</p>
                                <p className="mt-1 truncate text-xs text-slate-400">{lead.email || "No email"}</p>
                              </div>
                              {isSelected ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" /> : null}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-[10px] border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                        No leads matched your search.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div
                className="rounded-[8px] border border-dashed border-[#cfd7e6] bg-white px-8 py-10 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#49c37d] text-[#49c37d]">
                  <FileText size={20} />
                </div>
                <p className="mb-2 text-[14px] text-slate-600">
                  {isNotesMode
                    ? "Upload TXT, DOCX, or PDF file (max 10MB)"
                    : "Upload CSV, XML, DOCX, XLSX, PDF, or TXT file (max 10MB)"}
                </p>
                <p className="mb-3 text-[13px] text-slate-500">Drag & drop or</p>
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  className="rounded-[6px] bg-gradient-to-b from-[#22c55e] to-[#16a34a] px-8 py-2 text-[14px] font-medium text-white"
                  disabled={isProcessing}
                >
                  Browse File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.xml,.docx,.xlsx,.pdf,.txt"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <p className="mt-4 text-[13px] text-slate-700">
                    Selected: {selectedFile.name}
                  </p>
                )}
                <div className="mt-6 text-[12px] text-slate-500">
                  Step 1: Upload File
                </div>
              </div>
            )}

            {step === 2 && isNotesMode && (
              <div className="rounded-[8px] border border-[#e2e8f0] bg-white p-6">
                <h3 className="mb-1 text-[15px] font-semibold text-slate-700">Note Preview</h3>
                <p className="mb-4 text-[13px] text-slate-500">
                  Review the content below. Edit if needed, then click Import.
                </p>
                <textarea
                  className="w-full rounded-[6px] border border-[#cfd7e6] bg-slate-50 p-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  rows={14}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <div className="mt-6 flex justify-between">
                  <button
                    type="button"
                    className="rounded-[6px] border border-[#cfd7e6] bg-white px-6 py-2 text-[13px] text-slate-600"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="rounded-[6px] bg-[#22c55e] px-6 py-2 text-[13px] font-medium text-white disabled:opacity-70"
                    disabled={isProcessing || !noteText.trim()}
                    onClick={handleImport}
                  >
                    {isProcessing ? "Importing..." : "Import"}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && !isNotesMode && (
              <div className="rounded-[8px] border border-[#e2e8f0] bg-white p-6">
                <h3 className="mb-4 text-[15px] font-semibold text-slate-700">
                  Field Mapping
                </h3>
                <div className="grid grid-cols-[1fr_1fr] gap-3 text-[13px] text-slate-500">
                  <span>File Column</span>
                  <span>CRM Field</span>
                </div>
                <div className="mt-3 flex flex-col gap-3">
                  {headers.map((header) => (
                    <div key={header} className="grid grid-cols-[1fr_1fr] gap-3">
                      <div className="rounded-[6px] border border-[#e2e8f0] bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                        {header}
                      </div>
                      <select
                        className="rounded-[6px] border border-[#cfd7e6] bg-white px-3 py-2 text-[13px] text-slate-700"
                        value={mapping[header] ?? ""}
                        onChange={(e) =>
                          setMapping((prev) => ({
                            ...prev,
                            [header]: e.target.value,
                          }))
                        }
                      >
                        <option value="">-- Unmapped --</option>
                        {fieldOptions.map((field) => {
                          const isSelected = mapping[header] === field.key;
                          const disabled =
                            !isSelected && mappedFieldKeys.has(field.key);
                          return (
                            <option key={field.key} value={field.key} disabled={disabled}>
                              {field.label}
                              {field.required ? " *" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ))}
                </div>
                {mappingErrors.length > 0 && (
                  <div className="mt-4 text-[12px] text-amber-600">
                    {mappingErrors.join(" ")}
                  </div>
                )}
                {unmappedHeaders.length > 0 && (
                  <div className="mt-2 text-[12px] text-slate-500">
                    Unmapped columns: {unmappedHeaders.join(", ")}. Please map them if needed.
                  </div>
                )}
                <div className="mt-6 flex justify-between">
                  <button
                    type="button"
                    className="rounded-[6px] border border-[#cfd7e6] bg-white px-6 py-2 text-[13px] text-slate-600"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="rounded-[6px] bg-[#a9b7f7] px-6 py-2 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={!mappingComplete}
                    onClick={() => setStep(3)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="rounded-[8px] border border-[#e2e8f0] bg-white p-6">
                <h3 className="mb-4 text-[15px] font-semibold text-slate-700">
                  Preview (first {PREVIEW_ROWS} rows)
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-[12px] text-slate-600">
                    <thead className="border-b border-[#e2e8f0]">
                      <tr>
                        {previewColumns.map((col) => (
                          <th key={col} className="px-3 py-2 font-semibold text-slate-700">
                            {col.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, index) => (
                        <tr key={`preview-${index}`} className="border-b border-[#f1f5f9]">
                          {previewColumns.map((col) => (
                            <td key={col} className="px-3 py-2">
                              {String(row[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-between">
                  <button
                    type="button"
                    className="rounded-[6px] border border-[#cfd7e6] bg-white px-6 py-2 text-[13px] text-slate-600"
                    onClick={() => setStep(2)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="rounded-[6px] bg-[#22c55e] px-6 py-2 text-[13px] font-medium text-white disabled:opacity-70"
                    disabled={isProcessing}
                    onClick={handleImport}
                  >
                    {isProcessing ? "Importing..." : "Import"}
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="rounded-[8px] border border-[#e2e8f0] bg-white p-6">
                <h3 className="mb-4 text-[15px] font-semibold text-slate-700">
                  Import Summary
                </h3>
                {importSummary ? (
                  <div className="space-y-5">
                    {"targetRecordName" in importSummary ? (
                      <div className="rounded-[8px] border border-green-100 bg-green-50 px-4 py-3 text-[13px] text-green-700">
                        Notes were imported into{" "}
                        <span className="font-semibold">{String(importSummary.targetRecordName ?? "")}</span>.
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-4 text-[13px] text-slate-700">
                      <div>Total Records: {String(importSummary.total ?? 0)}</div>
                      <div>Imported: {String(importSummary.imported ?? 0)}</div>
                      <div>Skipped: {String(importSummary.skipped ?? 0)}</div>
                      <div>Errors: {String(importSummary.errors ?? 0)}</div>
                    </div>

                    {Array.isArray((importSummary as { errorDetails?: ImportErrorItem[] }).errorDetails) &&
                      ((importSummary as { errorDetails?: ImportErrorItem[] }).errorDetails?.length ?? 0) > 0 && (
                        <div className="rounded-[6px] border border-red-200 bg-red-50 p-4">
                          <h4 className="mb-3 text-[13px] font-semibold text-red-700">
                            Import Errors
                          </h4>
                          <div className="max-h-56 space-y-2 overflow-y-auto text-[12px] text-red-700">
                            {((importSummary as { errorDetails?: ImportErrorItem[] }).errorDetails ?? []).map((item, index) => (
                              <div key={`import-error-${index}`} className="rounded-[4px] bg-white/70 px-3 py-2">
                                <div className="font-medium">Row {item.row ?? index + 1}</div>
                                <div>
                                  {flattenImportErrors(item.errors).join(" | ") || "Unknown validation error"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-600">
                    Import completed.
                  </p>
                )}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="rounded-[6px] bg-[#22c55e] px-6 py-2 text-[13px] font-medium text-white"
                    onClick={() => navigate(backPath)}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {mode !== "module" && moduleKey !== "leads" && (
              <div className="mt-6 text-[12px] text-slate-500">
                Notes import is currently available only for leads.
              </div>
            )}

            <div className="mt-10 flex justify-end">
              <button
                type="button"
                onClick={() => navigate(backPath)}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
