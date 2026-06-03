import { BarChart3, Boxes, Building2, ClipboardList, Home, LogOut, Menu, Package, ReceiptText, Settings, ShieldCheck, UserRound, Users, Wallet } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import Button from "../components/Button.jsx";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: Home, roles: ["Owner", "Manager", "Cashier"] },
  { label: "POS", path: "/pos", icon: ReceiptText, roles: ["Owner", "Manager", "Cashier"], module: "POS" },
  { label: "Sales", path: "/sales", icon: BarChart3, roles: ["Owner", "Manager", "Cashier"], module: "POS" },
  { label: "Products", path: "/products", icon: Package, roles: ["Owner", "Manager"], module: "POS" },
  { label: "Inventory", path: "/inventory", icon: Boxes, roles: ["Owner", "Manager"], module: "INVENTORY" },
  { label: "Finance", path: "/finance", icon: Wallet, roles: ["Owner"], module: "FINANCE" },
  { label: "Operations", path: "/operations", icon: ClipboardList, roles: ["Owner", "Manager"], module: "OPERATIONS" },
  { label: "Reports", path: "/reports", icon: BarChart3, roles: ["Owner", "Manager"], module: "POS" },
  { label: "Users", path: "/users", icon: Users, roles: ["Owner"] },
  { label: "Settings", path: "/settings", icon: Settings, roles: ["Owner"] }
];

const systemAdminNavItems = [
  { label: "Dashboard", path: "/dashboard", icon: Home },
  { label: "System Admin", path: "/system-admin", icon: ShieldCheck }
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { activeBranchId, activeBusiness, activeBusinessId, activeRoleName, branches, businesses, loading, selectBranch, selectBusiness } =
    useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeModuleKeys = activeBusiness?.modules?.filter((module) => module.active).map((module) => module.key) || [];
  const businessNavItems = navItems.filter((item) => {
    const roleAllowed = item.roles.includes(activeRoleName || "Cashier");
    const moduleAllowed = !item.module || activeModuleKeys.includes(item.module);
    return roleAllowed && moduleAllowed;
  });

  return (
    <div className="min-h-screen bg-[#f7faf8] text-zera-ink">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-zera-line bg-white px-4 py-5 transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-green text-white">
            <Building2 size={22} />
          </div>
          <div>
            <div className="text-lg font-bold">Zera</div>
            <div className="text-xs font-medium text-zera-muted">Solutions</div>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          {(user?.systemRole === "SYSTEM_ADMIN" ? systemAdminNavItems : businessNavItems).map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${
                    isActive ? "bg-zera-mint text-zera-green" : "text-zera-muted hover:bg-zera-mint hover:text-zera-ink"
                  }`
                }
              >
                <Icon size={19} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-md border border-zera-line bg-[#f7faf8] p-4">
          <div className="text-sm font-semibold">{user?.name}</div>
          <div className="mt-1 truncate text-xs text-zera-muted">{user?.email}</div>
          <Link
            className="mt-3 flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold text-zera-muted transition hover:bg-zera-mint hover:text-zera-ink"
            to="/account"
            onClick={() => setSidebarOpen(false)}
          >
            <UserRound size={17} />
            Account
          </Link>
          <Button variant="ghost" className="mt-1 w-full justify-start gap-2 px-2" onClick={logout}>
            <LogOut size={17} />
            Logout
          </Button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button className="fixed inset-0 z-20 bg-black/25 lg:hidden" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-zera-line bg-white/90 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-zera-line bg-white text-zera-ink lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu size={22} />
              </button>
              <div>
                <p className="text-sm text-zera-muted">Welcome back</p>
                <h1 className="text-xl font-bold sm:text-2xl">
                  {user?.systemRole === "SYSTEM_ADMIN" ? "Zera Platform" : "Zera Workspace"}
                </h1>
                {user?.systemRole !== "SYSTEM_ADMIN" && activeRoleName ? (
                  <p className="mt-1 text-sm font-semibold text-zera-green">{activeRoleName}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {user?.systemRole === "SYSTEM_ADMIN" ? null : businesses.length ? (
                <>
                  <label className="block">
                    <span className="sr-only">Active business</span>
                    <select
                      className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10 sm:w-56"
                      value={activeBusinessId}
                      onChange={(event) => selectBusiness(event.target.value)}
                    >
                      {businesses.map((business) => (
                        <option key={business.id} value={business.id}>
                          {business.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="sr-only">Active branch</span>
                    <select
                      className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10 sm:w-52"
                      value={activeBranchId}
                      onChange={(event) => selectBranch(event.target.value)}
                      disabled={!branches.length}
                    >
                      {branches.length ? (
                        branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                            {branch.status === "INACTIVE" ? " (Inactive)" : ""}
                          </option>
                        ))
                      ) : (
                        <option value="">No branch yet</option>
                      )}
                    </select>
                  </label>
                </>
              ) : loading ? (
                <div className="rounded-md border border-zera-line bg-white px-4 py-2 text-sm font-semibold text-zera-muted">Loading setup...</div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
