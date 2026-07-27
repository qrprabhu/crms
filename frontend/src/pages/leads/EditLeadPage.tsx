import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CRMCreatePage, { type CRMCreateSection } from "../../components/crm/CRMCreatePage";
import { getLeadById, updateLead } from "../../lib/api/leadsApi";
import {
  INDUSTRY_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  LEAD_STATUS_OPTIONS,
  RATING_OPTIONS,
  SALUTATION_OPTIONS,
} from "../../config/crm/createOptions";

const sanitizeAlphaSpace = (value: string) => value.replace(/[^A-Za-z ]+/g, "");
const sanitizeDigits = (value: string) => value.replace(/\D+/g, "");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validateRequired = (label: string) => (value: string) =>
  value.trim() ? null : `${label} is required.`;
const validateRequiredEmail = (value: string) => {
  if (!value.trim()) return "Email is required.";
  if (!emailPattern.test(value.trim())) return "Please enter a valid email address.";
  return null;
};
const validateRequiredPhone = (value: string) => {
  if (!value.trim()) return "Phone number is required.";
  if (value.length !== 10) return "Phone number must be exactly 10 digits.";
  return null;
};

type LeadEditValues = {
  leadOwner: string;
  salutation: string;
  firstName: string;
  company: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  fax: string;
  mobile: string;
  website: string;
  leadSource: string;
  leadStatus: string;
  industry: string;
  noOfEmployees: string;
  annualRevenue: string;
  rating: string;
  emailOptOut: boolean;
  skypeId: string;
  secondaryEmail: string;
  twitter: string;
  country: string;
  flatNo: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: string;
  longitude: string;
  description: string;
};

const sections: CRMCreateSection[] = [
  {
    title: "Lead Information",
    fields: [
      { name: "leadOwner", label: "Lead Owner", type: "owner", readOnly: true },
      {
        name: "firstName",
        label: "First Name",
        type: "text",
        required: true,
        sanitizeValue: sanitizeAlphaSpace,
        maxLength: 30,
        validateValue: validateRequired("First Name"),
      },
      {
        name: "lastName",
        label: "Last Name",
        type: "text",
        sanitizeValue: sanitizeAlphaSpace,
        maxLength: 30,
      },
      {
        name: "title",
        label: "Title",
        type: "text",
        sanitizeValue: sanitizeAlphaSpace,
      },
      {
        name: "phone",
        label: "Phone",
        type: "text",
        required: true,
        sanitizeValue: sanitizeDigits,
        inputMode: "numeric",
        maxLength: 10,
        validateValue: validateRequiredPhone,
      },
      {
        name: "mobile",
        label: "Mobile",
        type: "text",
        sanitizeValue: sanitizeDigits,
        inputMode: "numeric",
        maxLength: 10,
      },
      { name: "salutation", label: "Salutation", type: "select", options: SALUTATION_OPTIONS },
      { name: "leadSource", label: "Lead Source", type: "select", options: LEAD_SOURCE_OPTIONS },
      { name: "industry", label: "Industry", type: "select", options: INDUSTRY_OPTIONS },
      {
        name: "annualRevenue",
        label: "Annual Revenue",
        type: "currency",
        sanitizeValue: sanitizeDigits,
        inputMode: "numeric",
      },
      { name: "emailOptOut", label: "Email Opt Out", type: "checkbox" },

      {
        name: "company",
        label: "Company",
        type: "text",
        required: true,
        sanitizeValue: sanitizeAlphaSpace,
        validateValue: validateRequired("Company"),
      },
      { name: "email", label: "Email", type: "email", required: true, validateValue: validateRequiredEmail },
      { name: "fax", label: "Fax", type: "text" },
      { name: "website", label: "Website", type: "text" },
      { name: "leadStatus", label: "Lead Status", type: "select", options: LEAD_STATUS_OPTIONS },
      {
        name: "noOfEmployees",
        label: "No. of Employees",
        type: "number",
        sanitizeValue: sanitizeDigits,
        inputMode: "numeric",
      },
      { name: "rating", label: "Rating", type: "select", options: RATING_OPTIONS },
      { name: "skypeId", label: "Skype ID", type: "text" },
      { name: "secondaryEmail", label: "Secondary Email", type: "email" },
      { name: "twitter", label: "Twitter", type: "text" },
    ],
  },
  {
    title: "Address Information",
    cardStyle: "boxed",
    cardTitle: "Address",
    widthClassName: "w-[48%]",
    fields: [
      { name: "country", label: "Country / Region", type: "country" },
      { name: "flatNo", label: "Flat / House No./ Building / Apartment Name", type: "text" },
      { name: "street", label: "Street Address", type: "text" },
      { name: "city", label: "City", type: "text" },
      { name: "state", label: "State / Province", type: "state" },
      { name: "zipCode", label: "Zip / Postal Code", type: "text" },
      { name: "latitude", label: "Latitude", type: "text" },
      { name: "longitude", label: "Longitude", type: "text" },
    ],
  },
  {
    title: "Description Information",
    fields: [{ name: "description", label: "Description", type: "textarea", rows: 5 }],
  },
];

export default function EditLeadPage() {
  const { id } = useParams<{ id: string }>();
  const [initialValues, setInitialValues] = useState<LeadEditValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const lead = await getLeadById(id);
        if (!lead) { setError("Lead not found"); return; }
        setInitialValues({
          leadOwner: lead.leadOwner,
          salutation: "",
          firstName: lead.firstName,
          company: lead.company,
          lastName: lead.lastName,
          title: lead.title,
          email: lead.email,
          phone: lead.phone,
          fax: lead.fax,
          mobile: lead.mobile,
          website: lead.website,
          leadSource: lead.leadSource,
          leadStatus: lead.leadStatus,
          industry: lead.industry,
          noOfEmployees: lead.noOfEmployees ? String(lead.noOfEmployees) : "",
          annualRevenue: lead.annualRevenue ? String(lead.annualRevenue) : "",
          rating: lead.rating,
          emailOptOut: false,
          skypeId: "",
          secondaryEmail: lead.secondaryEmail,
          twitter: "",
          country: lead.country,
          flatNo: "",
          street: lead.address,
          city: lead.city,
          state: lead.state,
          zipCode: lead.zipCode,
          latitude: "",
          longitude: "",
          description: lead.description,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lead");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading lead...</div>;
  if (error || !initialValues) return <div className="p-6 text-sm text-rose-600">{error ?? "Lead not found"}</div>;

  const handleSubmit = async (values: LeadEditValues) => {
    // No domain restriction

    await updateLead(id!, {
      leadOwner: values.leadOwner,
      firstName: values.firstName,
      lastName: values.lastName,
      company: values.company,
      title: values.title,
      email: values.email,
      phone: values.phone,
      fax: values.fax,
      mobile: values.mobile,
      website: values.website,
      leadSource: values.leadSource,
      leadStatus: values.leadStatus,
      industry: values.industry,
      noOfEmployees: values.noOfEmployees,
      annualRevenue: values.annualRevenue,
      rating: values.rating,
      secondaryEmail: values.secondaryEmail,
      skypeId: values.skypeId,
      country: values.country,
      flatNo: values.flatNo,
      street: values.street,
      city: values.city,
      state: values.state,
      zipCode: values.zipCode,
      description: values.description,
    });
  };

  return (
    <CRMCreatePage
      title="Edit Lead"
      initialValues={initialValues}
      sections={sections}
      backPath="/leads"
      onSubmit={handleSubmit}
    />
  );
}
