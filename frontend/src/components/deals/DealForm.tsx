import React, { useState } from "react";
import { dealOwners } from "../../lib/mock/dealOwners";
import { dealStages } from "../../lib/mock/dealStages";

interface DealFormProps {
  onSubmit: (values: any) => void;
  initialValues?: any;
}

const DealForm: React.FC<DealFormProps> = ({ onSubmit, initialValues = {} }) => {
  const [values, setValues] = useState<any>({
    dealOwner: initialValues.dealOwner || "",
    dealName: initialValues.dealName || "",
    accountName: initialValues.accountName || "",
    contactName: initialValues.contactName || "",
    type: initialValues.type || "",
    leadSource: initialValues.leadSource || "",
    campaignSource: initialValues.campaignSource || "",
    amount: initialValues.amount || 0,
    closingDate: initialValues.closingDate || "",
    stage: initialValues.stage || dealStages[0],
    probability: initialValues.probability || 10,
    expectedRevenue: initialValues.expectedRevenue || 0,
    nextStep: initialValues.nextStep || "",
    description: initialValues.description || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setValues((v: any) => ({ ...v, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <select name="dealOwner" value={values.dealOwner} onChange={handleChange} className="border rounded px-2 py-1">
        <option value="">Select Owner</option>
        {dealOwners.map((owner) => (
          <option key={owner.id} value={owner.id}>{owner.name}</option>
        ))}
      </select>
      <input name="dealName" value={values.dealName} onChange={handleChange} placeholder="Deal Name" className="border rounded px-2 py-1" />
      <input name="accountName" value={values.accountName} onChange={handleChange} placeholder="Account Name" className="border rounded px-2 py-1" />
      <input name="contactName" value={values.contactName} onChange={handleChange} placeholder="Contact Name" className="border rounded px-2 py-1" />
      <input name="type" value={values.type} onChange={handleChange} placeholder="Type" className="border rounded px-2 py-1" />
      <input name="leadSource" value={values.leadSource} onChange={handleChange} placeholder="Lead Source" className="border rounded px-2 py-1" />
      <input name="campaignSource" value={values.campaignSource} onChange={handleChange} placeholder="Campaign Source" className="border rounded px-2 py-1" />
      <input name="amount" type="number" value={values.amount} onChange={handleChange} placeholder="Amount" className="border rounded px-2 py-1" />
      <input name="closingDate" type="date" value={values.closingDate} onChange={handleChange} className="border rounded px-2 py-1" />
      <select name="stage" value={values.stage} onChange={handleChange} className="border rounded px-2 py-1">
        {dealStages.map((stage) => (
          <option key={stage} value={stage}>{stage}</option>
        ))}
      </select>
      <input name="probability" type="number" value={values.probability} onChange={handleChange} placeholder="Probability" className="border rounded px-2 py-1" />
      <input name="expectedRevenue" type="number" value={values.expectedRevenue} onChange={handleChange} placeholder="Expected Revenue" className="border rounded px-2 py-1" />
      <input name="nextStep" value={values.nextStep} onChange={handleChange} placeholder="Next Step" className="border rounded px-2 py-1" />
      <textarea name="description" value={values.description} onChange={handleChange} placeholder="Description" className="border rounded px-2 py-1" />
      <div className="flex gap-2">
        <button type="button" className="border px-4 py-2 rounded" onClick={() => setValues(initialValues)}>Cancel</button>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Save</button>
        <button type="button" className="bg-green-600 text-white px-4 py-2 rounded" onClick={() => { onSubmit(values); setValues({}); }}>Save and New</button>
      </div>
    </form>
  );
};

export default DealForm;
