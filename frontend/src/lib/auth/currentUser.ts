type LoggedInUser = {
  id?: string | number;
  name?: string;
  full_name?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  username?: string;
  email?: string;
  role?: string;
};

export function getLoggedInUser(): LoggedInUser | null {
  const raw = localStorage.getItem("loggedInUser");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LoggedInUser;
  } catch {
    return null;
  }
}

export function getLoggedInUserName(fallback = "Assigned to you"): string {
  const user = getLoggedInUser();
  if (!user) return fallback;

  const fullName =
    user.name ||
    user.full_name ||
    [user.firstName || user.first_name || "", user.lastName || user.last_name || ""]
      .join(" ")
      .trim() ||
    user.username ||
    user.email;

  return fullName?.trim() || fallback;
}
