import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  ClipboardCheck,
  ListChecks,
  MapPin,
  Package,
  PackageCheck,
  ReceiptText,
  Settings,
  Store,
  Table2,
  UserRound,
  Users
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import StatCard from "../../components/StatCard.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getBusinessUsers } from "../../services/teamService.js";
import { getActivePOSOrders, getPOSTables, getRecentSales } from "../../services/posService.js";
import { getCustomers } from "../../services/customerService.js";
import { getProducts } from "../../services/productService.js";

const operationalRoles = ["Waiter", "Store Keeper", "Pharmacist", "Front Desk"];

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeBranch, activeBusiness, activeRoleName } = useWorkspace();
  const [teamUsers, setTeamUsers] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tables, setTables] = useState([]);
  const [openBills, setOpenBills] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingWorkData, setLoadingWorkData] = useState(false);
  const [loadingOpenBills, setLoadingOpenBills] = useState(false);

  const activeModules = activeBusiness?.modules?.filter((module) => module.active) || [];
  const activeModuleKeys = activeModules.map((module) => module.key);
  const activeBranches = activeBusiness?.branches?.filter((branch) => branch.status === "ACTIVE") || [];
  const activeTeamUsers = teamUsers.filter((membership) => membership.user.status === "ACTIVE");
  const completedSales = recentSales.filter((sale) => sale.status === "COMPLETED");
  const salesTotal = completedSales.reduce((total, sale) => total + Number(sale.total), 0);
  const posIsActive = activeModuleKeys.includes("POS");
  const posWorkflow = getPOSWorkflowInfo(activeBusiness);
  const isTableService = activeBusiness?.posMode === "TABLE_SERVICE";
  const cashierCanCloseBills = ["Owner", "Manager", "Cashier"].includes(activeRoleName);
  const POSWorkflowIcon = posWorkflow.icon;
  const isOperationalRole = operationalRoles.includes(activeRoleName);
  const activeProducts = products.filter((product) => product.status === "ACTIVE");
  const activeCustomers = customers.filter((customer) => customer.status === "ACTIVE");
  const productCategories = [...new Set(activeProducts.map((product) => product.category).filter(Boolean))].sort((first, second) =>
    first.localeCompare(second)
  );
  const setupItems = buildSetupItems({
    activeBranch,
    activeBusiness,
    activeRoleName,
    activeTeamUsers,
    posIsActive
  });
  const quickActions = buildQuickActions(activeRoleName, activeModuleKeys, activeBusiness);

  const recentCompletedSales = useMemo(() => completedSales.slice(0, 5), [completedSales]);
  const roleDashboard = useMemo(
    () =>
      buildRoleDashboard({
        activeBranch,
        activeBusiness,
        activeCustomers,
        activeProducts,
        completedSales,
        currency: activeBusiness?.currency,
        loadingWorkData,
        productCategories,
        recentCompletedSales,
        roleName: activeRoleName,
        tables
      }),
    [
      activeBranch,
      activeBusiness,
      activeCustomers,
      activeProducts,
      activeRoleName,
      completedSales,
      activeBusiness?.currency,
      loadingWorkData,
      productCategories,
      recentCompletedSales,
      tables
    ]
  );

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

  useEffect(() => {
    if (!activeBusiness?.id || user?.systemRole === "SYSTEM_ADMIN") {
      setProducts([]);
      setCustomers([]);
      setTables([]);
      return;
    }

    async function loadOperationalData() {
      try {
        setLoadingWorkData(true);
        const [productData, customerData, tableData] = await Promise.all([
          getProducts(activeBusiness.id, { status: "ACTIVE" }),
          getCustomers(activeBusiness.id, { status: "ACTIVE" }),
          activeBranch?.id && activeBusiness?.posMode === "TABLE_SERVICE"
            ? getPOSTables(activeBusiness.id, activeBranch.id)
            : Promise.resolve([])
        ]);
        setProducts(productData);
        setCustomers(customerData);
        setTables(tableData);
      } finally {
        setLoadingWorkData(false);
      }
    }

    loadOperationalData();
  }, [activeBranch?.id, activeBusiness?.id, activeBusiness?.posMode, user?.systemRole]);

  useEffect(() => {
    if (!activeBusiness?.id || !activeBranch?.id || user?.systemRole === "SYSTEM_ADMIN" || !posIsActive || !isTableService || !cashierCanCloseBills) {
      setOpenBills([]);
      return;
    }

    async function loadOpenBillsOverview() {
      try {
        setLoadingOpenBills(true);
        setOpenBills(await getActivePOSOrders(activeBusiness.id, activeBranch.id));
      } finally {
        setLoadingOpenBills(false);
      }
    }

    loadOpenBillsOverview();
  }, [activeBranch?.id, activeBusiness?.id, cashierCanCloseBills, isTableService, posIsActive, user?.systemRole]);

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

  if (isOperationalRole) {
    return (
      <RoleDashboard
        activeBusiness={activeBusiness}
        activeBranch={activeBranch}
        roleName={activeRoleName}
        roleDashboard={roleDashboard}
        salesTotal={salesTotal}
        completedSales={completedSales}
        posIsActive={posIsActive}
        quickActions={quickActions}
        currency={activeBusiness.currency}
      />
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

      {posIsActive ? (
        <section className="grid gap-3 rounded-md border border-zera-line bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
              <POSWorkflowIcon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-zera-muted">Sales workflow</p>
              <h3 className="mt-1 text-lg font-bold">{posWorkflow.title}</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">{posWorkflow.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <span className="rounded-md bg-zera-mint px-3 py-2 text-xs font-bold text-zera-green">{posWorkflow.primaryRule}</span>
            <span className="rounded-md bg-[#f7faf8] px-3 py-2 text-xs font-bold text-zera-muted">{activeBusiness.type || "Business type not set"}</span>
          </div>
        </section>
      ) : null}

      {isTableService && cashierCanCloseBills ? (
        <CashierOpenBillsPanel
          currency={activeBusiness.currency}
          loading={loadingOpenBills}
          openBills={openBills}
        />
      ) : null}

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

function RoleDashboard({ activeBranch, activeBusiness, completedSales, currency, posIsActive, quickActions, roleDashboard, roleName, salesTotal }) {
  const PrimaryIcon = roleDashboard.icon;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        eyebrow={roleDashboard.eyebrow}
        title={roleDashboard.title}
        description={roleDashboard.description}
        action={
          posIsActive ? (
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-zera-green px-4 text-sm font-semibold text-white hover:bg-green-700"
              to={roleDashboard.primaryPath}
            >
              {roleDashboard.primaryAction}
              <ArrowRight size={16} />
            </Link>
          ) : null
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {roleDashboard.stats.map((stat) => (
          <StatCard icon={stat.icon} key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-md border border-zera-line bg-white">
          <div className="flex items-center gap-3 border-b border-zera-line px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
              <PrimaryIcon size={20} />
            </div>
            <div>
              <h3 className="font-bold">{roleDashboard.workTitle}</h3>
              <p className="mt-1 text-xs text-zera-muted">{roleDashboard.workSubtitle}</p>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-3">
            {roleDashboard.steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div className="rounded-md border border-zera-line bg-[#f7faf8] p-4" key={step.title}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-zera-green">
                      <StepIcon size={18} />
                    </div>
                    <span className="rounded-md bg-zera-mint px-2 py-1 text-xs font-bold text-zera-green">Step {index + 1}</span>
                  </div>
                  <h4 className="text-sm font-bold">{step.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-zera-muted">{step.description}</p>
                </div>
              );
            })}
          </div>

          <div className="border-t border-zera-line p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold">{roleDashboard.focusTitle}</h4>
                <p className="mt-1 text-xs text-zera-muted">{roleDashboard.focusSubtitle}</p>
              </div>
              <Link className="text-sm font-semibold text-zera-green hover:underline" to={roleDashboard.focusPath}>
                {roleDashboard.focusAction}
              </Link>
            </div>
            <RoleFocusList roleDashboard={roleDashboard} />
          </div>
        </article>

        <aside className="space-y-5">
          <article className="rounded-md border border-zera-line bg-white">
            <div className="border-b border-zera-line px-4 py-3">
              <h3 className="font-bold">{roleDashboard.todayTitle}</h3>
              <p className="mt-1 text-xs text-zera-muted">{roleDashboard.todaySubtitle}</p>
            </div>

            {completedSales.length ? (
              <div className="divide-y divide-zera-line">
                {completedSales.slice(0, 4).map((sale) => (
                  <div className="px-4 py-3" key={sale.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold">{sale.receiptNumber}</p>
                      <p className="shrink-0 text-sm font-bold">{formatMoney(sale.total, currency)}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-zera-muted">
                      {sale.table?.name ? `${sale.table.name} · ` : ""}
                      {sale.customer?.name || "Walk-in"} · {sale.branch?.name || activeBranch?.name || "Branch"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-36 flex-col items-center justify-center px-5 text-center">
                <ReceiptText className="text-zera-green" size={24} />
                <p className="mt-3 text-sm font-bold">No sales yet today</p>
                <p className="mt-1 text-sm text-zera-muted">Recorded transactions will show here.</p>
              </div>
            )}
          </article>

          <article className="rounded-md border border-zera-line bg-white p-4">
            <p className="text-xs font-bold uppercase text-zera-green">{roleName} summary</p>
            <h3 className="mt-2 text-xl font-bold">{formatMoney(salesTotal, currency)}</h3>
            <p className="mt-1 text-sm text-zera-muted">
              {completedSales.length} completed transaction{completedSales.length === 1 ? "" : "s"} today at {activeBranch?.name || "the selected branch"}.
            </p>
            <div className="mt-4 rounded-md bg-[#f7faf8] px-3 py-3 text-sm text-zera-muted">
              {roleDashboard.guidance}
            </div>
          </article>
        </aside>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Quick actions</h3>
          <p className="text-xs text-zera-muted">{activeBusiness.type || "Business"} · {roleName}</p>
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

function CashierOpenBillsPanel({ currency, loading, openBills }) {
  const totalDue = openBills.reduce((total, order) => total + Number(order.total), 0);

  return (
    <section className="rounded-md border border-zera-line bg-white p-4 shadow-soft">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
            <ReceiptText size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-zera-green">Cashier handoff</p>
            <h3 className="mt-1 text-lg font-bold">Open table bills</h3>
            <p className="mt-1 text-sm leading-6 text-zera-muted">
              Bills printed or sent by waiters appear here. Receive payment to close the table and issue the final receipt.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[auto_auto_auto] sm:items-center">
          <div className="rounded-md bg-[#f7faf8] px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-zera-muted">Waiting</p>
            <p className="text-lg font-bold">{loading ? "..." : openBills.length}</p>
          </div>
          <div className="rounded-md bg-[#f7faf8] px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-zera-muted">Amount due</p>
            <p className="text-lg font-bold">{loading ? "..." : formatMoney(totalDue, currency)}</p>
          </div>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-zera-green px-4 text-sm font-semibold text-white hover:bg-green-700" to="/open-bills">
            Open bills
          </Link>
        </div>
      </div>

      {openBills.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {openBills.slice(0, 3).map((order) => (
            <Link className="rounded-md border border-zera-line bg-[#f7faf8] px-3 py-3 hover:border-zera-green" key={order.id} to="/open-bills">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{order.table?.name || "Table bill"}</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">{order.orderNumber}</p>
                </div>
                <Table2 className="shrink-0 text-zera-green" size={18} />
              </div>
              <p className="mt-3 text-sm font-bold">{formatMoney(order.total, currency)}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RoleFocusList({ roleDashboard }) {
  if (roleDashboard.loading) {
    return <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-5 text-sm text-zera-muted">Loading workspace items...</div>;
  }

  if (!roleDashboard.focusItems.length) {
    return <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-5 text-sm text-zera-muted">{roleDashboard.emptyFocusText}</div>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {roleDashboard.focusItems.slice(0, 8).map((item) => (
        <div className="rounded-md border border-zera-line bg-[#f7faf8] px-3 py-3" key={item.id || item.title}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{item.title}</p>
              <p className="mt-1 truncate text-xs text-zera-muted">{item.subtitle}</p>
            </div>
            {item.badge ? <span className="shrink-0 rounded-md bg-zera-mint px-2 py-1 text-xs font-bold text-zera-green">{item.badge}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildRoleDashboard({
  activeBranch,
  activeBusiness,
  activeCustomers,
  activeProducts,
  completedSales,
  currency = "UGX",
  loadingWorkData,
  productCategories,
  recentCompletedSales,
  roleName,
  tables
}) {
  const salesTotal = completedSales.reduce((total, sale) => total + Number(sale.total), 0);
  const businessType = activeBusiness?.type || "Business";
  const branchName = activeBranch?.name || "Selected branch";
  const productItems = activeProducts.map((product) => ({
    id: product.id,
    title: product.name,
    subtitle: [product.category, product.unit, product.sku || product.barcode].filter(Boolean).join(" · ") || "Catalog item",
    badge: formatMoney(product.price, currency)
  }));
  const customerItems = activeCustomers.map((customer) => ({
    id: customer.id,
    title: customer.name,
    subtitle: customer.phone || customer.email || "Saved customer",
    badge: customer.status === "ACTIVE" ? "Active" : customer.status
  }));
  const tableItems = tables.map((table) => ({
    id: table.id,
    title: table.name,
    subtitle: `${table.seats} seats · ${formatTableStatus(table.status)}`,
    badge: formatTableStatus(table.status)
  }));
  const recentSaleItems = recentCompletedSales.map((sale) => ({
    id: sale.id,
    title: sale.receiptNumber,
    subtitle: `${sale.customer?.name || "Walk-in"} · ${sale.branch?.name || branchName}`,
    badge: formatMoney(sale.total, currency)
  }));

  if (roleName === "Waiter") {
    return {
      icon: Table2,
      eyebrow: "Waiter workspace",
      title: `${branchName} table service`,
      description: "Focus on tables, orders, and clean handoff to payment. Start from the table, then build the bill.",
      primaryAction: "Open Table POS",
      primaryPath: "/pos",
      loading: loadingWorkData,
      stats: [
        { icon: Table2, label: "Tables", value: loadingWorkData ? "Loading..." : tables.length, helper: "Available for service" },
        { icon: ReceiptText, label: "Today's bills", value: completedSales.length, helper: formatMoney(salesTotal, currency) },
        { icon: MapPin, label: "Branch", value: branchName, helper: "Table service" },
        { icon: UserRound, label: "Customers", value: activeCustomers.length, helper: "Optional on bills" }
      ],
      workTitle: "Service flow",
      workSubtitle: "The shortest path for serving a table.",
      steps: [
        { icon: Table2, title: "Choose table", description: "Select the customer’s table before adding menu items." },
        { icon: ReceiptText, title: "Build bill", description: "Tap products into the cart and confirm quantities clearly." },
        { icon: ClipboardCheck, title: "Record payment", description: "Close the bill with cash, card, or mobile money." }
      ],
      focusTitle: "Tables to serve",
      focusSubtitle: "Quick view of table setup for this branch.",
      focusAction: "Open POS",
      focusPath: "/pos",
      focusItems: tableItems,
      emptyFocusText: "No tables are set for this branch yet. Ask the owner or manager to add tables.",
      todayTitle: "Today’s table bills",
      todaySubtitle: "Recent completed bills for this branch.",
      guidance: "A waiter dashboard should stay light: table first, order second, payment last."
    };
  }

  if (roleName === "Store Keeper") {
    return {
      icon: PackageCheck,
      eyebrow: "Store keeper workspace",
      title: `${activeBusiness?.name || "Business"} catalog readiness`,
      description: "Keep the selling catalog clean so cashiers can find products fast and sell without confusion.",
      primaryAction: "Manage Products",
      primaryPath: "/products",
      loading: loadingWorkData,
      stats: [
        { icon: Package, label: "Active products", value: loadingWorkData ? "Loading..." : activeProducts.length, helper: "Ready to sell" },
        { icon: Boxes, label: "Categories", value: productCategories.length, helper: productCategories.slice(0, 2).join(", ") || "Not grouped" },
        { icon: ReceiptText, label: "Today's sales", value: formatMoney(salesTotal, currency), helper: `${completedSales.length} transactions` },
        { icon: MapPin, label: "Branch", value: branchName, helper: businessType }
      ],
      workTitle: "Store keeper flow",
      workSubtitle: "Keep product data useful for the sales team.",
      steps: [
        { icon: Package, title: "Check catalog", description: "Make sure products have clear names, categories, units, and prices." },
        { icon: ListChecks, title: "Prepare checkout", description: "Keep fast-moving items easy for cashiers to find." },
        { icon: ReceiptText, title: "Watch sales", description: "Use sales history to notice products that need attention." }
      ],
      focusTitle: "Active products",
      focusSubtitle: "Products currently visible to POS.",
      focusAction: "Manage products",
      focusPath: "/products",
      focusItems: productItems,
      emptyFocusText: "No active products yet. Add products before the shop can sell confidently.",
      todayTitle: "Today’s product movement",
      todaySubtitle: "Sales activity that may affect stock follow-up.",
      guidance: "Stock quantity tracking is coming later; for now, product clarity is the store keeper’s biggest lever."
    };
  }

  if (roleName === "Pharmacist") {
    return {
      icon: Package,
      eyebrow: "Pharmacist workspace",
      title: `${activeBusiness?.name || "Pharmacy"} counter`,
      description: "Serve pharmacy customers with a clear product catalog, customer lookup, and simple checkout flow.",
      primaryAction: "Open Pharmacy POS",
      primaryPath: "/pos",
      loading: loadingWorkData,
      stats: [
        { icon: Package, label: "Active items", value: loadingWorkData ? "Loading..." : activeProducts.length, helper: "Medicines and services" },
        { icon: UserRound, label: "Customers", value: activeCustomers.length, helper: "Saved profiles" },
        { icon: ReceiptText, label: "Today's sales", value: formatMoney(salesTotal, currency), helper: `${completedSales.length} transactions` },
        { icon: MapPin, label: "Branch", value: branchName, helper: "Pharmacy counter" }
      ],
      workTitle: "Pharmacy counter flow",
      workSubtitle: "Fast enough for sales, careful enough for pharmacy work.",
      steps: [
        { icon: UserRound, title: "Confirm customer", description: "Use walk-in for quick sales or attach a customer when history matters." },
        { icon: Package, title: "Select medicine", description: "Search products by name, category, SKU, or barcode." },
        { icon: ReceiptText, title: "Record sale", description: "Confirm quantities and payment method before saving the receipt." }
      ],
      focusTitle: "Pharmacy catalog",
      focusSubtitle: "Active products available for checkout.",
      focusAction: "Manage products",
      focusPath: "/products",
      focusItems: productItems,
      emptyFocusText: "No pharmacy products are active yet. Add medicines or services before selling.",
      todayTitle: "Today’s pharmacy sales",
      todaySubtitle: "Recent completed pharmacy counter transactions.",
      guidance: "Prescription and batch/expiry controls are not built yet; this foundation keeps the counter flow simple."
    };
  }

  return {
    icon: Store,
    eyebrow: "Front desk workspace",
    title: `${branchName} front desk`,
    description: "Handle guest-facing service sales, customer lookup, and simple receipts from one calm workspace.",
    primaryAction: "Open Service POS",
    primaryPath: "/pos",
    loading: loadingWorkData,
    stats: [
      { icon: UserRound, label: "Guests/customers", value: activeCustomers.length, helper: "Saved profiles" },
      { icon: ReceiptText, label: "Today's sales", value: formatMoney(salesTotal, currency), helper: `${completedSales.length} transactions` },
      { icon: Package, label: "Services/items", value: loadingWorkData ? "Loading..." : activeProducts.length, helper: "Available to bill" },
      { icon: MapPin, label: "Branch", value: branchName, helper: businessType }
    ],
    workTitle: "Front desk flow",
    workSubtitle: "Simple guest-facing sales until the hotel module is built.",
    steps: [
      { icon: UserRound, title: "Find guest", description: "Use customer records for repeat guests or walk-in for quick service sales." },
      { icon: Store, title: "Choose service", description: "Select the service or item being charged." },
      { icon: ReceiptText, title: "Issue receipt", description: "Record payment and keep the transaction visible in sales history." }
    ],
    focusTitle: "Guests and customers",
    focusSubtitle: "Saved profiles available to front desk.",
    focusAction: "Manage customers",
    focusPath: "/customers",
    focusItems: customerItems.length ? customerItems : recentSaleItems,
    emptyFocusText: "No customers or recent service sales yet. Add customers as front desk work begins.",
    todayTitle: "Today’s front desk sales",
    todaySubtitle: "Recent completed service transactions.",
    guidance: "Reservations, rooms, and night audit will come in the hotel module; this keeps front desk useful today."
  };
}

function dashboardDescription(roleName, branchName) {
  if (roleName === "Cashier") {
    return `Start selling, review receipts, and serve customers at ${branchName || "the selected branch"}.`;
  }

  if (roleName === "Waiter") {
    return `Open table bills, add orders, and keep service moving at ${branchName || "the selected branch"}.`;
  }

  if (roleName === "Store Keeper") {
    return `Maintain the product catalog, support stock-facing work, and help checkout stay ready at ${branchName || "the selected branch"}.`;
  }

  if (roleName === "Pharmacist") {
    return `Serve pharmacy customers, keep products clear, and record sales at ${branchName || "the selected branch"}.`;
  }

  if (roleName === "Front Desk") {
    return `Serve guest-facing workflows and record service sales at ${branchName || "the selected branch"}.`;
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

  if (["Owner", "Manager"].includes(activeRoleName)) {
    items.push({
      label: "Team access",
      value: `${activeTeamUsers.length} active user${activeTeamUsers.length === 1 ? "" : "s"}`,
      ready: activeTeamUsers.length > 0
    });
  }

  if (activeRoleName === "Owner") {
    items.push({
      label: "Business type",
      value: activeBusiness?.type ? `${activeBusiness.type} · ${formatPOSMode(activeBusiness.posMode)}` : "Ask system admin to configure it",
      ready: Boolean(activeBusiness?.type)
    });
  }

  return items;
}

function getPOSWorkflowInfo(business) {
  if (business?.posMode === "TABLE_SERVICE") {
    return {
      icon: Table2,
      title: "Table-service POS",
      description: "Built for bars, restaurants, and table-based service. Staff select a table first, then build the bill and record payment.",
      primaryRule: "Table required"
    };
  }

  return {
    icon: Store,
    title: "Retail checkout POS",
    description: "Built for retail shops, supermarkets, pharmacies, and quick counter sales. Staff add products directly to the cart and checkout.",
    primaryRule: "No table required"
  };
}

function formatPOSMode(posMode = "RETAIL_CHECKOUT") {
  return posMode === "TABLE_SERVICE" ? "Table-service POS" : "Retail checkout POS";
}

function formatTableStatus(status = "AVAILABLE") {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildQuickActions(roleName, modules, business) {
  const actions = [];

  if (modules.includes("POS")) {
    if (business?.posMode === "TABLE_SERVICE" && ["Owner", "Manager", "Cashier"].includes(roleName)) {
      actions.push({ label: "Open bills", helper: "Receive table payments", path: "/open-bills", icon: ClipboardCheck });
    }

    actions.push(
      { label: "New sale", helper: "Open the selling workspace", path: "/pos", icon: ReceiptText },
      { label: "Sales history", helper: "Review receipts and payments", path: "/sales", icon: Store },
      { label: "Customers", helper: "Find or create a customer", path: "/customers", icon: UserRound }
    );
  }

  if (["Owner", "Manager", "Store Keeper", "Pharmacist"].includes(roleName) && modules.includes("POS")) {
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
