type RouteLoader = () => Promise<unknown>;
type RouteWarmer = () => Promise<unknown>;

const routeLoaders: Array<{ prefix: string; loader: RouteLoader }> = [
  { prefix: "/home", loader: () => import("../pages/HomePage") },
  { prefix: "/reports", loader: () => import("../pages/ReportsPage") },
  { prefix: "/analytics", loader: () => import("../pages/AnalyticsPage") },
  { prefix: "/my-requests", loader: () => import("../pages/MyRequestsPage") },
  { prefix: "/calendar", loader: () => import("../pages/CalendarPage") },
  { prefix: "/leads", loader: () => import("../pages/leads/LeadsPage") },
  { prefix: "/contacts", loader: () => import("../pages/contacts/ContactsPage") },
  { prefix: "/accounts", loader: () => import("../pages/accounts/AccountsPage") },
  { prefix: "/deals", loader: () => import("../pages/deals/DealsPage") },
  { prefix: "/documents", loader: () => import("../pages/documents/DocumentsPage") },
  { prefix: "/campaigns", loader: () => import("../pages/campaigns/CampaignsPage") },
  { prefix: "/tasks", loader: () => import("../pages/activities/tasks") },
  { prefix: "/meetings", loader: () => import("../pages/activities/meetings") },
  { prefix: "/calls", loader: () => import("../pages/activities/calls") },
  { prefix: "/projects", loader: () => import("../pages/projects/ProjectsPage") },
  { prefix: "/team", loader: () => import("../pages/team/TeamPage") },
  { prefix: "/products", loader: () => import("../pages/inventory/InventoryListRoute") },
  { prefix: "/price-books", loader: () => import("../pages/inventory/InventoryListRoute") },
  { prefix: "/quotes", loader: () => import("../pages/inventory/InventoryListRoute") },
  { prefix: "/sales-orders", loader: () => import("../pages/inventory/InventoryListRoute") },
  { prefix: "/purchase-orders", loader: () => import("../pages/inventory/InventoryListRoute") },
  { prefix: "/invoices", loader: () => import("../pages/inventory/InventoryListRoute") },
  { prefix: "/vendors", loader: () => import("../pages/inventory/InventoryListRoute") },
  { prefix: "/support/cases", loader: () => import("../pages/support/CasesPage") },
  { prefix: "/support/solutions", loader: () => import("../pages/support/SolutionsPage") },
  { prefix: "/services/business-hours", loader: () => import("../pages/servicesModule/BusinessHoursRoute") },
  { prefix: "/services/catalog", loader: () => import("../pages/servicesModule/ServicesCatalogPage") },
  { prefix: "/services/appointments", loader: () => import("../pages/servicesModule/AppointmentsPage") },
  { prefix: "/services/settings/company-details", loader: () => import("../pages/servicesModule/CompanyDetailsRoute") },
  { prefix: "/services/settings/domain-mapping", loader: () => import("../pages/servicesModule/DomainMappingRoute") },
  { prefix: "/services/settings/fiscal-year", loader: () => import("../pages/servicesModule/FiscalYearRoute") },
  { prefix: "/services/settings/holidays", loader: () => import("../pages/servicesModule/HolidaysRoute") },
  { prefix: "/integrations/email", loader: () => import("../pages/integrations/EmailIntegrationsPage") },
  { prefix: "/integrations/social", loader: () => import("../pages/integrations/SocialIntegrationsPage") },
  { prefix: "/integrations/visitors", loader: () => import("../pages/integrations/VisitorTrackingPage") },
  { prefix: "/integrations", loader: () => import("../pages/integrations/IntegrationsPage") },
];

const preloadedPrefixes = new Set<string>();
const routeLoadersBySpecificity = [...routeLoaders].sort((a, b) => b.prefix.length - a.prefix.length);
const warmedPrefixes = new Set<string>();

const routeWarmers: Array<{ prefix: string; warm: RouteWarmer }> = [
  { prefix: "/leads", warm: async () => (await import("./api/leadsApi")).getLeads({ cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/contacts", warm: async () => (await import("./api/contactsApi")).getContacts({ cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/accounts", warm: async () => (await import("./api/accountsApi")).getAccounts({ cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/deals", warm: async () => (await import("./api/dealsApi")).getDeals({ cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/tasks", warm: async () => (await import("../api/client")).apiRequest("/tasks/", { query: { page_size: 100 }, cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/meetings", warm: async () => (await import("../api/client")).apiRequest("/meetings/", { query: { page_size: 100 }, cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/calls", warm: async () => (await import("../api/client")).apiRequest("/calls/", { query: { page_size: 100 }, cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/projects", warm: async () => (await import("../api/client")).apiRequest("/projects/", { cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/support/cases", warm: async () => (await import("../api/client")).apiRequest("/support/cases/", { cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/support/solutions", warm: async () => (await import("../api/client")).apiRequest("/support/solutions/", { cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/services/catalog", warm: async () => (await import("../api/client")).apiRequest("/services/", { cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/services/appointments", warm: async () => (await import("../api/client")).apiRequest("/services/appointments/", { cacheTtlMs: 2 * 60 * 1000 }) },
  { prefix: "/integrations/email", warm: async () => (await import("../api/client")).apiRequest("/integrations/email/providers/", { cacheTtlMs: 2 * 60 * 1000 }) },
];
const routeWarmersBySpecificity = [...routeWarmers].sort((a, b) => b.prefix.length - a.prefix.length);

function stripQuery(path: string) {
  return path.split("?")[0] || path;
}

function findLoader(path: string) {
  const normalizedPath = stripQuery(path);
  return routeLoadersBySpecificity.find(
    ({ prefix }) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );
}

function findWarmer(path: string) {
  const normalizedPath = stripQuery(path);
  return routeWarmersBySpecificity.find(
    ({ prefix }) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );
}

export function preloadRoute(path?: string | null) {
  if (!path) return;
  const match = findLoader(path);
  if (!match || preloadedPrefixes.has(match.prefix)) return;
  preloadedPrefixes.add(match.prefix);
  void match.loader().catch(() => {
    preloadedPrefixes.delete(match.prefix);
  });
}

export function warmRoute(path?: string | null) {
  if (!path) return;
  const match = findWarmer(path);
  if (!match || warmedPrefixes.has(match.prefix)) return;
  warmedPrefixes.add(match.prefix);
  void match.warm().catch(() => {
    warmedPrefixes.delete(match.prefix);
  });
}

export function preloadRouteResources(path?: string | null) {
  preloadRoute(path);
  warmRoute(path);
}

export function preloadRoutes(paths: string[]) {
  paths.forEach((path) => preloadRoute(path));
}

export function preloadRouteResourcesBulk(paths: string[]) {
  paths.forEach((path) => preloadRouteResources(path));
}
