import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";

export default function BusinessOwnerRoute() {
  const { user } = useAuth();
  const { activeRoleName, loading } = useWorkspace();

  if (user?.systemRole === "SYSTEM_ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-zera-muted">
        Loading workspace access...
      </div>
    );
  }

  if (activeRoleName !== "Owner") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
