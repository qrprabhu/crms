import { getLoggedInUser } from "../auth/currentUser";

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function getCurrentUserIdentity(): string[] {
  const user = getLoggedInUser();
  if (!user) return [];

  const fullName = normalize(user.name || user.full_name || `${user.firstName || user.first_name || ""} ${user.lastName || user.last_name || ""}`.trim());

  return [
    normalize(user.email),
    fullName,
    normalize(user.username),
  ].filter(Boolean);
}

function isEmployeeSession(): boolean {
  return normalize(getLoggedInUser()?.role) === "employee";
}

function matchesCurrentUserIdentity(value: unknown): boolean {
  const candidate = normalize(value);
  if (!candidate) return false;
  return getCurrentUserIdentity().some((identity) => identity === candidate);
}

export function keepEmployeeOwnedRows<T extends object>(rows: T[]): T[] {
  if (!isEmployeeSession()) {
    return rows;
  }

  return rows.filter((row) => {
    const record = row as Record<string, unknown>;
    const organizer = record["organizer"];
    const organizerEmail = organizer && typeof organizer === "object" ? (organizer as Record<string, unknown>)["email"] : undefined;
    const organizerName = organizer && typeof organizer === "object" ? (organizer as Record<string, unknown>)["name"] : undefined;

    const ownerEmail = normalize(
      record["ownerEmail"] ??
      record["owner_email"] ??
      record["uploaded_by_email"] ??
      record["campaignOwnerEmail"] ??
      record["contactOwnerEmail"] ??
      record["accountOwnerEmail"] ??
      record["leadOwnerEmail"]
    );
    if (ownerEmail && getCurrentUserIdentity().includes(ownerEmail)) {
      return true;
    }

    return matchesCurrentUserIdentity(
      record["contactOwner"] ??
      record["accountOwner"] ??
      record["leadOwner"] ??
      record["dealOwner"] ??
      record["owner"] ??
      record["uploaded_by"] ??
      record["campaignOwner"] ??
      organizerEmail ??
      organizerName ??
      record["owner_name"]
    );
  });
}

export function keepEmployeeVisibleRows<T extends object>(rows: T[], ownerResolver: (row: T) => unknown): T[] {
  if (!isEmployeeSession()) {
    return rows;
  }

  return rows.filter((row) => {
    const owner = ownerResolver(row);
    if (owner && typeof owner === "object") {
      const details = owner as Record<string, unknown>;
      return (
        matchesCurrentUserIdentity(details["email"]) ||
        matchesCurrentUserIdentity(details["name"]) ||
        matchesCurrentUserIdentity(details["full_name"])
      );
    }
    return matchesCurrentUserIdentity(owner);
  });
}
