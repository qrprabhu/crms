import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BadgeDollarSign,
  BarChart3,
  BookOpenText,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDot,
  ClipboardList,
  FileSignature,
  FileText,
  Folder,
  HandHelping,
  Home,
  Inbox,
  Lightbulb,
  MapPinned,
  Megaphone,
  Package,
  PanelLeft,
  Phone,
  PieChart,
  ReceiptText,
  Search,
  Settings2,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { preloadRouteResources } from "../../lib/routePreload";

type SidebarProps = {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

type NavItem = {
  label: string;
  icon: React.ElementType;
  path?: string;
  expandable?: boolean;
  /** module slug — used for access control. Undefined means always visible. */
  module?: string;
  children?: { label: string; icon: React.ElementType; path: string; excludeDepartments?: string[] }[];
};

const primaryItems: NavItem[] = [
  { label: "Home", icon: Home, path: "/home" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Analytics", icon: PieChart, path: "/analytics" },
  { label: "My Requests", icon: ClipboardList, path: "/my-requests" },
];

const workspaceItems: NavItem[] = [
  {
    label: "Sales",
    icon: ShoppingBag,
    module: "sales",
    expandable: true,
    children: [
      { label: "Leads", icon: CircleDot, path: "/leads" },
      { label: "Contacts", icon: Users, path: "/contacts" },
      { label: "Accounts", icon: Building2, path: "/accounts" },
      { label: "Deals", icon: BadgeDollarSign, path: "/deals" },
      { label: "Documents", icon: FileText, path: "/documents" },
      { label: "Campaigns", icon: Megaphone, path: "/campaigns" },
    ],
  },
  {
    label: "Activities",
    icon: Search,
    module: "activities",
    expandable: true,
    children: [
      { label: "Tasks", icon: CircleDot, path: "/tasks" },
      { label: "Meetings", icon: CalendarDays, path: "/meetings" },
      { label: "Calls", icon: Phone, path: "/calls" },
    ],
  },
  {
    label: "Inventory",
    icon: Package,
    module: "inventory",
    expandable: true,
    children: [
      { label: "Products", icon: CircleDot, path: "/products" },
      { label: "Price Books", icon: BookOpenText, path: "/price-books" },
      { label: "Quotes", icon: FileSignature, path: "/quotes" },
      { label: "Sales Orders", icon: ShoppingCart, path: "/sales-orders" },
      { label: "Purchase Orders", icon: ReceiptText, path: "/purchase-orders" },
      { label: "Invoices", icon: FileText, path: "/invoices" },
      { label: "Vendors", icon: Truck, path: "/vendors" },
    ],
  },
  {
    label: "Support",
    icon: HandHelping,
    module: "support",
    expandable: true,
    children: [
      { label: "Cases", icon: CircleDot, path: "/support/cases" },
      { label: "Solutions", icon: Lightbulb, path: "/support/solutions" },
    ],
  },
  {
    label: "Integrations",
    icon: Settings2,
    module: "integrations",
    expandable: true,
    children: [
      { label: "Email", icon: Inbox, path: "/integrations/email" },
      { label: "Social", icon: Share2, path: "/integrations/social", excludeDepartments: ["software_development"] },
      { label: "Visitor Tracking", icon: MapPinned, path: "/integrations/visitors", excludeDepartments: ["software_development"] },
    ],
  },
  {
    label: "Services",
    icon: Wrench,
    module: "services",
    expandable: true,
    children: [
      { label: "Business Hours", icon: CalendarDays, path: "/services/business-hours" },
      { label: "Catalog", icon: ClipboardList, path: "/services/catalog" },
      { label: "Appointments", icon: CalendarDays, path: "/services/appointments" },
      { label: "Company Details", icon: Building2, path: "/services/settings/company-details" },
      { label: "Domain Mapping", icon: MapPinned, path: "/services/settings/domain-mapping" },
      { label: "Fiscal Year", icon: BarChart3, path: "/services/settings/fiscal-year" },
      { label: "Holidays", icon: CalendarDays, path: "/services/settings/holidays" },
    ],
  },
  { label: "Projects", icon: Folder, module: "projects", path: "/projects" },
];

const getParentMenuByPath = (pathname: string, items: NavItem[]) => {
  for (const item of items) {
    if (!item.children) continue;
    const hasMatch = item.children.some(
      (child) => pathname === child.path || pathname.startsWith(`${child.path}/`)
    );
    if (hasMatch) return item.label;
  }
  return null;
};

const initialOpenMenus: Record<string, boolean> = {
  Sales: true,
  Activities: false,
  Inventory: false,
  Support: false,
  Integrations: false,
  Services: false,
};

export default function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  console.log("Sidebar rendered, Voice of Customer should be gone.");
  const { user, isAdmin, isManager, canAccess } = useAuth();
  const userDepartment = user?.department ?? "";
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(initialOpenMenus);
  const visibleWorkspaceItems = useMemo(
    () => workspaceItems.filter((item) => !item.module || canAccess(item.module)),
    [canAccess]
  );

  useEffect(() => {
    const parentMenu = getParentMenuByPath(location.pathname, visibleWorkspaceItems);
    setOpenMenus((prev) => {
      const nextState: Record<string, boolean> = {};
      Object.keys(prev).forEach((key) => {
        nextState[key] = key === parentMenu;
      });
      return nextState;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const visibleSidebarPaths = useMemo(() => {
    const paths = primaryItems
      .map((item) => item.path)
      .filter((path): path is string => Boolean(path));

    if (isAdmin || isManager) {
      paths.push("/team");
    }

    visibleWorkspaceItems.forEach((item) => {
      if (item.path) {
        paths.push(item.path);
      }

      item.children
        ?.filter((child) => !child.excludeDepartments?.includes(userDepartment))
        .forEach((child) => {
          paths.push(child.path);
        });
    });

    return [...new Set(paths)];
  }, [isAdmin, isManager, userDepartment, visibleWorkspaceItems]);

  useEffect(() => {
    if (typeof window === "undefined" || visibleSidebarPaths.length === 0) return;

    const preloadVisibleSidebarRoutes = () => {
      visibleSidebarPaths.forEach((path) => preloadRouteResources(path));
    };

    const timeoutId = window.setTimeout(preloadVisibleSidebarRoutes, 50);
    return () => window.clearTimeout(timeoutId);
  }, [visibleSidebarPaths]);

  const handleNavigate = (path?: string) => {
    if (!path) return;
    preloadRouteResources(path);
    navigate(path);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleToggleMenu = (label: string) => {
    if (!sidebarOpen) return;
    setOpenMenus((prev) => {
      const nextState: Record<string, boolean> = {};
      Object.keys(prev).forEach((key) => {
        nextState[key] = key === label ? !prev[key] : false;
      });
      return nextState;
    });
  };

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 h-screen overflow-y-auto bg-[#1E3A8A] text-white transition-all duration-300 md:static md:z-auto md:flex md:h-screen md:flex-col ${
          sidebarOpen
            ? "translate-x-0 w-56"
            : "-translate-x-full w-56 md:translate-x-0 md:w-14"
        }`}
      >
        <div className={`flex min-h-full flex-col ${sidebarOpen ? "min-w-[224px]" : "min-w-[56px]"}`}>
          {sidebarOpen ? (
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <div className="flex items-center">
                <div className="flex h-[34px] w-[34px] -translate-y-[2px] items-center justify-center rounded-full bg-white p-1 shadow-sm">
                  <svg className="h-[28px] w-[28px]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 78 35 A 36 36 0 1 0 35 83" stroke="#2563EB" strokeWidth="6.5" strokeLinecap="round" fill="none" />
                    <path d="M 30 75 C 45 88, 70 85, 84 62 C 86 58, 85 45, 84 43 C 81 48, 75 60, 50 72 Z" fill="#1E3A8A" />
                    <circle cx="37" cy="52" r="5" fill="#2563EB" />
                    <rect x="33" y="60" width="8" height="16" rx="4" fill="#2563EB" />
                    <circle cx="50" cy="43" r="5" fill="#1E3A8A" />
                    <rect x="46" y="51" width="8" height="24" rx="4" fill="#1E3A8A" />
                    <circle cx="63" cy="35" r="5" fill="#D97706" />
                    <rect x="59" y="43" width="8" height="31" rx="4" fill="#D97706" />
                  </svg>
                </div>
                <div className="ml-2.5 text-[17px] font-bold">SSH Connect</div>
              </div>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-white/10 text-white"
                aria-label="Collapse sidebar"
              >
                <span className="hidden md:block">
                  <PanelLeft size={18} />
                </span>
                <span className="md:hidden">
                  <X size={18} />
                </span>
              </button>
            </div>
          ) : (
            <div className="flex justify-center px-2 pt-3 pb-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-md transition hover:opacity-90"
                aria-label="Expand sidebar"
              >
                <div className="flex h-[34px] w-[34px] -translate-y-[2px] items-center justify-center rounded-full bg-white p-1 shadow-sm">
                  <svg className="h-[28px] w-[28px]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 78 35 A 36 36 0 1 0 35 83" stroke="#2563EB" strokeWidth="6.5" strokeLinecap="round" fill="none" />
                    <path d="M 30 75 C 45 88, 70 85, 84 62 C 86 58, 85 45, 84 43 C 81 48, 75 60, 50 72 Z" fill="#1E3A8A" />
                    <circle cx="37" cy="52" r="5" fill="#2563EB" />
                    <rect x="33" y="60" width="8" height="16" rx="4" fill="#2563EB" />
                    <circle cx="50" cy="43" r="5" fill="#1E3A8A" />
                    <rect x="46" y="51" width="8" height="24" rx="4" fill="#1E3A8A" />
                    <circle cx="63" cy="35" r="5" fill="#D97706" />
                    <rect x="59" y="43" width="8" height="31" rx="4" fill="#D97706" />
                  </svg>
                </div>
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pb-3">
            <nav className={sidebarOpen ? "px-2.5" : "px-1.5"}>
              <div className="flex flex-col gap-0.5">
                {primaryItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleNavigate(item.path)}
                      onMouseEnter={() => preloadRouteResources(item.path)}
                      onFocus={() => preloadRouteResources(item.path)}
                      title={!sidebarOpen ? item.label : undefined}
                      className={[
                        "flex w-full items-center rounded-lg text-left text-[14px] transition",
                        sidebarOpen ? "gap-2 px-2.5 py-2" : "justify-center px-2 py-2.5",
                        location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
                          ? "bg-[#2563EB] font-semibold text-white"
                          : "text-blue-100 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
                    >
                      <Icon size={17} />
                      {sidebarOpen && <span>{item.label}</span>}
                    </button>
                  );
                })}

                {(isAdmin || isManager) && (
                  <button
                    type="button"
                    onClick={() => handleNavigate("/team")}
                    onMouseEnter={() => preloadRouteResources("/team")}
                    onFocus={() => preloadRouteResources("/team")}
                    title={!sidebarOpen ? "My Team" : undefined}
                    className={[
                      "flex w-full items-center rounded-lg text-left text-[14px] transition",
                      sidebarOpen ? "gap-2 px-2.5 py-2" : "justify-center px-2 py-2.5",
                      location.pathname.startsWith("/team")
                        ? "bg-[#2563EB] font-semibold text-white"
                        : "text-blue-100 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    <Users size={17} />
                    {sidebarOpen && <span>My Team</span>}
                  </button>
                )}
              </div>
            </nav>

            <div className={`my-3 border-t border-white/10 ${sidebarOpen ? "mx-2.5" : "mx-2"}`} />

            {sidebarOpen ? (
              <div className="px-2.5">
                <div className="px-2.5 pb-2.5 text-[14px] font-semibold text-blue-200">CRM Teamspace</div>

                <div className="flex flex-col gap-0.5">
                  {visibleWorkspaceItems.map((item) => {
                    const Icon = item.icon;
                    const isOpen = !!openMenus[item.label];

                    return (
                      <div key={item.label}>
                        <div className="group flex items-center justify-between rounded-lg px-2.5 py-2 text-[14px] transition hover:bg-white/10 text-blue-100 hover:text-white">
                          <button
                            type="button"
                            onClick={() =>
                              item.expandable ? handleToggleMenu(item.label) : handleNavigate(item.path)
                            }
                            className="flex flex-1 items-center gap-2 text-left"
                          >
                            <Icon size={15} />
                            <span>{item.label}</span>
                          </button>

                          {item.expandable && (
                            <div
                              className={`flex items-center gap-0.5 transition ${
                                isOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleMenu(item.label)}
                                className="rounded p-1 hover:bg-white/20"
                                aria-label={`Toggle ${item.label} submenu`}
                              >
                                <ChevronDown
                                  size={13}
                                  className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                />
                              </button>
                            </div>
                          )}
                        </div>

                        {item.expandable && isOpen && item.children && (
                          <div className="ml-6 mt-1 flex flex-col gap-0.5">
                            {item.children.filter((child) =>
                              !child.excludeDepartments?.includes(userDepartment)
                            ).map((child) => {
                              const ChildIcon = child.icon;
                              return (
                                <button
                                  key={child.label}
                                  type="button"
                                  onClick={() => handleNavigate(child.path)}
                                  onMouseEnter={() => preloadRouteResources(child.path)}
                                  onFocus={() => preloadRouteResources(child.path)}
                                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${
                                    location.pathname === child.path || location.pathname.startsWith(`${child.path}/`)
                                      ? "bg-[#2563EB] font-semibold text-white"
                                      : "text-blue-200 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  <ChildIcon size={13} />
                                  <span>{child.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-1.5">
                <div className="flex flex-col gap-0.5">
                  {visibleWorkspaceItems.map((item) => {
                    const Icon = item.icon;
                    const fallbackPath = item.path ?? item.children?.[0]?.path;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        title={item.label}
                        onClick={() => handleNavigate(fallbackPath)}
                        onMouseEnter={() => preloadRouteResources(fallbackPath)}
                        onFocus={() => preloadRouteResources(fallbackPath)}
                        className="flex w-full items-center justify-center rounded-lg px-2 py-2.5 text-blue-100 transition hover:bg-white/10"
                      >
                        <Icon size={17} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
