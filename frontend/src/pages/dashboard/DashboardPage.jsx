import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Boxes, MapPin, Package, ReceiptText, Settings, Store, UserRound, Users } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import StatCard from "../../components/StatCard.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getBusinessUsers } from "../../services/teamService.js";
import { getRecentSales } from "../../services/posService.js";

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeBranch, activeBusiness, activeRoleName } = useWorkspace();
  const [teamUsers, setTeamUsers] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);

  const activeModules = activeBusiness?.modules?.filter((module) => module.active) || [];
  const activeModuleKeys = activeModules.map((module) => module.key);
  const activeBranches = activeBusiness?.branches?.filter((branch) => branch.status === "ACTIVE") || [];
  const activeTeamUsers = teamUsers.filter((membership) => membership.user.status === "ACTIVE");
  const completedSales = recentSales.filter((sale) => sale.status === "COMPLETED");
  const salesTotal = completedSales.reduce((total, sale) => total + Number(sale.total), 0);
  const posIsActive = activeModuleKeys.includes("POS");
  const setupItems = buildSetupItems({
    activeBranch,
    activeBusiness,
    activeRoleName,
    activeTeamUsers,
    posIsActive
  });
  const quickActions = buildQuickActions(activeRoleName, activeModuleKeys);

  const recentCompletedSales = useMemo(() => completedSales.slice(0, 5), [completedSales]);

  useEffect(() => {
    if (!activeBusiness?.id || user?.systemRole === "SYSTEM_ADMIN") {
      setTeamUsers([]);
      return;
    }

    async function loadTeamOverview() {
      try {
        setLoadingTeam(true);
        setTeamUsers(await getBusinessUsers(activeBusiness.id));
      } finally {
        setLoadingTeam(false);
      }
    }

    loadTeamOverview();
  }, [activeBusiness?.id, user?.systemRole]);

  useEffect(() => {
    if (!activeBusiness?.id || user?.systemRole === "SYSTEM_ADMIN" || !posIsActive) {
      setRecentSales([]);
      return;
    }

    async function loadSalesOverview() {
      try {
        setLoadingSales(true);
        const today = new Date().toISOString().slice(0, 10);
        setRecentSales(await getRecentSales(activeBusiness.id, { dateFrom: today, dateTo: today }));
      } finally {
        setLoadingSales(false);
      }
    }

    loadSalesOverview();
  }, [activeBusiness?.id, posIsActive, user?.systemRole]);

  if (user?.systemRole === "SYSTEM_ADMIN") {
    return <Navigate to="/system-admin" replace />;
  }

  if (!activeBusiness) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Workspace"
          title="No business assigned"
          description="A Zera system administrator must create your business account before this workspace can be used."
        />
        <div className="mt-5 rounded-md border border-dashed border-zera-line bg-white p-6 text-sm text-zera-muted">
          Contact your Zera system administrator to finish account provisioning.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        eyebrow={`${activeRoleName || "Business"} workspace`}
        title={`${activeBusiness.name} dashboard`}
        description={dashboardDescription(activeRoleName, activeBranch?.name)}
        action={
          posIsActive ? (
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-zera-green px-4 text-sm font-semibold text-white hover:bg-green-700"
              to="/pos"
            >
              Open POS
              <ArrowRight size={16} />
            </Link>
          ) : null
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={MapPin} label="Working branch" value={activeBranch?.name || "Not selected"} helper={`${activeBranches.length} active`} />
        <StatCard
          icon={ReceiptText}
          label="Today's sales"
          value={loadingSales ? "Loading..." : formatMoney(salesTotal, activeBusiness.currency)}
          helper={`${completedSales.length} transaction${completedSales.length === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={Users}
          label="Active team"
          value={loadingTeam ? "Loading..." : activeTeamUsers.length}
          helper={`${teamUsers.length} total account${teamUsers.length === 1 ? "" : "s"}`}
        />
        <StatCard icon={Boxes} label="Enabled modules" value={activeModules.length} helper={activeModules.map((module) => module.key).join(", ") || "None"} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-md border border-zera-line bg-white">
          <div className="flex items-center justify-between border-b border-zera-line px-4 py-3">
            <div>
              <h3 className="font-bold">Today’s activity</h3>
              <p className="mt-1 text-xs text-zera-muted">Latest completed sales for the selected business.</p>
            </div>
            {posIsActive ? (
              <Link className="text-sm font-semibold text-zera-green hover:underline" to="/sales">
                View sales
              </Link>
            ) : null}
          </div>

          {loadingSales ? (
            <div className="p-5 text-sm text-zera-muted">Loading today’s activity...</div>
          ) : recentCompletedSales.length ? (
            <div className="divide-y divide-zera-line">
              {recentCompletedSales.map((sale) => (
                <div className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-5" key={sale.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{sale.receiptNumber}</p>
                    <p className="mt-1 truncate text-xs text-zera-muted">
                      {sale.customer?.name || "Walk-in customer"} · {sale.branch?.name || activeBranch?.name || "Branch"}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-zera-muted">{formatTime(sale.createdAt)}</p>
                  <p className="text-sm font-bold">{formatMoney(sale.total, activeBusiness.currency)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center">
              <ReceiptText className="text-zera-green" size={26} />
              <p className="mt-3 text-sm font-bold">No completed sales today</p>
              <p className="mt-1 text-sm text-zera-muted">New transactions will appear here.</p>
            </div>
          )}
        </article>

        <article className="rounded-md border border-zera-line bg-white">
          <div className="border-b border-zera-line px-4 py-3">
            <h3 className="font-bold">Workspace readiness</h3>
            <p className="mt-1 text-xs text-zera-muted">Only items that affect daily work.</p>
          </div>
          <div className="divide-y divide-zera-line">
            {setupItems.map((item) => (
              <div className="flex items-center justify-between gap-3 px-4 py-3" key={item.label}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">{item.value}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${item.ready ? "bg-zera-mint text-zera-green" : "bg-amber-50 text-amber-800"}`}>
                  {item.ready ? "Ready" : "Action"}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Quick actions</h3>
          <p className="text-xs text-zera-muted">{activeRoleName} access</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                className="group flex min-h-20 items-center gap-3 rounded-md border border-zera-line bg-white p-4 hover:border-zera-green"
                key={action.path}
                to={action.path}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-surface text-zera-green group-hover:bg-zera-mint">
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{action.label}</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">{action.helper}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function dashboardDescription(roleName, branchName) {
  if (roleName === "Cashier") {
    return `Start selling, review receipts, and serve customers at ${branchName || "the selected branch"}.`;
  }

  if (roleName === "Manager") {
    return `Monitor today’s branch activity, team access, and operational readiness at ${branchName || "the selected branch"}.`;
  }

  return "See today’s performance, operational readiness, and the actions that need your attention.";
}

