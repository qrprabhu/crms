import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import { apiRequest } from "../../../api/client";
import {
  ChevronDown,
  Pencil,
  Search,
  X,
} from "lucide-react";

type VenueType = "In-office" | "Client location" | "Online";
type RelatedToType = "None" | "Lead" | "Contact" | "Others";
type ReminderType =
  | "None"
  | "At time of meeting"
  | "5 minutes before"
  | "10 minutes before"
  | "15 minutes before"
  | "30 minutes before"
  | "1 hour before"
  | "2 hours before";

type RepeatType = "None" | "Daily" | "Weekly" | "Monthly";

type Participant = {
  id: number;
  name: string;
  email: string;
};

type BackendContact = {
  id: number;
  first_name: string;
  last_name: string;
  email?: string | null;
};

type BackendLead = {
  id: number;
  first_name: string;
  last_name: string;
  company?: string;
  email?: string | null;
  lead_name?: string | null;
};

type BackendUser = {
  id: number;
  email: string;
};

type MeetingResponse = {
  id: number;
  title: string;
  description?: string;
  meeting_venue: VenueType;
  location?: string;
  all_day: boolean;
  start_date: string;
  end_date?: string | null;
  host?: string;
  participants?: Participant[];
  related_to?: RelatedToType;
  repeat?: RepeatType;
  participants_reminder?: ReminderType;
  status?: string;
  lead?: number | null;
  lead_name?: string | null;
  contact?: number | null;
  contact_name?: string | null;
};

type Paginated<T> = { results: T[] };

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeForInput(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.results;
}

