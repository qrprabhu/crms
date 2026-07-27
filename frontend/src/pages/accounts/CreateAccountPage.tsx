import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import CRMCreatePage, { type CRMCreateSection } from "../../components/crm/CRMCreatePage";
import { createAccount } from "../../lib/api/accountsApi";
import { getLoggedInUserName } from "../../lib/auth/currentUser";
import { ACCOUNT_TYPE_OPTIONS, INDUSTRY_OPTIONS } from "../../config/crm/createOptions";

type AccountCreateValues = {
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

export default function CreateAccountPage() {
  const [searchParams] = useSearchParams();

  const initialValues = useMemo<AccountCreateValues>(
    () => ({
      accountOwner: searchParams.get("owner") ?? getLoggedInUserName(),
      accountName: searchParams.get("accountName") ?? "",
      accountType: "",
      phone: "",
      website: "",
      industry: "",
      annualRevenue: "",
      employees: "",
      country: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      description: "",
    }),
    [searchParams]
  );

  const handleSubmit = async (values: AccountCreateValues) => {
    const created = await createAccount({
      accountOwner: values.accountOwner,
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
    return {
      redirectTo: `/accounts/${created.id}`,
      state: { record: created },
    };
  };

  return (
    <CRMCreatePage
      title="Create Account"
      initialValues={initialValues}
      sections={sections}
      backPath="/accounts"
      onSubmit={handleSubmit}
    />
  );
}
