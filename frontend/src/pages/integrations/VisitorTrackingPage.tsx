import { useEffect, useMemo, useState } from "react";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { integrationsApi } from "../../integrations/api";
import IntegrationHeader from "../../integrations/components/IntegrationHeader";
import IntegrationSetupChecklist from "../../integrations/components/IntegrationSetupChecklist";
import VisitorLeadGenerationModal from "../../integrations/components/VisitorLeadGenerationModal";
import VisitorPortalForm from "../../integrations/components/VisitorPortalForm";
import VisitorTrackingCodeModal from "../../integrations/components/VisitorTrackingCodeModal";
import VisitorTrackingLanding from "../../integrations/components/VisitorTrackingLanding";
import VisitorTrackingTable from "../../integrations/components/VisitorTrackingTable";
import { integrationsNavTabs } from "../../integrations/config";
import type {
  VisitorLeadEvent,
  VisitorTrackingPortal,
  VisitorTrackingSetting,
} from "../../integrations/types";

type Notice = { tone: "success" | "error"; message: string } | null;

export default function VisitorTrackingPage() {
  const [portals, setPortals] = useState<VisitorTrackingPortal[]>([]);
  const [settings, setSettings] = useState<VisitorTrackingSetting[]>([]);
  const [events, setEvents] = useState<VisitorLeadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const [portalModalOpen, setPortalModalOpen] = useState(false);
  const [editingPortal, setEditingPortal] = useState<VisitorTrackingPortal | null>(null);

  const [leadSettingsOpen, setLeadSettingsOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<VisitorTrackingSetting | null>(null);
  const [selectedPortal, setSelectedPortal] = useState<VisitorTrackingPortal | null>(null);

  const [trackingCodeOpen, setTrackingCodeOpen] = useState(false);
  const [trackingCodePortalName, setTrackingCodePortalName] = useState("");
  const [trackingCode, setTrackingCode] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [nextPortals, nextSettings, nextEvents] = await Promise.all([
        integrationsApi.listVisitorPortals().catch(() => []),
        integrationsApi.listVisitorSettings().catch(() => []),
        integrationsApi.listVisitorEvents().catch(() => []),
      ]);
      setPortals(nextPortals);
      setSettings(nextSettings);
      setEvents(nextEvents);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const settingsByPortal = useMemo(
    () =>
      settings.reduce<Record<number, VisitorTrackingSetting>>((result, setting) => {
        result[setting.portal] = setting;
        return result;
      }, {}),
    [settings]
  );
  const portalsWithTracking = useMemo(
    () => portals.filter((portal) => Boolean(settingsByPortal[portal.id]?.tracking_code)),
    [portals, settingsByPortal]
  );
  const setupItems = useMemo(
    () => [
      {
        label: "Create Portal",
        description: "Add the website or portal you want to track from the CRM.",
        done: portals.length > 0,
      },
      {
        label: "Generate Tracking Code",
        description: "Open a portal and copy the tracking code snippet for the website team.",
        done: portalsWithTracking.length > 0,
      },
      {
        label: "Receive Visitor Events",
        description: "Confirm visitor activity is arriving and can be converted into leads.",
        done: events.length > 0,
      },
    ],
    [portals.length, portalsWithTracking.length, events.length]
  );

  const setSuccess = (message: string) => setNotice({ tone: "success", message });
  const setError = (error: unknown) =>
    setNotice({
      tone: "error",
      message: error instanceof Error ? error.message : "Action failed.",
    });

  const runAction = async (
    action: () => Promise<unknown>,
    message: string,
    after?: () => void
  ) => {
    try {
      await action();
      setSuccess(message);
      after?.();
      await load();
    } catch (error) {
      setError(error);
    }
  };

  const openCreatePortal = () => {
    setEditingPortal(null);
    setPortalModalOpen(true);
  };

  const handleManagePortal = (portal: VisitorTrackingPortal) => {
    setSelectedPortal(portal);
    setEditingSetting(settingsByPortal[portal.id] || null);
    setLeadSettingsOpen(true);
  };

  const handleViewCode = async (portal: VisitorTrackingPortal) => {
    const setting = settingsByPortal[portal.id];
    setTrackingCodePortalName(portal.portal_name);
    setTrackingCode(setting?.tracking_code || null);
    setTrackingCodeOpen(true);

    if (!setting) {
      return;
    }

    try {
      const response = await integrationsApi.getVisitorTrackingCode(setting.id);
      setTrackingCode(response.tracking_code || setting.tracking_code || null);
    } catch {
      setTrackingCode(setting.tracking_code || null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <IntegrationHeader
          title="Visitor Tracking"
          subtitle="Set up visitor portals, control website lead capture, and surface source events for your CRM team."
          tabs={integrationsNavTabs}
          activePath="/integrations/visitors"
          action={
            <button
              type="button"
              onClick={openCreatePortal}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
            >
              Create Portal
            </button>
          }
        />

        {notice ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-500">Loading visitor tracking...</div>
        ) : null}

        <IntegrationSetupChecklist
          title="Setup Progress"
          subtitle="Use this order for visitor tracking: create a portal, copy the tracking code, then confirm visitor events are coming in."
          items={setupItems}
        />

        <VisitorTrackingLanding
          hasPortals={portals.length > 0}
          onGetStarted={openCreatePortal}
        />

        <CRMSectionCard title="Step 1: Portal Setup">
          <p className="mb-4 text-sm text-slate-600">
            Create the portal or website entry first. Each portal gets its own lead capture settings and tracking snippet.
          </p>
          <VisitorTrackingTable
            portals={portals}
            events={[]}
            onCreatePortal={openCreatePortal}
            onManagePortal={handleManagePortal}
            onDeactivatePortal={(portal) => {
              if (!window.confirm(`Deactivate visitor portal "${portal.portal_name}"?`)) {
                return;
              }
              void runAction(
                () => integrationsApi.deactivateVisitorPortal(portal.id),
                "Visitor portal deactivated successfully."
              );
            }}
            onViewCode={(portal) => void handleViewCode(portal)}
            onConvertEvent={() => undefined}
            showEvents={false}
          />
        </CRMSectionCard>

        <CRMSectionCard title="Step 2: Install Tracking And Lead Rules">
          <div className="grid gap-4 lg:grid-cols-[1fr,0.95fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">What To Do Next</div>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>Open a portal and click <span className="font-medium text-slate-900">View Code</span>.</li>
                <li>Share the tracking script with the website team.</li>
                <li>Use <span className="font-medium text-slate-900">Manage</span> to define how visitors become leads or contacts.</li>
              </ol>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Tracking Coverage</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Portals With Code</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{portalsWithTracking.length}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Lead Rules Enabled</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{settings.filter((setting) => setting.status_enabled).length}</div>
                </div>
              </div>
            </div>
          </div>
        </CRMSectionCard>

        <CRMSectionCard title="Step 3: Review Visitor Events">
          <p className="mb-4 text-sm text-slate-600">
            Once tracking is live, visitor events appear here. Convert important visitors into leads when they are ready for follow-up.
          </p>
          <VisitorTrackingTable
            portals={[]}
            events={events}
            onCreatePortal={openCreatePortal}
            onManagePortal={handleManagePortal}
            onDeactivatePortal={() => undefined}
            onViewCode={() => undefined}
            onConvertEvent={(event) =>
              void runAction(
                () => integrationsApi.convertVisitorEventToLead(event.id),
                "Visitor event converted to lead successfully."
              )
            }
            showPortals={false}
          />
        </CRMSectionCard>

        <CRMSectionCard title="Visitor Tracking Overview">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Portals</div>
              <div className="mt-2 text-2xl font-semibold">{portals.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Active Lead Rules</div>
              <div className="mt-2 text-2xl font-semibold">
                {settings.filter((setting) => setting.status_enabled).length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Open Visitor Events</div>
              <div className="mt-2 text-2xl font-semibold">
                {events.filter((event) => !event.converted_to_lead).length}
              </div>
            </div>
          </div>
        </CRMSectionCard>

        <VisitorPortalForm
          open={portalModalOpen}
          initialValue={editingPortal}
          onClose={() => setPortalModalOpen(false)}
          onSubmit={(values) =>
            void runAction(
              () =>
                editingPortal
                  ? integrationsApi.updateVisitorPortal(editingPortal.id, values)
                  : integrationsApi.createVisitorPortal(values),
              editingPortal
                ? "Visitor portal updated successfully."
                : "Visitor portal created successfully.",
              () => setPortalModalOpen(false)
            )
          }
        />

        <VisitorLeadGenerationModal
          open={leadSettingsOpen}
          initialValue={editingSetting}
          onClose={() => setLeadSettingsOpen(false)}
          onSubmit={(payload) => {
            if (!selectedPortal) {
              return;
            }

            void runAction(
              () =>
                editingSetting
                  ? integrationsApi.updateVisitorSetting(editingSetting.id, payload)
                  : integrationsApi.createVisitorSetting({
                      ...payload,
                      portal: selectedPortal.id,
                    }),
              editingSetting
                ? "Visitor lead generation updated successfully."
                : "Visitor lead generation created successfully.",
              () => setLeadSettingsOpen(false)
            );
          }}
        />

        <VisitorTrackingCodeModal
          open={trackingCodeOpen}
          portalName={trackingCodePortalName}
          trackingCode={trackingCode}
          onClose={() => setTrackingCodeOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}
