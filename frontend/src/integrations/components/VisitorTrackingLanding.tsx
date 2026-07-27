import CRMSectionCard from "../../components/crm/CRMSectionCard";
import IntegrationEmptyState from "./IntegrationEmptyState";

type Props = {
  hasPortals: boolean;
  onGetStarted: () => void;
};

export default function VisitorTrackingLanding({ hasPortals, onGetStarted }: Props) {
  return (
    <CRMSectionCard
      title="Visitor Tracking"
      subtitle="Track website activity, surface visitor events, and convert meaningful visits into CRM records."
    >
      {hasPortals ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Track Website Visitors", "Collect page visits, source URLs, and time-on-site signals."],
            ["Push Leads Automatically", "Convert visitors into leads or contacts with assignment rules."],
            ["Share Tracking Code", "Generate and copy embed snippets for your webmaster or site team."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-medium text-slate-900">{title}</div>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      ) : (
        <IntegrationEmptyState
          title="Set up website visitor tracking"
          description="Create portals, configure lead conversion rules, and embed tracking code to turn website activity into CRM records."
          action={<button type="button" onClick={onGetStarted} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">Get Started</button>}
        />
      )}
    </CRMSectionCard>
  );
}
