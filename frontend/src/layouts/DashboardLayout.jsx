import NotificationCenter from "../components/NotificationCenter.jsx";
import {
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X
} from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import WorkspaceSwitcher from "../components/WorkspaceSwitcher.jsx";
import { brandTheme } from "../utils/brandTheme.js";
import {
  businessNavigation,
  getVisibleNavigation,
  systemAdminNavigation
} from "../config/navigation.js";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const {
    activeBranchId,
    activeBusinessId,
    activeRoleName,
    branches,
    businesses,
    loading,
    selectBranch,
    selectBusiness
  } = useWorkspace();
  const location = useLocation();
  const topUserMenuRef = useRef(null);
  const sidebarUserMenuRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("zera_sidebar_collapsed") === "true");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const isSystemAdmin = user?.systemRole === "SYSTEM_ADMIN";
  const brandedBusiness = !isSystemAdmin ? businesses.find((business) => business.id === activeBusinessId) : null;
  const showBrand = Boolean(brandedBusiness?.useBrandTheme);

  const navigation = useMemo(() => {
    if (isSystemAdmin) {
      return systemAdminNavigation;
    }

    const activeBusiness = businesses.find((business) => business.id === activeBusinessId);
    const activeModuleKeys = activeBusiness?.modules?.filter((module) => module.active).map((module) => module.key) || [];
    return getBusinessNavigationForMode(getVisibleNavigation(businessNavigation, activeRoleName, activeModuleKeys), activeBusiness);
  }, [activeBusinessId, activeRoleName, businesses, isSystemAdmin]);

  useEffect(() => {
    localStorage.setItem("zera_sidebar_collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function closeUserMenu(event) {
      const insideTopMenu = topUserMenuRef.current?.contains(event.target);
      const insideSidebarMenu = sidebarUserMenuRef.current?.contains(event.target);

      if (!insideTopMenu && !insideSidebarMenu) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeUserMenu);
    return () => document.removeEventListener("mousedown", closeUserMenu);
  }, []);

  const desktopSidebarWidth = sidebarCollapsed ? "lg:w-[78px]" : "lg:w-64";
  const desktopContentOffset = sidebarCollapsed ? "lg:pl-[78px]" : "lg:pl-64";

  return (
    <div style={brandTheme(brandedBusiness)} className="min-h-screen bg-zera-canvas text-zera-ink">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zera-line bg-[#fbfdfc] shadow-[6px_0_24px_rgba(23,33,29,0.03)] transition-all duration-200 lg:translate-x-0 ${desktopSidebarWidth} ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-zera-line px-4">
          <Link className="flex min-w-0 items-center gap-3" to={isSystemAdmin ? "/system-admin" : "/dashboard"}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-green text-white shadow-xs">
              {showBrand && brandedBusiness.logoUrl ? <img src={brandedBusiness.logoUrl} alt="" className="h-10 w-10 rounded-md bg-white object-contain" /> : <Building2 size={19} />}
            </div>
            <div className={`min-w-0 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              <div className="truncate text-lg font-bold leading-5 tracking-tight">{showBrand ? brandedBusiness.name : "Zera"}</div>
              <div className="truncate text-xs font-medium text-zera-muted">{showBrand ? "Powered by Zera" : "Solutions"}</div>
            </div>
          </Link>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md text-zera-muted hover:bg-zera-surface hover:text-zera-ink lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {navigation.map((group) => (
            <div className="mb-5 last:mb-0" key={group.label}>
              <p className={`mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zera-muted/75 ${sidebarCollapsed ? "lg:sr-only" : ""}`}>
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavigationTargetActive(item.path, location, Boolean(item.children?.length));

                  return (
                    <div key={item.path}>
                      <Link
                        to={item.path}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`group flex h-10 items-center gap-3 rounded-md border px-3 text-sm font-semibold transition ${
                          isActive
                            ? "border-zera-line bg-white text-zera-green shadow-xs"
                            : "border-transparent text-zera-muted hover:border-zera-line hover:bg-white hover:text-zera-ink"
                        } ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""}`}
                      >
                        <Icon className="shrink-0" size={17} />
                        <span className={`truncate ${sidebarCollapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                      </Link>

                      {item.children?.length && !sidebarCollapsed ? (
                        <div className="mt-1 space-y-1 border-l border-zera-line/80 pl-4 lg:block">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            const childActive = isNavigationTargetActive(child.path, location);

                            return (
                              <Link
                                key={child.path}
                                to={child.path}
                                className={`group flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-semibold transition ${
                                  childActive
                                    ? "bg-zera-mint text-zera-green"
                                    : "text-zera-muted hover:bg-white hover:text-zera-ink"
                                }`}
                              >
                                <ChildIcon className="shrink-0" size={15} />
                                <span className="truncate">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {!isSystemAdmin && activeBusinessId && activeBranchId && (brandedBusiness?.features?.stockNotifications || brandedBusiness?.features?.cashNotifications) && <NotificationCenter key={`${user?.id}:${activeBusinessId}:${activeBranchId}:${activeRoleName}`} userId={user?.id} businessId={activeBusinessId} branchId={activeBranchId} collapsed={sidebarCollapsed} />}

        <div className="shrink-0 border-t border-zera-line p-3">
          <div className="relative" ref={sidebarUserMenuRef}>
            {userMenuOpen ? (
              <div className={`absolute bottom-full z-50 mb-2 w-56 rounded-md border border-zera-line bg-white p-2 shadow-panel ${sidebarCollapsed ? "left-0" : "left-0"}`}>
                <div className="border-b border-zera-line px-2 py-2">
                  <p className="truncate text-sm font-bold">{user?.name}</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">{user?.email}</p>
                </div>
                <Link className="mt-1 flex h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold hover:bg-zera-surface" to="/account">
                  <UserRound size={16} />
                  My account
                </Link>
                <button
                  className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  onClick={logout}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-md border border-zera-line bg-white p-2 text-left shadow-xs transition hover:bg-zera-surface ${sidebarCollapsed ? "lg:justify-center" : ""}`}
              onClick={() => setUserMenuOpen((current) => !current)}
              aria-expanded={userMenuOpen}
              aria-label="Open account menu"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                <UserRound size={18} />
              </div>
              <div className={`min-w-0 flex-1 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                <p className="truncate text-sm font-bold">{user?.name}</p>
                <p className="truncate text-xs text-zera-muted">{isSystemAdmin ? "System admin" : activeRoleName || "Business user"}</p>
              </div>
              <ChevronDown className={`shrink-0 text-zera-muted transition ${userMenuOpen ? "rotate-180" : ""} ${sidebarCollapsed ? "lg:hidden" : ""}`} size={14} />
            </button>
          </div>
          <button
            className="mt-2 hidden h-9 w-full items-center justify-center rounded-md text-zera-muted hover:bg-zera-surface hover:text-zera-ink lg:flex"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button className="fixed inset-0 z-30 bg-black/25 lg:hidden" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <div className={`min-w-0 transition-[padding] duration-200 ${desktopContentOffset}`}>
        <header className="sticky top-0 z-20 border-b border-zera-line bg-white/95 shadow-[0_1px_0_rgba(23,33,29,0.02)] backdrop-blur lg:hidden">
          <div className="flex min-h-[56px] items-center gap-3 px-4 sm:px-5">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zera-line bg-white text-zera-ink shadow-xs lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0 flex-1" />

            {!isSystemAdmin ? (
            <div className="relative" ref={topUserMenuRef}>
              <button
                className="flex h-10 items-center gap-2 rounded-md border border-zera-line bg-white px-2 text-left shadow-xs hover:bg-zera-surface"
                onClick={() => setUserMenuOpen((current) => !current)}
                aria-expanded={userMenuOpen}
                aria-label="Open account menu"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <UserRound size={15} />
                </div>
                <span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{user?.name}</span>
                <ChevronDown className="hidden text-zera-muted sm:block" size={14} />
              </button>

              {userMenuOpen ? (
                <div className="absolute right-0 top-12 w-56 rounded-md border border-zera-line bg-white p-2 shadow-panel">
                  <div className="border-b border-zera-line px-2 py-2">
                    <p className="truncate text-sm font-bold">{user?.name}</p>
                    <p className="mt-1 truncate text-xs text-zera-muted">{user?.email}</p>
                  </div>
                  <Link className="mt-1 flex h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold hover:bg-zera-surface" to="/account">
                    <UserRound size={16} />
                    Account
                  </Link>
                  <button
                    className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    onClick={logout}
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
            ) : null}
          </div>

          {!isSystemAdmin ? (
            <div className="border-t border-zera-line px-4 py-2 lg:hidden">
              <WorkspaceSwitcher
                activeBranchId={activeBranchId}
                activeBusinessId={activeBusinessId}
                branches={branches}
                businesses={businesses}
                loading={loading}
                onBranchChange={selectBranch}
                onBusinessChange={selectBusiness}
                roleName={activeRoleName}
              />
            </div>
          ) : null}
        </header>

        <main className="px-4 py-4 sm:px-5 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getBusinessNavigationForMode(groups, business) {
  const posMode = business?.posMode;

  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.tableServiceOnly || posMode === "TABLE_SERVICE")
        .map((item) => {
      if (item.path !== "/pos") {
        return item;
      }

      return {
        ...item,
        label: getPOSNavigationLabel(business)
      };
        })
    }))
    .filter((group) => group.items.length);
}

function isNavigationTargetActive(targetPath, location, includeChildren = false) {
  const [pathname, search = ""] = targetPath.split("?");

  if (pathname !== location.pathname) {
    return false;
  }

  if (includeChildren) {
    return true;
  }

  if (!search) {
    return !location.search;
  }

  return location.search === `?${search}`;
}

function getPOSNavigationLabel(business) {
  const type = business?.type?.toLowerCase() || "";

  if (business?.posMode === "TABLE_SERVICE") {
    return "Table POS";
  }

  if (type.includes("pharmacy")) {
    return "Pharmacy POS";
  }

  if (type.includes("hotel")) {
    return "Front Desk POS";
  }

  if (type.includes("supermarket")) {
    return "Supermarket POS";
  }

  if (type.includes("electronic")) {
    return "Electronics POS";
  }

  if (type.includes("retail")) {
    return "Retail POS";
  }

  return "Checkout POS";
}
