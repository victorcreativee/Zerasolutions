import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";

export default function BusinessModuleRoute({ allowedRoles, moduleKey, moduleKeys }) {
  const { user } = useAuth();
  const { activeBusiness, activeRoleName, loading } = useWorkspace();

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

  if (!activeBusiness) {
    return <Navigate to="/dashboard" replace />;
  }

  const requiredModuleKeys = moduleKeys?.length ? moduleKeys : [moduleKey];
  const moduleIsActive = activeBusiness.modules?.some((module) => requiredModuleKeys.includes(module.key) && module.active);
  const roleIsAllowed = allowedRoles.includes(activeRoleName);

  if (!moduleIsActive || !roleIsAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
