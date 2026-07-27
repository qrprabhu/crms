import { useCallback, useEffect, useState } from "react";
import { getStoredUser } from "../lib/api/authApi";
import type { UserRole, AuthUser } from "../lib/api/authApi";

export type { UserRole, AuthUser };

const ALL_MODULES = ["sales", "activities", "inventory", "support", "integrations", "services", "projects"];

const DEPT_MODULE_MAP: Record<string, string[]> = {
  sales: ["sales", "activities", "inventory"],
  business_development: ["sales", "activities", "integrations"],
  software_development: ["support", "projects", "integrations"],
  support: ["support", "activities", "services"],
};

const ROLE_MODULE_MAP: Record<string, string[]> = {
  admin: ALL_MODULES,
  sub_admin: ALL_MODULES,
  hr: ["sales", "activities", "projects"],
  manager: ["sales", "activities", "inventory", "support", "services", "projects"],
  sales_manager: ["sales", "activities", "inventory", "services", "projects"],
  team_lead: ["activities", "services", "projects"],
  business_development: ["sales", "activities", "integrations"],
  software_development: ["support", "projects"],
  support_team: ["support"],
  employee: ["sales", "activities"],
};

function deriveAllowedModules(role: string, department: string | undefined, stored: string[]) {
  const normalizedRole = (role || "").trim().toLowerCase();
  const dept = (department || "").trim().toLowerCase();

  let roleDerived = ROLE_MODULE_MAP[normalizedRole] ?? ROLE_MODULE_MAP.employee;

  if (normalizedRole === "admin" || normalizedRole === "sub_admin") {
    roleDerived = ALL_MODULES;
  } else if (["manager", "sales_manager", "team_lead", "employee"].includes(normalizedRole) && dept && DEPT_MODULE_MAP[dept]) {
    roleDerived = DEPT_MODULE_MAP[dept];
  }

  if (stored && stored.length > 0) {
    return stored.filter((module) => roleDerived.includes(module));
  }

  return roleDerived;
}

export function useAuth() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener("auth:login", refresh as EventListener);
    window.addEventListener("auth:logout", refresh as EventListener);
    window.addEventListener("auth:modules-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("auth:login", refresh as EventListener);
      window.removeEventListener("auth:logout", refresh as EventListener);
      window.removeEventListener("auth:modules-updated", refresh);
    };
  }, []);

  const user = getStoredUser();
  const role: UserRole = (user?.role as UserRole) ?? "employee";
  const derivedAllowedModules = deriveAllowedModules(role, user?.department, user?.allowed_modules ?? []);
  const canAccess = useCallback(
    (module: string) => role === "admin" || role === "sub_admin" || derivedAllowedModules.includes(module),
    [derivedAllowedModules, role]
  );

  return {
    user,
    role,
    // Role convenience flags
    isMainAdmin: role === "admin",
    isSubAdmin: role === "sub_admin",
    isAdmin: role === "admin" || role === "sub_admin",   // backwards-compat
    isManager: role === "manager" || role === "team_lead",
    isEmployee: !["admin", "sub_admin", "manager", "team_lead"].includes(role),
    // Module access
    allowedModules: derivedAllowedModules,
    canAccess,
    mustChangePassword: user?.must_change_password ?? false,
  };
}
