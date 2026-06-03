import { useEffect, useState } from "react";
import { Boxes, Building2, ClipboardList, MapPin, ReceiptText, ShieldCheck, Store, Users, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getSystemBusinesses } from "../../services/systemAdminService.js";
import { getBusinessUsers } from "../../services/teamService.js";
import { getRecentSales } from "../../services/posService.js";

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeBranch, activeBusiness, activeRoleName } = useWorkspace();
  const [systemBusinesses, setSystemBusinesses] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [loadingSystem, setLoadingSystem] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);

  const isSystemAdmin = user?.systemRole === "SYSTEM_ADMIN";
  const activeModules = activeBusiness?.modules?.filter((module) => module.active) || [];
  const activeBranches = activeBusiness?.branches?.filter((branch) => branch.status === "ACTIVE") || [];
  const activeTeamUsers = teamUsers.filter((membership) => membership.user.status === "ACTIVE");
  const completedSales = recentSales.filter((sale) => sale.status === "COMPLETED");
  const salesTotal = completedSales.reduce((total, sale) => total + Number(sale.total), 0);
  const posIsActive = activeModules.some((module) => module.key === "POS");
  const roleContent = getRoleContent(activeRoleName, {
    activeBranch,
    activeBusiness,
    activeModules,
    activeTeamUsers,
    posIsActive
  });
  const RoleIcon = roleContent.icon;

  useEffect(() => {
    if (!isSystemAdmin) {
      return;
    }

    async function loadSystemOverview() {
      try {
        setLoadingSystem(true);
        const data = await getSystemBusinesses();
        setSystemBusinesses(data);
      } finally {
        setLoadingSystem(false);
      }
    }

    loadSystemOverview();
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!activeBusiness?.id || isSystemAdmin) {
      setTeamUsers([]);
      return;
    }

    async function loadTeamOverview() {
      try {
        setLoadingTeam(true);
        const data = await getBusinessUsers(activeBusiness.id);
        setTeamUsers(data);
      } finally {
        setLoadingTeam(false);
      }
    }

    loadTeamOverview();
  }, [activeBusiness?.id, isSystemAdmin]);

  useEffect(() => {
    if (!activeBusiness?.id || isSystemAdmin || !posIsActive) {
      setRecentSales([]);
      return;
    }

    async function loadSalesOverview() {
      try {
        setLoadingSales(true);
        const today = new Date().toISOString().slice(0, 10);
        const data = await getRecentSales(activeBusiness.id, { dateFrom: today, dateTo: today });
        setRecentSales(data);
      } finally {
        setLoadingSales(false);
      }
    }

    loadSalesOverview();
  }, [activeBusiness?.id, isSystemAdmin, posIsActive]);

  if (isSystemAdmin) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-zera-green">Zera platform admin</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Business provisioning dashboard</h2>
              <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
                Create customer businesses, assign their owner login, and keep the platform setup clean before modules become deeper.
              </p>
            </div>
            <div className="flex min-h-14 min-w-14 items-center justify-center rounded-lg bg-zera-mint text-zera-green">
              <Building2 size={30} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard icon={Building2} label="Businesses" value={loadingSystem ? "..." : systemBusinesses.length} />
          <MetricCard
            icon={MapPin}
            label="Branches"
            value={loadingSystem ? "..." : systemBusinesses.reduce((total, business) => total + (business.branches?.length || 0), 0)}
          />
          <MetricCard
            icon={Users}
            label="Business users"
            value={loadingSystem ? "..." : systemBusinesses.reduce((total, business) => total + (business.memberships?.length || 0), 0)}
          />
        </section>

        <section className="rounded-lg border border-zera-line bg-white p-5">
          <h3 className="text-lg font-bold">Provisioning status</h3>
          <p className="mt-2 text-sm leading-6 text-zera-muted">
            Business creation and owner-login assignment are handled in System Admin. This dashboard only summarizes platform setup.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">{roleContent.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{roleContent.title}</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
              {activeBusiness ? roleContent.description : "A system admin must create your business account before POS, users, and operations can be prepared."}
            </p>
          </div>
          <div className="flex min-h-24 min-w-24 items-center justify-center rounded-lg bg-zera-mint text-zera-green">
            <RoleIcon size={42} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={MapPin} label="Active branches" value={`${activeBranches.length}/${activeBusiness?.branches?.length || 0}`} compact />
        <MetricCard icon={Boxes} label="Active modules" value={activeModules.length} />
        <MetricCard icon={Users} label="Active users" value={loadingTeam ? "..." : `${activeTeamUsers.length}/${teamUsers.length}`} compact />
        <MetricCard icon={ReceiptText} label="Today's sales" value={loadingSales ? "..." : formatMoney(salesTotal, activeBusiness?.currency)} compact />
      </section>

      {!activeBusiness ? (
        <section className="rounded-lg border border-zera-line bg-white p-5">
          <h3 className="text-lg font-bold">No business assigned</h3>
          <p className="mt-2 text-sm leading-6 text-zera-muted">
            Ask the Zera system admin to create your business and owner login first.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <StatusPanel
              title="Business profile"
              lines={[
                activeBusiness.type || "Business type not set",
                activeBusiness.country || "Country not set",
                activeBusiness.currency || "Currency not set"
              ]}
            />
            <StatusPanel
              title="Active branch"
              lines={[
                activeBranch ? activeBranch.name : "No branch selected",
                activeBranch?.location || "Branch location not set",
                activeBranch?.status ? `${activeBranch.status.toLowerCase()} branch` : "Branch status not set"
              ]}
            />
            <StatusPanel
              title="Enabled modules"
              lines={activeModules.length ? activeModules.map((module) => module.key) : ["No modules active"]}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-lg border border-zera-line bg-white p-5">
              <h3 className="text-lg font-bold">{roleContent.panelTitle}</h3>
              <div className="mt-4 space-y-3">
                {roleContent.readiness.map((item) => (
                  <ReadinessItem key={item.label} {...item} />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-zera-line bg-white p-5">
              <h3 className="text-lg font-bold">Today at a glance</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {roleContent.today.map((item) => (
                  <TodayItem key={item.label} {...item} />
                ))}
              </div>
            </section>
          </section>
        </>
      )}
    </div>
  );
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function getRoleContent(roleName, { activeBranch, activeBusiness, activeModules, activeTeamUsers, posIsActive }) {
  const enabledModuleText = activeModules.length ? activeModules.map((module) => module.key).join(", ") : "No active modules";
  const hasActiveBranch = activeBranch?.status === "ACTIVE";
  const teamCount = activeTeamUsers.length;

  if (roleName === "Manager") {
    return {
      eyebrow: "Manager workspace",
      title: activeBusiness ? `${activeBusiness.name} operations` : "Manager dashboard",
      description: "Track branch readiness, active modules, and team access for daily operations.",
      icon: ClipboardList,
      panelTitle: "Manager readiness",
      readiness: [
        { label: "Branch selected", value: activeBranch?.name || "No branch selected", ready: Boolean(activeBranch) },
        { label: "Branch active", value: hasActiveBranch ? "Ready" : "Needs owner attention", ready: hasActiveBranch },
        { label: "Operations visibility", value: enabledModuleText, ready: activeModules.length > 0 }
      ],
      today: [
        { icon: MapPin, label: "Working branch", value: activeBranch?.name || "Not selected" },
        { icon: Boxes, label: "Visible modules", value: activeModules.length },
        { icon: Users, label: "Active users", value: teamCount },
        { icon: ShieldCheck, label: "Access level", value: "Manager" }
      ]
    };
  }

  if (roleName === "Cashier") {
    return {
      eyebrow: "Cashier workspace",
      title: activeBranch ? `${activeBranch.name} counter` : "Cashier dashboard",
      description: "Keep the selling workspace simple: confirm your branch and POS access before sales screens are built.",
      icon: ReceiptText,
      panelTitle: "Cashier readiness",
      readiness: [
        { label: "Branch selected", value: activeBranch?.name || "No branch selected", ready: Boolean(activeBranch) },
        { label: "Branch active", value: hasActiveBranch ? "Ready" : "Ask manager or owner", ready: hasActiveBranch },
        { label: "POS access", value: posIsActive ? "Enabled" : "Not enabled", ready: posIsActive }
      ],
      today: [
        { icon: ReceiptText, label: "POS module", value: posIsActive ? "Enabled" : "Paused" },
        { icon: MapPin, label: "Counter branch", value: activeBranch?.name || "Not selected" },
        { icon: ShieldCheck, label: "Access level", value: "Cashier" },
        { icon: Store, label: "Workspace", value: activeBusiness?.name || "Not assigned" }
      ]
    };
  }

  return {
    eyebrow: "Owner workspace",
    title: activeBusiness ? `${activeBusiness.name} control center` : "Owner dashboard",
    description: "Manage business setup, branches, team accounts, and active modules from one calm workspace.",
    icon: Store,
    panelTitle: "Owner setup health",
    readiness: [
      { label: "Business profile", value: activeBusiness?.type || "Add type in Settings", ready: Boolean(activeBusiness?.type) },
      { label: "Active branch", value: activeBranch?.name || "Create or activate a branch", ready: hasActiveBranch },
      { label: "Team access", value: `${teamCount} active user${teamCount === 1 ? "" : "s"}`, ready: teamCount > 0 },
      { label: "POS foundation", value: posIsActive ? "Enabled" : "Enable POS in Settings", ready: posIsActive }
    ],
    today: [
      { icon: MapPin, label: "Active branch", value: activeBranch?.name || "Not selected" },
      { icon: Boxes, label: "Active modules", value: activeModules.length },
      { icon: Users, label: "Active users", value: teamCount },
      { icon: Wallet, label: "Currency", value: activeBusiness?.currency || "Not set" }
    ]
  };
}

function MetricCard({ icon: Icon, label, value, compact = false }) {
  return (
    <article className="rounded-lg border border-zera-line bg-white p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium text-zera-muted">{label}</p>
      <p className={`mt-2 font-bold text-zera-ink ${compact ? "text-xl" : "text-3xl"}`}>{value}</p>
    </article>
  );
}

function StatusPanel({ title, lines }) {
  return (
    <section className="rounded-lg border border-zera-line bg-white p-5">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <div key={line} className="rounded-md bg-[#f7faf8] px-3 py-2 text-sm font-semibold text-zera-muted">
            {line}
          </div>
        ))}
      </div>
    </section>
  );
}

function ReadinessItem({ label, ready, value }) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-[#f7faf8] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-zera-ink">{label}</p>
        <p className="mt-1 text-sm text-zera-muted">{value}</p>
      </div>
      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${ready ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"}`}>
        {ready ? "Ready" : "Needs setup"}
      </span>
    </div>
  );
}

function TodayItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-[#f7faf8] p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-white text-zera-green">
        <Icon size={20} />
      </div>
      <p className="text-sm font-medium text-zera-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-zera-ink">{value}</p>
    </div>
  );
}
