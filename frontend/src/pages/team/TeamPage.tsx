import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import AdminDashboard from "../admin/AdminDashboard";
import ManagerDashboard from "../manager/ManagerDashboard";
import UsersListPage from "./UsersListPage";

export default function TeamPage() {
  const { isAdmin, isManager, user } = useAuth();

  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (isManager) {
    return <ManagerDashboard />;
  }

  if (user?.id != null) {
    return <Navigate to={`/team/user/${user.id}`} replace />;
  }

  return <UsersListPage />;
}
