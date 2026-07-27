import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { DashboardLayoutRoute } from "./components/layout/DashboardLayout";
import { apiRequest } from "./api/client";
import { useAuth } from "./hooks/useAuth";
import HomePage from "./pages/HomePage";
import MyRequestsPage from "./pages/MyRequestsPage";
import ReportsPage from "./pages/ReportsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AccountsPage from "./pages/accounts/AccountsPage";
import CallsPage from "./pages/activities/calls";
import MeetingsPage from "./pages/activities/meetings";
import TasksPage from "./pages/activities/tasks";
import CampaignsPage from "./pages/campaigns/CampaignsPage";
import DocumentsPage from "./pages/documents/DocumentsPage";
import ContactsPage from "./pages/contacts/ContactsPage";
import DealsPage from "./pages/deals/DealsPage";
import LeadsPage from "./pages/leads/LeadsPage";
import ProjectsPage from "./pages/projects/ProjectsPage";
import InventoryListRoute from "./pages/inventory/InventoryListRoute";
import CasesPage from "./pages/support/CasesPage";
import SolutionsPage from "./pages/support/SolutionsPage";
import BusinessHoursRoute from "./pages/servicesModule/BusinessHoursRoute";
import ServicesCatalogPage from "./pages/servicesModule/ServicesCatalogPage";
import AppointmentsPage from "./pages/servicesModule/AppointmentsPage";
import CompanyDetailsRoute from "./pages/servicesModule/CompanyDetailsRoute";
import DomainMappingRoute from "./pages/servicesModule/DomainMappingRoute";
import FiscalYearRoute from "./pages/servicesModule/FiscalYearRoute";
import HolidaysRoute from "./pages/servicesModule/HolidaysRoute";
import IntegrationsPage from "./pages/integrations/IntegrationsPage";
import EmailIntegrationsPage from "./pages/integrations/EmailIntegrationsPage";
import SocialIntegrationsPage from "./pages/integrations/SocialIntegrationsPage";
import VisitorTrackingPage from "./pages/integrations/VisitorTrackingPage";
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));
const AccountDetailPage = lazy(() => import("./pages/accounts/AccountDetailPage"));
const EditAccountPage = lazy(() => import("./pages/accounts/EditAccountPage"));
const CreateMeetingPage = lazy(() => import("./pages/activities/meetings/CreateMeetingPage"));
const MeetingDetailPage = lazy(() => import("./pages/activities/meetings/MeetingDetailPage"));
const CreateTaskPage = lazy(() => import("./pages/activities/tasks/CreateTaskPage"));
const TaskDetailPage = lazy(() => import("./pages/activities/tasks/TaskDetailPage"));
const DocumentDetailPage = lazy(() => import("./pages/documents/DocumentDetailPage"));
const CampaignDetailPage = lazy(() => import("./pages/campaigns/CampaignDetailPage"));
const CreateCampaignPage = lazy(() => import("./pages/campaigns/CreateCampaignPage"));
const PublicCampaignFormPage = lazy(() => import("./pages/campaigns/PublicCampaignFormPage"));
const ContactDetailPage = lazy(() => import("./pages/contacts/ContactDetailPage"));
const EditContactPage = lazy(() => import("./pages/contacts/EditContactPage"));
const ImportPage = lazy(() => import("./pages/crm/ImportPage"));
const DealDetailPage = lazy(() => import("./pages/deals/DealDetailPage"));
const CreateAccountPage = lazy(() => import("./pages/accounts/CreateAccountPage"));
const CreateContactPage = lazy(() => import("./pages/contacts/CreateContactPage"));
const CreateDealPage = lazy(() => import("./pages/deals/CreateDealPage"));
const CreateLeadPage = lazy(() => import("./pages/leads/CreateLeadPage"));
const LeadDetailPage = lazy(() => import("./pages/leads/LeadDetailPage"));
const EmployeeProfilePage = lazy(() => import("./pages/team/EmployeeProfilePage"));
import TeamPage from "./pages/team/TeamPage";
const UserCreatePage = lazy(() => import("./pages/team/UserCreatePage"));
const UsersListPage = lazy(() => import("./pages/team/UsersListPage"));
const CreateProjectPage = lazy(() => import("./pages/projects/CreateProjectPage"));
const ProjectDetailPage = lazy(() => import("./pages/projects/ProjectDetailPage"));
const CreateProjectDeskTaskPage = lazy(() => import("./pages/projectdesk/CreateProjectDeskTaskPage"));
const CreateProjectDeskMeetingPage = lazy(() => import("./pages/projectdesk/CreateProjectDeskMeetingPage"));
const InventoryFormRoute = lazy(() => import("./pages/inventory/InventoryFormRoute"));
const InventoryDetailRoute = lazy(() => import("./pages/inventory/InventoryDetailRoute"));
const PriceBookImportPage = lazy(() => import("./pages/inventory/PriceBookImportPage"));
const CaseFormRoute = lazy(() => import("./pages/support/CaseFormRoute"));
const CaseDetailRoute = lazy(() => import("./pages/support/CaseDetailRoute"));
const CaseImportRoute = lazy(() => import("./pages/support/CaseImportRoute"));
const SolutionFormRoute = lazy(() => import("./pages/support/SolutionFormRoute"));
const SolutionDetailRoute = lazy(() => import("./pages/support/SolutionDetailRoute"));
const SolutionImportRoute = lazy(() => import("./pages/support/SolutionImportRoute"));
const ServiceFormRoute = lazy(() => import("./pages/servicesModule/ServiceFormRoute"));
const ServiceDetailRoute = lazy(() => import("./pages/servicesModule/ServiceDetailRoute"));
const AppointmentFormRoute = lazy(() => import("./pages/servicesModule/AppointmentFormRoute"));
const AppointmentDetailRoute = lazy(() => import("./pages/servicesModule/AppointmentDetailRoute"));
const JobSheetFormRoute = lazy(() => import("./pages/servicesModule/JobSheetFormRoute"));
const JobSheetDetailRoute = lazy(() => import("./pages/servicesModule/JobSheetDetailRoute"));

