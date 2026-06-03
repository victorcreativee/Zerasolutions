import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { getBusinesses } from "../services/setupService.js";
import { storageKeys } from "../utils/storage.js";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [activeBusinessId, setActiveBusinessId] = useState(() => localStorage.getItem(storageKeys.activeBusiness) || "");
  const [activeBranchId, setActiveBranchId] = useState(() => localStorage.getItem(storageKeys.activeBranch) || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeBusinessId) || null,
    [businesses, activeBusinessId]
  );

  const branches = activeBusiness?.branches || [];
  const activeBranch = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId) || null,
    [branches, activeBranchId]
  );
  const activeMembership = useMemo(
    () => user?.memberships?.find((membership) => membership.businessId === activeBusinessId) || null,
    [activeBusinessId, user?.memberships]
  );
  const activeRoleName = activeMembership?.role?.name || "";

  const selectBranch = useCallback((branchId) => {
    setActiveBranchId(branchId);

    if (branchId) {
      localStorage.setItem(storageKeys.activeBranch, branchId);
    } else {
      localStorage.removeItem(storageKeys.activeBranch);
    }
  }, []);

  const selectBusiness = useCallback(
    (businessId) => {
      setActiveBusinessId(businessId);

      if (businessId) {
        localStorage.setItem(storageKeys.activeBusiness, businessId);
      } else {
        localStorage.removeItem(storageKeys.activeBusiness);
      }
    },
    []
  );

  const refreshWorkspace = useCallback(
    async ({ preferredBusinessId = "", preferredBranchId = "" } = {}) => {
      if (authLoading) {
        return [];
      }

      if (!isAuthenticated) {
        setBusinesses([]);
        setActiveBusinessId("");
        setActiveBranchId("");
        setLoading(false);
        return [];
      }

      try {
        setLoading(true);
        setError("");
        const data = await getBusinesses();
        setBusinesses(data);

        const nextBusiness =
          data.find((business) => business.id === preferredBusinessId) ||
          data.find((business) => business.id === activeBusinessId) ||
          data[0] ||
          null;

        if (!nextBusiness) {
          selectBusiness("");
          selectBranch("");
          return data;
        }

        selectBusiness(nextBusiness.id);

        const nextBranch =
          nextBusiness.branches?.find((branch) => branch.id === preferredBranchId) ||
          nextBusiness.branches?.find((branch) => branch.id === activeBranchId && branch.status === "ACTIVE") ||
          nextBusiness.branches?.find((branch) => branch.status === "ACTIVE") ||
          nextBusiness.branches?.[0] ||
          null;

        selectBranch(nextBranch?.id || "");
        return data;
      } catch (apiError) {
        setError(apiError.response?.data?.message || "Unable to load workspace.");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [activeBusinessId, activeBranchId, authLoading, isAuthenticated, selectBranch, selectBusiness]
  );

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!activeBusinessId) {
      selectBranch("");
      return;
    }

    const branchStillExists = branches.some((branch) => branch.id === activeBranchId && branch.status === "ACTIVE");

    if (!branchStillExists) {
      selectBranch(branches.find((branch) => branch.status === "ACTIVE")?.id || branches[0]?.id || "");
    }
  }, [activeBusinessId, activeBranchId, branches, selectBranch]);

  const value = useMemo(
    () => ({
      businesses,
      activeBusiness,
      activeBusinessId,
      activeBranch,
      activeBranchId,
      activeMembership,
      activeRoleName,
      branches,
      loading,
      error,
      refreshWorkspace,
      selectBusiness,
      selectBranch
    }),
    [
      businesses,
      activeBusiness,
      activeBusinessId,
      activeBranch,
      activeBranchId,
      activeMembership,
      activeRoleName,
      branches,
      loading,
      error,
      refreshWorkspace,
      selectBusiness,
      selectBranch
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  }

  return context;
}
