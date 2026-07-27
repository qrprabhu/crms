import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CRMCreatePage, { type CRMCreateSection } from "../../components/crm/CRMCreatePage";
import { getAccountById, updateAccount } from "../../lib/api/accountsApi";
import { ACCOUNT_TYPE_OPTIONS, INDUSTRY_OPTIONS } from "../../config/crm/createOptions";

type AccountEditValues = {
  accountOwner: string;
  accountName: string;
  accountType: string;
  phone: string;
  website: string;
  industry: string;
  annualRevenue: string;
  employees: string;
  country: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  description: string;
};

const sections: CRMCreateSection[] = [
  {
    title: "Account Information",
    fields: [
      { name: "accountOwner", label: "Account Owner", type: "owner", readOnly: true },
      { name: "accountName", label: "Account Name", type: "text", required: true },
      { name: "accountType", label: "Account Type", type: "select", options: ACCOUNT_TYPE_OPTIONS },
      { name: "phone", label: "Phone", type: "text" },
      { name: "website", label: "Website", type: "text" },
      { name: "industry", label: "Industry", type: "select", options: INDUSTRY_OPTIONS },
      { name: "annualRevenue", label: "Annual Revenue", type: "currency" },
      { name: "employees", label: "Employees", type: "number" },
    ],
  },
  {
    title: "Address Information",
    cardStyle: "boxed",
    cardTitle: "Billing Address",
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

export default function EditAccountPage() {
  const { id } = useParams<{ id: string }>();
  const [initialValues, setInitialValues] = useState<AccountEditValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const account = await getAccountById(id);
        if (!account) { setError("Account not found"); return; }
        setInitialValues({
          accountOwner: account.accountOwner,
          accountName: account.accountName,
          accountType: "",
          phone: account.phone,
          website: account.website,
          industry: account.industry,
          annualRevenue: account.annualRevenue ? String(account.annualRevenue) : "",
          employees: account.employees ? String(account.employees) : "",
          country: "",
          street: "",
          city: "",
          state: "",
          zipCode: "",
          description: account.description,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading account...</div>;
  if (error || !initialValues) return <div className="p-6 text-sm text-rose-600">{error ?? "Account not found"}</div>;

  const handleSubmit = async (values: AccountEditValues) => {
    await updateAccount(id!, {
      accountName: values.accountName,
      accountType: values.accountType,
      phone: values.phone,
      website: values.website,
      industry: values.industry,
      annualRevenue: values.annualRevenue,
      employees: values.employees,
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
      title="Edit Account"
      initialValues={initialValues}
      sections={sections}
      backPath="/accounts"
      onSubmit={handleSubmit}
    />
  );
}
