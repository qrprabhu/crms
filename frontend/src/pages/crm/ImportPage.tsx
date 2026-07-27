import { useLocation } from "react-router-dom";
import CRMImportPage from "../../components/crm/CRMImportPage";

export default function ImportPage() {
  const location = useLocation();
  const path = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const initialTargetRecordId = searchParams.get("leadId") ?? undefined;

  let moduleLabel = "Leads";
  let backPath = "/leads";

  if (path.startsWith("/contacts")) {
    moduleLabel = "Contacts";
    backPath = "/contacts";
  }

  if (path.startsWith("/accounts")) {
    moduleLabel = "Accounts";
    backPath = "/accounts";
  }

  if (path.startsWith("/deals")) {
    moduleLabel = "Deals";
    backPath = "/deals";
  }

  if (path.startsWith("/campaigns")) {
    moduleLabel = "Campaigns";
    backPath = "/campaigns";
  }

  const isNotes = path.endsWith("/import-notes");

  return (
    <CRMImportPage
      pageTitle={isNotes ? "Import Notes" : `Import ${moduleLabel}`}
      moduleLabel={moduleLabel}
      mode={isNotes ? "notes" : "module"}
      backPath={backPath}
      initialTargetRecordId={initialTargetRecordId}
    />
  );
}
