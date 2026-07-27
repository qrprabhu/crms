import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { preloadRoutes } from "../../lib/routePreload";

const InsideLayoutContext = createContext(false);

export function DashboardLayoutRoute() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const warmCommonRoutes = () => {
      preloadRoutes(["/home", "/reports", "/analytics", "/my-requests", "/leads", "/deals", "/tasks", "/meetings"]);
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleId = idleWindow.requestIdleCallback(() => warmCommonRoutes(), { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(warmCommonRoutes, 300);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <InsideLayoutContext.Provider value={true}>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="flex-1 min-h-0 overflow-y-auto p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </InsideLayoutContext.Provider>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const isInsideLayout = useContext(InsideLayoutContext);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768;
  });

  if (isInsideLayout) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 min-h-0 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
