import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { VisitorLeadEvent, VisitorTrackingPortal } from "../types";
import { formatDateTime, formatPortalUrl } from "../utils";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  portals: VisitorTrackingPortal[];
  events: VisitorLeadEvent[];
  onCreatePortal: () => void;
  onManagePortal: (portal: VisitorTrackingPortal) => void;
  onDeactivatePortal: (portal: VisitorTrackingPortal) => void;
  onViewCode: (portal: VisitorTrackingPortal) => void;
  onConvertEvent: (event: VisitorLeadEvent) => void;
  showPortals?: boolean;
  showEvents?: boolean;
};

export default function VisitorTrackingTable({
  portals,
  events,
  onCreatePortal,
  onManagePortal,
  onDeactivatePortal,
  onViewCode,
  onConvertEvent,
  showPortals = true,
  showEvents = true,
}: Props) {
  return (
    <div className="space-y-4">
      {showPortals ? (
        <CRMSectionCard title="Visitor Portals" action={<button type="button" onClick={onCreatePortal} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">Create Portal</button>}>
          {!portals.length ? (
            <p className="text-sm text-slate-500">No visitor portals created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {["Portal", "URL", "Availability", "Status", "Actions"].map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {portals.map((portal) => (
                    <tr key={portal.id} className="border-t border-slate-100">
                      <td className="px-3 py-3">{portal.portal_name}</td>
                      <td className="px-3 py-3">{formatPortalUrl(portal.portal_url)}</td>
                      <td className="px-3 py-3"><IntegrationStatusBadge label={portal.is_available ? "Available" : "Unavailable"} value={portal.is_available} /></td>
                      <td className="px-3 py-3"><IntegrationStatusBadge label={portal.is_active ? "Active" : "Inactive"} value={portal.is_active} /></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => onManagePortal(portal)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700">Manage</button>
                          <button type="button" onClick={() => onViewCode(portal)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700">View Code</button>
                          {portal.is_active ? <button type="button" onClick={() => onDeactivatePortal(portal)} className="rounded-md border border-rose-200 px-3 py-1.5 text-xs text-rose-700">Deactivate</button> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CRMSectionCard>
      ) : null}

      {showEvents ? (
        <CRMSectionCard title="Visitor Events">
          {!events.length ? (
            <p className="text-sm text-slate-500">No visitor events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {["Visitor", "Portal", "Source URL", "Event", "Converted", "Created", "Actions"].map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-t border-slate-100">
                      <td className="px-3 py-3">{event.visitor_name || event.visitor_email || "Anonymous Visitor"}</td>
                      <td className="px-3 py-3">{event.portal_name || event.portal}</td>
                      <td className="px-3 py-3">{event.source_url || "-"}</td>
                      <td className="px-3 py-3">{event.event_type}</td>
                      <td className="px-3 py-3"><IntegrationStatusBadge label={event.converted_to_lead ? "Converted" : "Open"} value={event.converted_to_lead} /></td>
                      <td className="px-3 py-3">{formatDateTime(event.created_at)}</td>
                      <td className="px-3 py-3">
                        {!event.converted_to_lead ? <button type="button" onClick={() => onConvertEvent(event)} className="rounded-md border border-blue-200 px-3 py-1.5 text-xs text-green-700">Convert to Lead</button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CRMSectionCard>
      ) : null}
    </div>
  );
}
