import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { ChevronDown, UserPlus } from "lucide-react";
import { createCampaign, getCampaignById, updateCampaign, type CampaignFormData } from "../../lib/api/campaignsApi";

type CampaignFormState = {
  campaignOwner: string;
  campaignName: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  expectedRevenue: string;
  budgetedCost: string;
  actualCost: string;
  expectedResponse: string;
  numbersSent: string;
  description: string;
};

const inputClass =
  "h-[34px] w-full rounded-[4px] border border-[#cfd7e6] bg-white px-3 text-[14px] text-slate-700 outline-none transition focus:border-[#6d8dff]";

const selectClass =
  "h-[34px] w-full appearance-none rounded-[4px] border border-[#cfd7e6] bg-white px-3 pr-8 text-[14px] text-slate-700 outline-none transition focus:border-[#6d8dff]";

const labelClass =
  "pr-4 text-right text-[14px] font-normal text-[#4e6485]";

function getLoggedInUserLabel() {
  const savedUser = localStorage.getItem("loggedInUser");
  if (!savedUser) return "Current User";
  try {
    const parsed = JSON.parse(savedUser) as {
      name?: string;
      full_name?: string;
      first_name?: string;
      firstName?: string;
      username?: string;
      email?: string;
      id?: string | number;
    };
    return (
      parsed.name ||
      parsed.full_name ||
      parsed.first_name ||
      parsed.firstName ||
      parsed.username ||
      parsed.email ||
      "Current User"
    );
  } catch {
    return "Current User";
  }
}

const initialFormData: CampaignFormState = {
  campaignOwner: "",
  campaignName: "",
  type: "",
  status: "",
  startDate: "",
  endDate: "",
  expectedRevenue: "",
  budgetedCost: "",
  actualCost: "",
  expectedResponse: "",
  numbersSent: "",
  description: "",
};

