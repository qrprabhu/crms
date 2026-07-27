import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import { apiRequest } from "../../../api/client";
import { getAccounts } from "../../../lib/api/accountsApi";
import { getContacts } from "../../../lib/api/contactsApi";
import type { AccountRecord, ContactRecord } from "../../../lib/shared/crmTypes";

type TaskFormState = {
  subject: string;
  description: string;
  dueDate: string;
  status: string;
  priority: string;
  reminder: boolean;
  repeat: boolean;
  contactId: string;
  accountId: string;
};

type TaskFormField = keyof TaskFormState;

const TASK_STATUS_OPTIONS = [
  "Not Started",
  "In Progress",
  "Completed",
  "Waiting for input",
];

const TASK_PRIORITY_OPTIONS = [
  "Highest",
  "High",
  "Normal",
  "Low",
  "Lowest",
];

const DEFAULT_FORM_VALUES: TaskFormState = {
  subject: "",
  description: "",
  dueDate: "",
  status: TASK_STATUS_OPTIONS[0],
  priority: "Normal",
  reminder: false,
  repeat: false,
  contactId: "",
  accountId: "",
};

function buildRecordLabel(recordName: string, fallback: string) {
  return recordName?.trim() ? recordName : fallback;
}

export default function CreateTaskPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [formData, setFormData] = useState<TaskFormState>(DEFAULT_FORM_VALUES);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [contactLoadError, setContactLoadError] = useState("");
  const [accountLoadError, setAccountLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const loadContacts = async () => {
      try {
        setLoadingContacts(true);
        const result = await getContacts();
        if (!active) return;
        setContacts(result);
      } catch (err) {
        if (!active) return;
        setContactLoadError(err instanceof Error ? err.message : "Unable to load contacts.");
      } finally {
        if (active) setLoadingContacts(false);
      }
    };

    const loadAccounts = async () => {
      try {
        setLoadingAccounts(true);
        const result = await getAccounts();
        if (!active) return;
        setAccounts(result);
      } catch (err) {
        if (!active) return;
        setAccountLoadError(err instanceof Error ? err.message : "Unable to load accounts.");
      } finally {
        if (active) setLoadingAccounts(false);
      }
    };

    void loadContacts();
    void loadAccounts();

    return () => { active = false; };
  }, []);

  // Load existing task data in edit mode
  useEffect(() => {
    if (!isEdit || !id) return;
    let active = true;

    const loadTask = async () => {
      try {
        const data = await apiRequest<{
          subject?: string;
          description?: string | null;
          due_date?: string | null;
          status?: string | null;
          priority?: string | null;
          reminder?: boolean;
          repeat?: boolean;
          contact?: number | null;
          account?: number | null;
        }>(`/tasks/${id}/`);
        if (!active) return;
        setFormData({
          subject: data.subject ?? "",
          description: data.description ?? "",
          dueDate: data.due_date ?? "",
          status: data.status ?? TASK_STATUS_OPTIONS[0],
          priority: data.priority ?? "Normal",
          reminder: data.reminder ?? false,
          repeat: data.repeat ?? false,
          contactId: data.contact ? String(data.contact) : "",
          accountId: data.account ? String(data.account) : "",
        });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load task.");
      }
    };

    void loadTask();
    return () => { active = false; };
  }, [id, isEdit]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = event.target as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement;
    const fieldName = target.name as TaskFormField;
    const isCheckbox = target instanceof HTMLInputElement && target.type === "checkbox";

    setError(null);
    setInfo(null);

    setFormData((prev) => ({
      ...prev,
      [fieldName]: isCheckbox ? target.checked : target.value,
    }));
  };

  const resetForm = () => {
    setFormData({ ...DEFAULT_FORM_VALUES });
  };

  const handleSave = async (stayOnPage: boolean) => {
    if (!formData.subject.trim()) {
      setError("Subject is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setInfo(null);

    const payload: Record<string, unknown> = {
      subject: formData.subject.trim(),
      description: formData.description.trim(),
      status: formData.status,
      priority: formData.priority,
      reminder: formData.reminder,
      repeat: formData.repeat,
    };

    if (formData.dueDate) {
      payload.due_date = formData.dueDate;
    }

    if (formData.contactId) {
      const parsed = Number(formData.contactId);
      if (!Number.isNaN(parsed)) {
        payload.contact = parsed;
      }
    }

    if (formData.accountId) {
      const parsed = Number(formData.accountId);
      if (!Number.isNaN(parsed)) {
        payload.account = parsed;
      }
    }

    try {
      if (isEdit) {
        await apiRequest(`/tasks/${id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        navigate(`/tasks/${id}`);
      } else {
        await apiRequest("/tasks/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (stayOnPage) {
          resetForm();
          setInfo("Task saved. You can create another one.");
          return;
        }
        navigate("/tasks");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="px-6 py-6">
        <div className="sticky top-0 z-40 mb-6 flex flex-col gap-4 bg-slate-50 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => isEdit ? navigate(`/tasks/${id}`) : navigate("/tasks")}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {isEdit ? "Back to task" : "Back to tasks"}
            </button>
            <h1 className="text-3xl font-semibold text-slate-900">
              {isEdit ? "Edit Task" : "Create Task"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isEdit && (
              <button
                type="button"
                onClick={() => void handleSave(true)}
                disabled={saving}
                className="rounded-md border border-[#cfd7e6] bg-white px-4 py-2 text-sm font-medium text-[#334155] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save and new"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSave(false)}
              disabled={saving}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {info && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {info}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              <div>
                <label htmlFor="subject" className="mb-2 block text-sm font-semibold text-slate-600">
                  Subject
                </label>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-green-500"
                  placeholder="Enter a short description"
                />
              </div>

              <div>
                <label htmlFor="description" className="mb-2 block text-sm font-semibold text-slate-600">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-green-500"
                  placeholder="Add more context (optional)"
                />
              </div>

              <div>
                <label htmlFor="dueDate" className="mb-2 block text-sm font-semibold text-slate-600">
                  Due date
                </label>
                <input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label htmlFor="status" className="mb-2 block text-sm font-semibold text-slate-600">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-green-500"
                >
                  {TASK_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="priority" className="mb-2 block text-sm font-semibold text-slate-600">
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-green-500"
                >
                  {TASK_PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="contactId" className="mb-2 block text-sm font-semibold text-slate-600">
                  Contact
                </label>
                <select
                  id="contactId"
                  name="contactId"
                  value={formData.contactId}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-green-500"
                >
                  <option value="">None</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {buildRecordLabel(contact.contactName, `Contact #${contact.id}`)}
                    </option>
                  ))}
                </select>
                {loadingContacts && (
                  <p className="mt-1 text-xs text-slate-500">Loading contacts...</p>
                )}
                {contactLoadError && (
                  <p className="mt-1 text-xs text-red-500">{contactLoadError}</p>
                )}
              </div>

              <div>
                <label htmlFor="accountId" className="mb-2 block text-sm font-semibold text-slate-600">
                  Account
                </label>
                <select
                  id="accountId"
                  name="accountId"
                  value={formData.accountId}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-green-500"
                >
                  <option value="">None</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {buildRecordLabel(account.accountName, `Account #${account.id}`)}
                    </option>
                  ))}
                </select>
                {loadingAccounts && (
                  <p className="mt-1 text-xs text-slate-500">Loading accounts...</p>
                )}
                {accountLoadError && (
                  <p className="mt-1 text-xs text-red-500">{accountLoadError}</p>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