export default function CreateMeetingPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const start = useMemo(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now;
  }, []);

  const end = useMemo(() => {
    const next = new Date(start);
    next.setHours(next.getHours() + 1);
    return next;
  }, [start]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showMore, setShowMore] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");

  // Real data from backend
  const [contactOptions, setContactOptions] = useState<Participant[]>([]);
  const [leadOptions, setLeadOptions] = useState<{ id: number; name: string; searchText: string }[]>([]);
  const [userOptions, setUserOptions] = useState<BackendUser[]>([]);

  // Related-to selection
  const [relatedSearch, setRelatedSearch] = useState("");
  const [selectedRelatedId, setSelectedRelatedId] = useState<number | null>(null);
  const [selectedRelatedName, setSelectedRelatedName] = useState("");
  const [showRelatedDropdown, setShowRelatedDropdown] = useState(false);

  useEffect(() => {
    apiRequest<BackendContact[] | Paginated<BackendContact>>("/contacts/")
      .then((data) => {
        const contacts = toList(data).map((c) => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`.trim(),
          email: c.email ?? "",
        }));
        setContactOptions(contacts);
      })
      .catch(() => {});

    apiRequest<BackendLead[] | Paginated<BackendLead>>("/leads/")
      .then((data) => {
        const leads = toList(data).map((l) => ({
          id: l.id,
          name:
            l.lead_name?.trim() ||
            `${l.first_name} ${l.last_name}`.trim() ||
            l.company?.trim() ||
            l.email?.trim() ||
            `Lead #${l.id}`,
          searchText: [
            l.lead_name,
            l.first_name,
            l.last_name,
            l.company,
            l.email,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        }));
        setLeadOptions(leads);
      })
      .catch(() => {});

    apiRequest<BackendUser[]>("/auth/users")
      .then((data) => {
        setUserOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    meeting_venue: "In-office" as VenueType,
    location: "",
    meeting_link: "",
    all_day: false,
    from_date: formatDateForInput(start),
    from_time: formatTimeForInput(start),
    to_date: formatDateForInput(end),
    to_time: formatTimeForInput(end),
    host: "",
    related_to: "None" as RelatedToType,
    repeat: "None" as RepeatType,
    participants_reminder: "None" as ReminderType,
    status: "Scheduled",
  });

  // Set default host once users load
  useEffect(() => {
    if (userOptions.length > 0 && !formData.host) {
      setFormData((prev) => ({ ...prev, host: userOptions[0].email }));
    }
  }, [userOptions]);

  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!id) {
      return;
    }

    let isMounted = true;

    apiRequest<MeetingResponse>(`/meetings/${id}/`)
      .then((meeting) => {
        if (!isMounted) {
          return;
        }

        const startDate = new Date(meeting.start_date);
        const endDate = meeting.end_date ? new Date(meeting.end_date) : new Date(meeting.start_date);
        const relatedType = (meeting.related_to as RelatedToType) || (meeting.contact ? "Contact" : meeting.lead ? "Lead" : "None");
        const relatedId = relatedType === "Contact" ? meeting.contact ?? null : relatedType === "Lead" ? meeting.lead ?? null : null;
        const relatedName = relatedType === "Contact" ? meeting.contact_name ?? "" : relatedType === "Lead" ? meeting.lead_name ?? "" : "";

        setFormData({
          title: meeting.title ?? "",
          description: meeting.description ?? "",
          meeting_venue: meeting.meeting_venue ?? "In-office",
          location: meeting.location ?? "",
          meeting_link: (meeting as any).meeting_link ?? "",
          all_day: Boolean(meeting.all_day),
          from_date: formatDateForInput(startDate),
          from_time: formatTimeForInput(startDate),
          to_date: formatDateForInput(endDate),
          to_time: formatTimeForInput(endDate),
          host: meeting.host ?? "",
          related_to: relatedType,
          repeat: meeting.repeat ?? "None",
          participants_reminder: meeting.participants_reminder ?? "None",
          status: meeting.status ?? "Scheduled",
        });
        setParticipants(Array.isArray(meeting.participants) ? meeting.participants : []);
        setSelectedRelatedId(relatedId);
        setSelectedRelatedName(relatedName);
        setRelatedSearch("");
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load meeting");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const filteredContacts = contactOptions.filter(
    (c) =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const filteredRelatedOptions =
    formData.related_to === "Lead"
      ? leadOptions.filter((lead) =>
          relatedSearch.trim()
            ? lead.searchText.includes(relatedSearch.trim().toLowerCase())
            : true
        )
      : contactOptions.filter((contact) =>
          relatedSearch.trim()
            ? contact.name.toLowerCase().includes(relatedSearch.trim().toLowerCase()) ||
              contact.email.toLowerCase().includes(relatedSearch.trim().toLowerCase())
            : true
        );

  const selectedIds = new Set(participants.map((item) => item.id));

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : false;

    if (name === "related_to") {
      setSelectedRelatedId(null);
      setSelectedRelatedName("");
      setRelatedSearch("");
      setShowRelatedDropdown(false);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const toggleParticipant = (participant: Participant) => {
    setParticipants((prev) => {
      const exists = prev.some((item) => item.id === participant.id);
      if (exists) return prev.filter((item) => item.id !== participant.id);
      return [...prev, participant];
    });
  };

  const handleSaveParticipants = () => {
    const manualEmails = inviteEmails
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email, index) => ({ id: 1000 + index, name: email, email }));

    setParticipants((prev) => {
      const existingEmails = new Set(prev.map((item) => item.email));
      const extra = manualEmails.filter((item) => !existingEmails.has(item.email));
      return [...prev, ...extra];
    });

    setInviteEmails("");
    setShowParticipantsModal(false);
  };

  const buildPayload = () => {
    const startDateTime = formData.all_day
      ? `${formData.from_date}T00:00:00`
      : `${formData.from_date}T${formData.from_time}:00`;

    const endDateTime = formData.all_day
      ? `${formData.to_date}T23:59:59`
      : `${formData.to_date}T${formData.to_time}:00`;

    return {
      title: formData.title,
      description: formData.description,
      start_date: startDateTime,
      end_date: endDateTime,
      location: formData.location,
      meeting_link: formData.meeting_venue === "Online" ? formData.meeting_link : "",
      status: formData.status,
      meeting_venue: formData.meeting_venue,
      all_day: formData.all_day,
      host: formData.host,
      participants: participants.map((item) => ({ name: item.name, email: item.email })),
      related_to: formData.related_to,
      repeat: formData.repeat,
      participants_reminder: formData.participants_reminder,
      ...(formData.related_to === "Lead" && selectedRelatedId ? { lead: selectedRelatedId } : {}),
      ...(formData.related_to === "Contact" && selectedRelatedId ? { contact: selectedRelatedId } : {}),
    };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!formData.from_date) {
      setError("From date is required");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await apiRequest(isEditing ? `/meetings/${id}/` : "/meetings/", {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(buildPayload()),
      });
      navigate("/meetings");
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? "update" : "create"} meeting`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="relative min-h-[calc(100vh-64px)] bg-slate-50">
        <div className="absolute inset-0 bg-black/20" />

        <div className="relative z-10 flex min-h-[calc(100vh-64px)] items-start justify-center px-4 py-8">
          <div className="w-full max-w-[450px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <form onSubmit={handleSubmit}>
              <div className="px-7 py-6">
                <h1 className="mb-6 text-[18px] font-semibold text-slate-900">
                  {isEditing ? "Edit Meeting" : "Meeting Information"}
                </h1>

                {error && (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Field label="Title">
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleFieldChange}
                    className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-1 text-[15px] text-slate-900 outline-none focus:border-blue-600 focus:ring-0"
                  />
                </Field>

                <Field label="Meeting Venue">
                  <div className="relative">
                    <select
                      name="meeting_venue"
                      value={formData.meeting_venue}
                      onChange={handleFieldChange}
                      className="w-full appearance-none border-0 border-b border-slate-300 bg-transparent px-0 py-1 pr-6 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                    >
                      <option value="In-office">In-office</option>
                      <option value="Client location">Client location</option>
                      <option value="Online">Online</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0 top-2 h-4 w-4 text-slate-500" />
                  </div>
                </Field>

                <Field label="Location">
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleFieldChange}
                    className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-1 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                  />
                </Field>

                {formData.meeting_venue === "Online" && (
                  <Field label="Meeting Link">
                    <input
                      type="url"
                      name="meeting_link"
                      value={formData.meeting_link}
                      onChange={handleFieldChange}
                      placeholder="Enter Meeting link"
                      className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-1 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                    />
                    <p className="mt-1 text-[12px] text-slate-400">
                      This link will be emailed to all participants.
                    </p>
                  </Field>
                )}

                <Field label="All day">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="all_day"
                      checked={formData.all_day}
                      onChange={handleFieldChange}
                      className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-blue-500"
                    />
                  </label>
                </Field>

                <Field label="From">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      name="from_date"
                      value={formData.from_date}
                      onChange={handleFieldChange}
                      className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-1 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                    />
                    {!formData.all_day && (
                      <input
                        type="time"
                        name="from_time"
                        value={formData.from_time}
                        onChange={handleFieldChange}
                        className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-1 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                      />
                    )}
                  </div>
                </Field>

                <Field label="To">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      name="to_date"
                      value={formData.to_date}
                      onChange={handleFieldChange}
                      className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-1 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                    />
                    {!formData.all_day && (
                      <input
                        type="time"
                        name="to_time"
                        value={formData.to_time}
                        onChange={handleFieldChange}
                        className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-1 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                      />
                    )}
                  </div>
                </Field>

                <Field label="Host">
                  <div className="relative">
                    <select
                      name="host"
                      value={formData.host}
                      onChange={handleFieldChange}
                      className="w-full appearance-none border-0 border-b border-slate-300 bg-transparent px-0 py-1 pr-6 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                    >
                      {userOptions.length === 0 ? (
                        <option value="">Loading...</option>
                      ) : (
                        userOptions.map((user) => (
                          <option key={user.id} value={user.email}>
                            {user.email}
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0 top-2 h-4 w-4 text-slate-500" />
                  </div>
                </Field>

                <Field label="Participants">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] text-slate-700">
                        {participants.length === 0 ? "None" : `${participants.length} selected`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowParticipantsModal(true)}
                        className="text-sm font-medium text-green-600 hover:text-green-700"
                      >
                        + Add
                      </button>
                    </div>

                    {participants.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {participants.map((participant) => (
                          <span
                            key={`${participant.id}-${participant.email}`}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                          >
                            {participant.name}
                            <button
                              type="button"
                              onClick={() =>
                                setParticipants((prev) =>
                                  prev.filter((item) => item.email !== participant.email)
                                )
                              }
                              className="text-slate-500 hover:text-slate-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Related To">
                  <div className="relative">
                    <select
                      name="related_to"
                      value={formData.related_to}
                      onChange={handleFieldChange}
                      className="w-full appearance-none border-0 border-b border-slate-300 bg-transparent px-0 py-1 pr-6 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                    >
                      <option value="None">None</option>
                      <option value="Lead">Lead</option>
                      <option value="Contact">Contact</option>
                      <option value="Others">Others</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0 top-2 h-4 w-4 text-slate-500" />
                  </div>
                </Field>

                {(formData.related_to === "Lead" || formData.related_to === "Contact") && (
                  <Field label={formData.related_to}>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={`Search ${formData.related_to}...`}
                        value={selectedRelatedName || relatedSearch}
                        onChange={(e) => {
                          setSelectedRelatedId(null);
                          setSelectedRelatedName("");
                          setRelatedSearch(e.target.value);
                          setShowRelatedDropdown(true);
                        }}
                        onFocus={() => setShowRelatedDropdown(true)}
                        onClick={() => setShowRelatedDropdown(true)}
                        className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-1 pr-6 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                      />
                      <Search className="pointer-events-none absolute right-0 top-2 h-4 w-4 text-slate-400" />
                      {showRelatedDropdown && !selectedRelatedId && (
                        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                          {filteredRelatedOptions.slice(0, 12).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="w-full px-3 py-2 text-left text-[14px] text-slate-800 hover:bg-slate-100"
                              onClick={() => {
                                setSelectedRelatedId(item.id);
                                setSelectedRelatedName(item.name);
                                setRelatedSearch("");
                                setShowRelatedDropdown(false);
                              }}
                            >
                              {item.name}
                            </button>
                          ))}
                          {filteredRelatedOptions.length === 0 && (
                            <p className="px-3 py-2 text-sm text-slate-500">No results found.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </Field>
                )}

                <Field label="Repeat">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-300 py-1">
                    <select
                      name="repeat"
                      value={formData.repeat}
                      onChange={handleFieldChange}
                      className="w-full appearance-none bg-transparent text-[15px] text-slate-900 outline-none"
                    >
                      <option value="None">None</option>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                    <Pencil className="h-4 w-4 text-green-600" />
                  </div>
                </Field>

                <Field label="Participants Reminder">
                  <div className="relative">
                    <select
                      name="participants_reminder"
                      value={formData.participants_reminder}
                      onChange={handleFieldChange}
                      className="w-full appearance-none border-0 border-b border-slate-300 bg-transparent px-0 py-1 pr-6 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                    >
                      <option value="None">None</option>
                      <option value="At time of meeting">At time of meeting</option>
                      <option value="5 minutes before">5 minutes before</option>
                      <option value="10 minutes before">10 minutes before</option>
                      <option value="15 minutes before">15 minutes before</option>
                      <option value="30 minutes before">30 minutes before</option>
                      <option value="1 hour before">1 hour before</option>
                      <option value="2 hours before">2 hours before</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0 top-2 h-4 w-4 text-slate-500" />
                  </div>
                </Field>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => setShowMore((prev) => !prev)}
                    className="text-sm font-medium text-green-600 hover:text-green-700"
                  >
                    {showMore ? "Hide more details" : "Add more details"}
                  </button>
                </div>

                {showMore && (
                  <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <Field label="Description">
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleFieldChange}
                        rows={4}
                        className="w-full resize-none border-0 border-b border-slate-300 bg-transparent px-0 py-1 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                      />
                    </Field>

                    <Field label="Status">
                      <div className="relative">
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleFieldChange}
                          className="w-full appearance-none border-0 border-b border-slate-300 bg-transparent px-0 py-1 pr-6 text-[15px] text-slate-900 outline-none focus:border-blue-600"
                        >
                          <option value="Scheduled">Scheduled</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="Rescheduled">Rescheduled</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-0 top-2 h-4 w-4 text-slate-500" />
                      </div>
                    </Field>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={() => navigate("/meetings")}
                  className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Saving..." : isEditing ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {showParticipantsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <div className="w-full max-w-[450px] rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="px-6 py-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Add Participants</h2>

                <div className="relative mb-4">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600"
                  />
                </div>

                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-slate-500">No contacts found.</p>
                  ) : (
                    filteredContacts.map((contact) => {
                      const checked = selectedIds.has(contact.id);
                      return (
                        <label
                          key={contact.id}
                          className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-3 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleParticipant(contact)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-green-600"
                          />
                          <div>
                            <p className="text-[15px] font-medium text-green-700">{contact.name}</p>
                            <p className="text-sm text-green-600">{contact.email}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Invite by Email Address:
                    <span className="ml-1 font-normal text-slate-500">
                      Use commas to separate email addresses.
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                    placeholder="Add Emails"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowParticipantsModal(false)}
                  className="mr-2 rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveParticipants}
                  className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-3 py-3">
      <label className="text-[15px] text-slate-600">{label}</label>
      <div>{children}</div>
    </div>
  );
}
