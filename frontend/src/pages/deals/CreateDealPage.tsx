import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CRMCreatePage, { type CRMCreateSection } from "../../components/crm/CRMCreatePage";
import { getAccounts } from "../../lib/api/accountsApi";
import { getContacts } from "../../lib/api/contactsApi";
import { createDeal } from "../../lib/api/dealsApi";
import { getLoggedInUserName } from "../../lib/auth/currentUser";
import {
  DEAL_STAGE_OPTIONS,
  DEAL_TYPE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
} from "../../config/crm/createOptions";

type DealCreateValues = {
  dealOwner: string;
  dealName: string;
  accountName: string;
  contactName: string;
  amount: string;
  closingDate: string;
  stage: string;
  probability: string;
  type: string;
  leadSource: string;
  nextStep: string;
  description: string;
};

export default function CreateDealPage() {
  const [searchParams] = useSearchParams();
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [contactOptions, setContactOptions] = useState<string[]>([]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [accounts, contacts] = await Promise.all([getAccounts(), getContacts()]);
        setAccountOptions(accounts.map((account) => account.accountName).filter(Boolean));
        setContactOptions(contacts.map((contact) => contact.contactName).filter(Boolean));
      } catch {
        setAccountOptions([]);
        setContactOptions([]);
      }
    };

    void loadLookups();
  }, []);

  const initialValues = useMemo<DealCreateValues>(
    () => ({
      dealOwner: searchParams.get("owner") ?? getLoggedInUserName(),
      dealName: searchParams.get("dealName") ?? "",
      accountName: searchParams.get("accountName") ?? "",
      contactName: searchParams.get("contactName") ?? "",
      amount: "",
      closingDate: "",
      stage: "Qualification",
      probability: "",
      type: "",
      leadSource: "",
      nextStep: "",
      description: "",
    }),
    [searchParams]
  );

  const sections: CRMCreateSection[] = useMemo(
    () => [
      {
        title: "Deal Information",
        fields: [
          { name: "dealOwner", label: "Deal Owner", type: "owner", readOnly: true },
          { name: "dealName", label: "Deal Name", type: "text", required: true },
          { name: "accountName", label: "Account Name", type: "lookup", required: true, options: accountOptions, placeholder: "Search or select an account" },
          { name: "contactName", label: "Contact Name", type: "lookup", options: contactOptions, placeholder: "Search or select a contact" },
          { name: "amount", label: "Amount", type: "currency" },
          { name: "closingDate", label: "Closing Date", type: "text", placeholder: "YYYY-MM-DD" },
          { name: "stage", label: "Stage", type: "select", required: true, options: DEAL_STAGE_OPTIONS },
          { name: "probability", label: "Probability (%)", type: "number" },
          { name: "type", label: "Type", type: "select", options: DEAL_TYPE_OPTIONS },
          { name: "leadSource", label: "Lead Source", type: "select", options: LEAD_SOURCE_OPTIONS },
          { name: "nextStep", label: "Next Step", type: "text" },
        ],
      },
      {
        title: "Description Information",
        fields: [{ name: "description", label: "Description", type: "textarea", rows: 5 }],
      },
    ],
    [accountOptions, contactOptions]
  );

  const handleSubmit = async (values: DealCreateValues) => {
    const created = await createDeal({
      dealOwner: values.dealOwner,
      dealName: values.dealName,
      accountName: values.accountName,
      contactName: values.contactName,
      amount: values.amount,
      closingDate: values.closingDate,
      stage: values.stage,
      probability: values.probability,
      type: values.type,
      leadSource: values.leadSource,
      nextStep: values.nextStep,
      description: values.description,
    });
    return {
      redirectTo: `/deals/${created.id}`,
      state: { record: created },
    };
  };

  return (
    <CRMCreatePage
      title="Create Deal"
      initialValues={initialValues}
      sections={sections}
      backPath="/deals"
      onSubmit={handleSubmit}
    />
  );
}