function RouteFallback() {
  return (
    <div className="p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function hasSession() {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem("isLoggedIn") === "true" &&
    Boolean(localStorage.getItem("accessToken")) &&
    Boolean(localStorage.getItem("refreshToken")) &&
    Boolean(localStorage.getItem("loggedInUser"))
  );
}

function getMustChangePassword() {
  try {
    const raw = localStorage.getItem("loggedInUser");
    if (!raw) return false;
    const user = JSON.parse(raw) as { must_change_password?: boolean };
    return user.must_change_password === true;
  } catch {
    return false;
  }
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState(hasSession());

  useEffect(() => {
    const sync = () => setAuthenticated(hasSession());
    window.addEventListener("storage", sync);
    window.addEventListener("auth:login", sync as EventListener);
    window.addEventListener("auth:logout", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth:login", sync as EventListener);
      window.removeEventListener("auth:logout", sync as EventListener);
    };
  }, []);

  // Silently refresh allowed_modules from backend so sidebar stays in sync
  // without requiring a re-login after role/department changes.
  useEffect(() => {
    if (!hasSession()) return;

    apiRequest<{ allowed_modules?: string[]; department?: string }>("/auth/my-modules/", {
      cacheTtlMs: 5 * 60 * 1000,
    })
      .then((data: { allowed_modules?: string[]; department?: string } | null) => {
        if (!data?.allowed_modules) return;
        const raw = localStorage.getItem("loggedInUser");
        if (!raw) return;
        const storedUser = JSON.parse(raw) as Record<string, unknown>;
        const prevModules = JSON.stringify(storedUser.allowed_modules);
        const prevDept = storedUser.department;
        storedUser.allowed_modules = data.allowed_modules;
        if (data.department !== undefined) storedUser.department = data.department;
        localStorage.setItem("loggedInUser", JSON.stringify(storedUser));
        // Only trigger re-render if something changed
        if (
          prevModules !== JSON.stringify(data.allowed_modules) ||
          prevDept !== data.department
        ) {
          window.dispatchEvent(new Event("auth:modules-updated"));
        }
      })
      .catch(() => {});
  }, []);

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

/**
 * Redirects to /change-password if the logged-in user has must_change_password=true.
 * Placed inside RequireAuth so it only runs for authenticated users.
 */
function MustChangePasswordGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (getMustChangePassword() && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

const MODULE_ROUTE_PREFIXES: Array<{ module: string; prefixes: string[] }> = [
  { module: "sales", prefixes: ["/leads", "/contacts", "/accounts", "/deals", "/documents", "/campaigns"] },
  { module: "activities", prefixes: ["/tasks", "/meetings", "/calls"] },
  {
    module: "inventory",
    prefixes: ["/products", "/price-books", "/quotes", "/sales-orders", "/purchase-orders", "/invoices", "/vendors", "/configurator"],
  },
  { module: "support", prefixes: ["/support"] },
  { module: "integrations", prefixes: ["/integrations"] },
  { module: "services", prefixes: ["/services"] },
  { module: "projects", prefixes: ["/projects"] },
];

function getRequiredModuleForPath(pathname: string) {
  for (const entry of MODULE_ROUTE_PREFIXES) {
    if (entry.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return entry.module;
    }
  }
  return null;
}

function ModuleAccessGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { canAccess } = useAuth();
  const requiredModule = getRequiredModuleForPath(location.pathname);

  if (requiredModule && !canAccess(requiredModule)) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

      {/* First-login password change — auth required but no dashboard shell */}
        <Route
          path="/change-password"
          element={
            <RequireAuth>
              <ChangePasswordPage />
            </RequireAuth>
          }
        />

      {/* Public campaign form — no auth required */}
        <Route path="/public/campaigns/:campaignId/form" element={<PublicCampaignFormPage />} />

        <Route
          element={
            <RequireAuth>
              <MustChangePasswordGuard>
                <ModuleAccessGuard>
                  <DashboardLayoutRoute />
                </ModuleAccessGuard>
              </MustChangePasswordGuard>
            </RequireAuth>
          }
        >
        <Route path="/home" element={<HomePage />} />
        <Route path="/my-requests" element={<MyRequestsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />

        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/create" element={<CreateLeadPage />} />
        <Route path="/leads/:id/edit" element={<CreateLeadPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/leads/import" element={<ImportPage />} />
        <Route path="/leads/import-notes" element={<ImportPage />} />

        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/contacts/create" element={<CreateContactPage />} />
        <Route path="/contacts/:id/edit" element={<EditContactPage />} />
        <Route path="/contacts/:id" element={<ContactDetailPage />} />
        <Route path="/contacts/import" element={<ImportPage />} />
        <Route path="/contacts/import-notes" element={<ImportPage />} />

        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/create" element={<CreateAccountPage />} />
        <Route path="/accounts/:id/edit" element={<EditAccountPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
        <Route path="/accounts/import" element={<ImportPage />} />
        <Route path="/accounts/import-notes" element={<ImportPage />} />

        <Route path="/deals" element={<DealsPage />} />
        <Route path="/deals/create" element={<CreateDealPage />} />
        <Route path="/deals/:id" element={<DealDetailPage />} />
        <Route path="/deals/import" element={<ImportPage />} />
        <Route path="/deals/import-notes" element={<ImportPage />} />

        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/create" element={<CreateTaskPage />} />
        <Route path="/tasks/:id/edit" element={<CreateTaskPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />

        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/meetings/create" element={<CreateMeetingPage />} />
        <Route path="/meetings/:id/edit" element={<CreateMeetingPage />} />
        <Route path="/meetings/:id" element={<MeetingDetailPage />} />

        <Route path="/calls" element={<CallsPage />} />

        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/create" element={<CreateCampaignPage />} />
        <Route path="/campaigns/:id/edit" element={<CreateCampaignPage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/campaigns/import" element={<ImportPage />} />
        <Route path="/campaigns/import-notes" element={<ImportPage />} />

        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentDetailPage />} />

        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/create" element={<CreateProjectPage />} />
        <Route path="/projects/:id/edit" element={<CreateProjectPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projectdesk/tasks/create" element={<CreateProjectDeskTaskPage />} />
        <Route path="/projectdesk/meetings/create" element={<CreateProjectDeskMeetingPage />} />

        <Route path="/team" element={<TeamPage />} />
        <Route path="/team/users" element={<UsersListPage />} />
        <Route path="/team/user/:id" element={<EmployeeProfilePage />} />
        <Route path="/team/users/create" element={<UserCreatePage />} />

        <Route path="/support/cases" element={<CasesPage />} />
        <Route path="/support/cases/create" element={<CaseFormRoute />} />
        <Route path="/support/cases/:id" element={<CaseDetailRoute />} />
        <Route path="/support/cases/:id/edit" element={<CaseFormRoute />} />
        <Route path="/support/cases/import" element={<CaseImportRoute />} />

        <Route path="/support/solutions" element={<SolutionsPage />} />
        <Route path="/support/solutions/create" element={<SolutionFormRoute />} />
        <Route path="/support/solutions/:id" element={<SolutionDetailRoute />} />
        <Route path="/support/solutions/:id/edit" element={<SolutionFormRoute />} />
        <Route path="/support/solutions/import" element={<SolutionImportRoute />} />

        <Route path="/services/business-hours" element={<BusinessHoursRoute />} />
        <Route path="/services/business-hours/new" element={<BusinessHoursRoute />} />
        <Route path="/services/catalog" element={<ServicesCatalogPage />} />
        <Route path="/services/catalog/create" element={<ServiceFormRoute />} />
        <Route path="/services/catalog/:id" element={<ServiceDetailRoute />} />
        <Route path="/services/catalog/:id/edit" element={<ServiceFormRoute />} />
        <Route path="/services/appointments" element={<AppointmentsPage />} />
        <Route path="/services/appointments/create" element={<AppointmentFormRoute />} />
        <Route path="/services/appointments/:id" element={<AppointmentDetailRoute />} />
        <Route path="/services/appointments/:id/edit" element={<AppointmentFormRoute />} />
        <Route path="/services/job-sheets/create" element={<JobSheetFormRoute />} />
        <Route path="/services/job-sheets/:id" element={<JobSheetDetailRoute />} />
        <Route path="/services/job-sheets/:id/edit" element={<JobSheetFormRoute />} />
        <Route path="/services/settings/company-details" element={<CompanyDetailsRoute />} />
        <Route path="/services/settings/domain-mapping" element={<DomainMappingRoute />} />
        <Route path="/services/settings/fiscal-year" element={<FiscalYearRoute />} />
        <Route path="/services/settings/holidays" element={<HolidaysRoute />} />

        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/integrations/email" element={<EmailIntegrationsPage />} />
        <Route path="/integrations/social" element={<SocialIntegrationsPage />} />
        <Route path="/integrations/visitors" element={<VisitorTrackingPage />} />

        <Route path="/vendors" element={<InventoryListRoute moduleKey="vendors" />} />
        <Route path="/vendors/create" element={<InventoryFormRoute moduleKey="vendors" />} />
        <Route path="/vendors/:id/edit" element={<InventoryFormRoute moduleKey="vendors" />} />
        <Route path="/vendors/:id" element={<InventoryDetailRoute moduleKey="vendors" />} />

        <Route path="/products" element={<InventoryListRoute moduleKey="products" />} />
        <Route path="/products/create" element={<InventoryFormRoute moduleKey="products" />} />
        <Route path="/products/:id/edit" element={<InventoryFormRoute moduleKey="products" />} />
        <Route path="/products/:id" element={<InventoryDetailRoute moduleKey="products" />} />

        <Route path="/price-books" element={<InventoryListRoute moduleKey="price-books" />} />
        <Route path="/price-books/create" element={<InventoryFormRoute moduleKey="price-books" />} />
        <Route path="/price-books/import" element={<PriceBookImportPage />} />
        <Route path="/price-books/:id/edit" element={<InventoryFormRoute moduleKey="price-books" />} />
        <Route path="/price-books/:id" element={<InventoryDetailRoute moduleKey="price-books" />} />

        <Route path="/quotes" element={<InventoryListRoute moduleKey="quotes" />} />
        <Route path="/quotes/create" element={<InventoryFormRoute moduleKey="quotes" />} />
        <Route path="/quotes/:id/edit" element={<InventoryFormRoute moduleKey="quotes" />} />
        <Route path="/quotes/:id" element={<InventoryDetailRoute moduleKey="quotes" />} />

        <Route path="/sales-orders" element={<InventoryListRoute moduleKey="sales-orders" />} />
        <Route path="/sales-orders/create" element={<InventoryFormRoute moduleKey="sales-orders" />} />
        <Route path="/sales-orders/:id/edit" element={<InventoryFormRoute moduleKey="sales-orders" />} />
        <Route path="/sales-orders/:id" element={<InventoryDetailRoute moduleKey="sales-orders" />} />

        <Route path="/purchase-orders" element={<InventoryListRoute moduleKey="purchase-orders" />} />
        <Route path="/purchase-orders/create" element={<InventoryFormRoute moduleKey="purchase-orders" />} />
        <Route path="/purchase-orders/:id/edit" element={<InventoryFormRoute moduleKey="purchase-orders" />} />
        <Route path="/purchase-orders/:id" element={<InventoryDetailRoute moduleKey="purchase-orders" />} />

        <Route path="/invoices" element={<InventoryListRoute moduleKey="invoices" />} />
        <Route path="/invoices/create" element={<InventoryFormRoute moduleKey="invoices" />} />
        <Route path="/invoices/:id/edit" element={<InventoryFormRoute moduleKey="invoices" />} />
        <Route path="/invoices/:id" element={<InventoryDetailRoute moduleKey="invoices" />} />

        <Route path="/configurator" element={<InventoryListRoute moduleKey="configurator" />} />
        <Route path="/configurator/create" element={<InventoryFormRoute moduleKey="configurator" />} />
        <Route path="/configurator/:id/edit" element={<InventoryFormRoute moduleKey="configurator" />} />
        <Route path="/configurator/:id" element={<InventoryDetailRoute moduleKey="configurator" />} />

        <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