function SelectField({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select name={name} value={value} onChange={onChange} className={selectClass}>
        {options.map((option) => (
          <option key={option} value={option === "-None-" ? "" : option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
      />
    </div>
  );
}

function TextField({
  name,
  value,
  onChange,
  placeholder = "",
  type = "text",
}: {
  name: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={inputClass}
    />
  );
}

function CurrencyField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative">
      <input
        name={name}
        value={value}
        onChange={onChange}
        className={`${inputClass} pl-11`}
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-600">
        Rs.
      </span>
    </div>
  );
}

export default function CreateCampaignPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CampaignFormState>(initialFormData);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const ownerLabel = getLoggedInUserLabel();

  // Load existing campaign when editing
  useEffect(() => {
    if (!id) return;
    void (async () => {
      const campaign = await getCampaignById(id);
      if (!campaign) return;
      setFormData({
        campaignOwner: campaign.campaignOwnerId,
        campaignName: campaign.campaignName,
        type: campaign.type,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        expectedRevenue: campaign.expectedRevenue,
        budgetedCost: campaign.budgetedCost,
        actualCost: campaign.actualCost,
        expectedResponse: campaign.expectedResponse,
        numbersSent: campaign.numbersSent,
        description: campaign.description,
      });
    })();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setError(null);
    setSuccessMessage(null);
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSave = async (goToNew = false) => {
    if (!formData.campaignName.trim()) {
      setError("Campaign Name is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const payload: CampaignFormData = {
        campaignOwner: formData.campaignOwner,
        campaignName: formData.campaignName,
        type: formData.type,
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate,
        expectedRevenue: formData.expectedRevenue,
        budgetedCost: formData.budgetedCost,
        actualCost: formData.actualCost,
        expectedResponse: formData.expectedResponse,
        numbersSent: formData.numbersSent,
        description: formData.description,
      };

      if (isEdit && id) {
        await updateCampaign(id, payload);
      } else {
        await createCampaign(payload);
      }

      if (goToNew && !isEdit) {
        resetForm();
        setSuccessMessage("Campaign created successfully.");
        return;
      }

      navigate(isEdit ? `/campaigns/${id}` : "/campaigns");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create campaign.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="h-full overflow-hidden bg-[#f3f5f9]">
        <div className="border-b border-[#d9e1ef] bg-[#f0fdf4] px-7 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-[16px] font-semibold text-[#1f2d3d]">
                {isEdit ? "Edit Campaign" : "Create Campaign"}
              </h1>
              
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(isEdit ? `/campaigns/${id}` : "/campaigns")}
                disabled={saving}
                className="h-[32px] w-[140px] rounded-[6px] border border-[#cfd7e6] bg-white px-4 text-[14px] text-[#334155] hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave(true)}
                disabled={saving}
                className="h-[32px] w-[140px] rounded-[6px] border border-[#cfd7e6] bg-white px-4 text-[14px] text-[#334155] hover:bg-slate-50 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save and New"}
              </button>
              <button
                type="button"
                onClick={() => void handleSave(false)}
                disabled={saving}
                className="h-[32px] w-[140px] rounded-[6px] bg-gradient-to-b from-[#22c55e] to-[#16a34a] px-4 text-[14px] font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>

        <div className="h-[calc(100%-57px)] overflow-y-auto px-3 py-3">
          <div className="bg-white">
            <div className="px-3 pt-4">
              {error ? (
                <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              ) : null}
              {successMessage ? (
                <div className="mb-4 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMessage}
                </div>
              ) : null}
              <div className="mb-8">
                <div className="mb-5 text-[13px] font-semibold text-[#1f2d3d]">
                  Campaign Information
                </div>

                <div className="grid grid-cols-2 gap-x-16 gap-y-5">
                  <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-y-5">
                    <label className={labelClass}>Campaign Owner</label>
                    <div className="relative flex items-center gap-0">
                      <input
                        name="campaignOwner"
                        value={ownerLabel}
                        readOnly
                        className={`${inputClass} rounded-r-none bg-slate-50`}
                      />
                      <button
                        type="button"
                        disabled
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-r-[4px] border border-l-0 border-[#cfd7e6] bg-white text-slate-600"
                      >
                        <UserPlus size={16} />
                      </button>
                    </div>

                    <label className={labelClass}>Campaign Name</label>
                    <TextField
                      name="campaignName"
                      value={formData.campaignName}
                      onChange={handleChange}
                    />
                    {!formData.campaignName.trim() ? <p className="col-start-2 -mt-3 text-xs text-red-500">Campaign Name is required.</p> : null}

                    <label className={labelClass}>Start Date</label>
                    <TextField
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleChange}
                      type="date"
                    />

                    <label className={labelClass}>Expected Revenue</label>
                    <CurrencyField
                      name="expectedRevenue"
                      value={formData.expectedRevenue}
                      onChange={handleChange as React.ChangeEventHandler<HTMLInputElement>}
                    />

                    <label className={labelClass}>Actual Cost</label>
                    <CurrencyField
                      name="actualCost"
                      value={formData.actualCost}
                      onChange={handleChange as React.ChangeEventHandler<HTMLInputElement>}
                    />

                    <label className={labelClass}>Numbers sent</label>
                    <TextField
                      name="numbersSent"
                      value={formData.numbersSent}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-y-5">
                    <label className={labelClass}>Type</label>
                    <SelectField
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      options={[
                        "-None-",
                        "Advertisement",
                        "Direct Mail",
                        "Email",
                        "Trade Show",
                        "Seminar",
                        "Webinar",
                        "Referral Program",
                        "Partners",
                        "Public Relations",
                        "Banner Ads",
                        "Social Media",
                        "Internal",
                      ]}
                    />

                    <label className={labelClass}>Status</label>
                    <SelectField
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      options={[
                        "-None-",
                        "Planning",
                        "Active",
                        "Inactive",
                        "Complete",
                      ]}
                    />

                    <label className={labelClass}>End Date</label>
                    <TextField
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleChange}
                      type="date"
                    />

                    <label className={labelClass}>Budgeted Cost</label>
                    <CurrencyField
                      name="budgetedCost"
                      value={formData.budgetedCost}
                      onChange={handleChange as React.ChangeEventHandler<HTMLInputElement>}
                    />

                    <label className={labelClass}>Expected Response</label>
                    <TextField
                      name="expectedResponse"
                      value={formData.expectedResponse}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <div className="mb-5 text-[13px] font-semibold text-[#1f2d3d]">
                  Description Information
                </div>

                <div className="grid w-[75%] grid-cols-[180px_minmax(0,1fr)] items-start">
                  <label className={`${labelClass} pt-2`}>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="min-h-[34px] w-full rounded-[4px] border border-[#cfd7e6] bg-white px-3 py-2 text-[14px] text-slate-700 outline-none focus:border-[#6d8dff]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-5 border-t border-[#d9e1ef] px-8 py-3">
              <button
                type="button"
                className="text-[14px] text-[#1d4ed8] hover:underline"
              >
                Create Form Views
              </button>

            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