function buildSetupItems({ activeBranch, activeBusiness, activeRoleName, activeTeamUsers, posIsActive }) {
  const items = [
    { label: "Branch status", value: activeBranch?.name || "Select an active branch", ready: activeBranch?.status === "ACTIVE" },
    { label: "POS access", value: posIsActive ? "Selling workspace enabled" : "Enable POS through system admin", ready: posIsActive }
  ];

  if (activeRoleName !== "Cashier") {
    items.push({
      label: "Team access",
      value: `${activeTeamUsers.length} active user${activeTeamUsers.length === 1 ? "" : "s"}`,
      ready: activeTeamUsers.length > 0
    });
  }

  if (activeRoleName === "Owner") {
    items.push({
      label: "Business type",
      value: activeBusiness?.type || "Ask system admin to configure it",
      ready: Boolean(activeBusiness?.type)
    });
  }

  return items;
}

function buildQuickActions(roleName, modules) {
  const actions = [];

  if (modules.includes("POS")) {
    actions.push(
      { label: "New sale", helper: "Open the selling workspace", path: "/pos", icon: ReceiptText },
      { label: "Sales history", helper: "Review receipts and payments", path: "/sales", icon: Store },
      { label: "Customers", helper: "Find or create a customer", path: "/customers", icon: UserRound }
    );
  }

  if (["Owner", "Manager"].includes(roleName) && modules.includes("POS")) {
    actions.push({ label: "Products", helper: "Manage the sales catalog", path: "/products", icon: Package });
  }

  if (roleName === "Owner") {
    actions.push({ label: "Business settings", helper: "Branches and team setup", path: "/settings", icon: Settings });
  }

  return actions.slice(0, 4);
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
