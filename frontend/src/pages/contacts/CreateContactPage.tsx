import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CRMCreatePage, { type CRMCreateSection } from "../../components/crm/CRMCreatePage";
import { getAccounts } from "../../lib/api/accountsApi";
import { createContact } from "../../lib/api/contactsApi";
import { getLeadById } from "../../lib/api/leadsApi";
import { getLoggedInUserName } from "../../lib/auth/currentUser";
import { SALUTATION_OPTIONS } from "../../config/crm/createOptions";

type ContactCreateValues = {
  contactOwner: string;
  salutation: string;
  firstName: string;
  lastName: string;
  accountName: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  mobile: string;
  otherPhone: string;
  fax: string;
  assistant: string;
  assistantPhone: string;
  country: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  description: string;
};

const baseInitialValues: ContactCreateValues = {
  contactOwner: "",
  salutation: "",
  firstName: "",
  lastName: "",
  accountName: "",
  title: "",
  department: "",
  email: "",
  phone: "",
  mobile: "",
  otherPhone: "",
  fax: "",
  assistant: "",
  assistantPhone: "",
  country: "",
  street: "",
  city: "",
  state: "",
  zipCode: "",
  description: "",
};

export default function CreateContactPage() {
  const [searchParams] = useSearchParams();
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [initialValues, setInitialValues] = useState<ContactCreateValues>({
    ...baseInitialValues,
    contactOwner: getLoggedInUserName(),
  });

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accounts = await getAccounts();
        setAccountOptions(accounts.map((account) => account.accountName).filter(Boolean));
      } catch {
        setAccountOptions([]);
      }
    };

    void loadAccounts();
  }, []);

  useEffect(() => {
    const leadId = searchParams.get("leadId");
    const accountName = searchParams.get("accountName") ?? "";
    const contactName = searchParams.get("contactName") ?? "";
    const ownerName = searchParams.get("owner") ?? getLoggedInUserName();

    const hydrateFromLead = async () => {
      if (!leadId) {
        const [firstName, ...rest] = contactName.split(" ").filter(Boolean);
        setInitialValues({
          ...baseInitialValues,
          contactOwner: ownerName,
          accountName,
          firstName: firstName ?? "",
          lastName: rest.join(" "),
        });
        return;
      }

      try {
        const lead = await getLeadById(leadId);
        if (!lead) return;
        setInitialValues({
          ...baseInitialValues,
          contactOwner: lead.leadOwner || ownerName,
          firstName: lead.firstName,
          lastName: lead.lastName,
          accountName: lead.company,
          title: lead.title,
          email: lead.email,
          phone: lead.phone,
          mobile: lead.mobile,
          country: lead.country,
          street: lead.address,
          city: lead.city,
          state: lead.state,
          zipCode: lead.zipCode,
          description: lead.description,
        });
      } catch {
        setInitialValues((prev) => ({
          ...prev,
          contactOwner: ownerName,
          accountName,
        }));
      }
    };

    void hydrateFromLead();
  }, [searchParams]);

  const sections: CRMCreateSection[] = useMemo(
    () => [
      {
        title: "Contact Information",
        fields: [
          { name: "contactOwner", label: "Contact Owner", type: "owner", readOnly: true },
          {
            name: "salutation",
            label: "First Name",
            type: "name-composite",
            options: SALUTATION_OPTIONS,
            secondaryName: "firstName",
            secondaryRequired: true,
          },
          { name: "accountName", label: "Account Name", type: "lookup", required: true, options: accountOptions, placeholder: "Search or select an account" },
          { name: "title", label: "Title", type: "text" },
          { name: "department", label: "Department", type: "text" },
          { name: "email", label: "Email", type: "email" },
          { name: "phone", label: "Phone", type: "text" },

          { name: "lastName", label: "Last Name", type: "text", required: true },
          { name: "mobile", label: "Mobile", type: "text" },
          { name: "otherPhone", label: "Other Phone", type: "text" },
          { name: "fax", label: "Fax", type: "text" },
          { name: "assistant", label: "Assistant", type: "text" },
          { name: "assistantPhone", label: "Assistant Phone", type: "text" },
        ],
      },
      {
        title: "Address Information",
        cardStyle: "boxed",
        cardTitle: "Mailing Address",
        widthClassName: "w-[48%]",
        fields: [
          { name: "country", label: "Country / Region", type: "country" },
          { name: "street", label: "Street", type: "text" },
          { name: "city", label: "City", type: "text" },
          { name: "state", label: "State / Province", type: "state" },
          { name: "zipCode", label: "Zip / Postal Code", type: "text" },
        ],
      },
      {
        title: "Description Information",
        fields: [{ name: "description", label: "Description", type: "textarea", rows: 5 }],
      },
    ],
    [accountOptions]
  );

  const handleSubmit = async (values: ContactCreateValues) => {
    const created = await createContact({
      contactOwner: values.contactOwner,
      salutation: values.salutation,
      firstName: values.firstName,
      lastName: values.lastName,
      accountName: values.accountName,
      title: values.title,
      department: values.department,
      email: values.email,
      phone: values.phone,
      mobile: values.mobile,
      otherPhone: values.otherPhone,
      fax: values.fax,
      assistant: values.assistant,
      assistantPhone: values.assistantPhone,
      country: values.country,
      street: values.street,
      city: values.city,
      state: values.state,
      zipCode: values.zipCode,
      description: values.description,
    });
    return {
      redirectTo: `/contacts/${created.id}`,
      state: { record: created },
    };
  };

  return (
    <CRMCreatePage
      title="Create Contact"
      initialValues={initialValues}
      sections={sections}
      backPath="/contacts"
      onSubmit={handleSubmit}
    />
  );
}
