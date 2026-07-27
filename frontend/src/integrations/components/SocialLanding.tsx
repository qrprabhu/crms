import CRMSectionCard from "../../components/crm/CRMSectionCard";
import IntegrationEmptyState from "./IntegrationEmptyState";

type Props = {
  hasBrands: boolean;
  onGetStarted: () => void;
};

export default function SocialLanding({ hasBrands, onGetStarted }: Props) {
  return (
    <CRMSectionCard
      title="Social Integration"
      subtitle="Connect brand-owned social channels so engagement can be assigned and tracked inside the CRM."
    >
      {hasBrands ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Engage Customers", "Track mentions, comments, and inbox activity from connected social accounts."],
            ["Generate Leads", "Convert social interactions into leads and assign them automatically."],
            ["Manage Permissions", "Control brand-level visibility, admins, and response ownership."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-medium text-slate-900">{title}</div>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      ) : (
        <IntegrationEmptyState
          title="Start engaging customers through social channels"
          description="Connect brand accounts for Facebook and X, configure admins, and automate lead capture from mentions, messages, and comments."
          action={<button type="button" onClick={onGetStarted} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">Get Started</button>}
        />
      )}
    </CRMSectionCard>
  );
}
