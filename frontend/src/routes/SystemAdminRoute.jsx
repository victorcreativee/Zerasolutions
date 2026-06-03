import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function SystemAdminRoute() {
  const { user } = useAuth();

  if (user?.systemRole !== "SYSTEM_ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
