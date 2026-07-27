import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CRMCreatePage, { type CRMCreateSection } from "../../components/crm/CRMCreatePage";
import { getContactById, updateContact } from "../../lib/api/contactsApi";
import { SALUTATION_OPTIONS } from "../../config/crm/createOptions";

type ContactEditValues = {
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

const sections: CRMCreateSection[] = [
  {
    title: "Contact Information",
    fields: [
      { name: "contactOwner", label: "Contact Owner", type: "owner", readOnly: true },
      { name: "salutation", label: "First Name", type: "name-composite", options: SALUTATION_OPTIONS, secondaryName: "firstName", secondaryRequired: true },
      { name: "accountName", label: "Account Name", type: "text", required: true },
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
];

export default function EditContactPage() {
  const { id } = useParams<{ id: string }>();
  const [initialValues, setInitialValues] = useState<ContactEditValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const contact = await getContactById(id);
        if (!contact) { setError("Contact not found"); return; }
        setInitialValues({
          contactOwner: contact.contactOwner,
          salutation: "",
          firstName: contact.firstName,
          lastName: contact.lastName,
          accountName: contact.accountName,
          title: contact.title,
          department: contact.department,
          email: contact.email,
          phone: contact.phone,
          mobile: contact.mobile,
          otherPhone: contact.otherPhone,
          fax: contact.fax,
          assistant: "",
          assistantPhone: "",
          country: "",
          street: "",
          city: "",
          state: "",
          zipCode: "",
          description: "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load contact");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading contact...</div>;
  if (error || !initialValues) return <div className="p-6 text-sm text-rose-600">{error ?? "Contact not found"}</div>;

  const handleSubmit = async (values: ContactEditValues) => {
    await updateContact(id!, {
      firstName: values.firstName,
      lastName: values.lastName,
      title: values.title,
      department: values.department,
      email: values.email,
      phone: values.phone,
      mobile: values.mobile,
      otherPhone: values.otherPhone,
      fax: values.fax,
      country: values.country,
      street: values.street,
      city: values.city,
      state: values.state,
      zipCode: values.zipCode,
      description: values.description,
    });
  };

  return (
    <CRMCreatePage
      title="Edit Contact"
      initialValues={initialValues}
      sections={sections}
      backPath="/contacts"
      onSubmit={handleSubmit}
    />
  );
}
