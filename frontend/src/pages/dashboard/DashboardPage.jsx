import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Hotel,
  ListChecks,
  MapPin,
  Package,
  PackageCheck,
  Pill,
  Printer,
  ReceiptText,
  ShoppingBasket,
  Smartphone,
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
import { getInventoryStock } from "../../services/inventoryService.js";
import { getProducts } from "../../services/productService.js";

const operationalRoles = ["Waiter", "Store Keeper", "Pharmacist", "Front Desk", "Technician"];

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeBranch, activeBusiness, activeRoleName } = useWorkspace();
  const [teamUsers, setTeamUsers] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tables, setTables] = useState([]);
  const [openBills, setOpenBills] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingWorkData, setLoadingWorkData] = useState(false);
  const [loadingOpenBills, setLoadingOpenBills] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);

  const activeModules = activeBusiness?.modules?.filter((module) => module.active) || [];
  const activeModuleKeys = activeModules.map((module) => module.key);
  const activeBranches = activeBusiness?.branches?.filter((branch) => branch.status === "ACTIVE") || [];
  const activeTeamUsers = teamUsers.filter((membership) => membership.user.status === "ACTIVE");
  const completedSales = useMemo(() => recentSales.filter((sale) => sale.status === "COMPLETED"), [recentSales]);
  const posIsActive = activeModuleKeys.includes("POS");
  const inventoryIsActive = activeModuleKeys.includes("INVENTORY");
  const posWorkflow = getPOSWorkflowInfo(activeBusiness);
  const isTableService = activeBusiness?.posMode === "TABLE_SERVICE";
  const cashierCanCloseBills = ["Owner", "Manager", "Cashier"].includes(activeRoleName);
  const POSWorkflowIcon = posWorkflow.icon;
  const isOperationalRole = operationalRoles.includes(activeRoleName);
  const dashboardSales = useMemo(() => getRoleScopedSales(completedSales, activeRoleName, user?.id), [activeRoleName, completedSales, user?.id]);
  const salesTotal = dashboardSales.reduce((total, sale) => total + Number(sale.total), 0);
  const activeProducts = products.filter((product) => product.status === "ACTIVE");
  const activeCustomers = customers.filter((customer) => customer.status === "ACTIVE");
  const lowStockItems = stockItems.filter((stock) => Number(stock.reorderLevel) > 0 && Number(stock.quantity) <= Number(stock.reorderLevel));
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

  const recentCompletedSales = useMemo(() => dashboardSales.slice(0, 5), [dashboardSales]);
  const roleDashboard = useMemo(
    () =>
      buildRoleDashboard({
        activeBranch,
        activeBusiness,
        activeCustomers,
        activeProducts,
        completedSales: dashboardSales,
        currency: activeBusiness?.currency,
        inventoryIsActive,
        loadingStock,
        loadingWorkData,
        lowStockItems,
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
      dashboardSales,
      activeBusiness?.currency,
      loadingWorkData,
      inventoryIsActive,
      loadingStock,
      lowStockItems,
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
    if (!activeBusiness?.id || !activeBranch?.id || user?.systemRole === "SYSTEM_ADMIN" || !inventoryIsActive) {
      setStockItems([]);
      return;
    }

    async function loadStockOverview() {
      try {
        setLoadingStock(true);
        const data = await getInventoryStock(activeBusiness.id, activeBranch.id);
        setStockItems(data.stockItems || []);
      } finally {
        setLoadingStock(false);
      }
    }

    loadStockOverview();
  }, [activeBranch?.id, activeBusiness?.id, inventoryIsActive, user?.systemRole]);

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
        completedSales={dashboardSales}
        posIsActive={posIsActive}
        inventoryIsActive={inventoryIsActive}
        loadingStock={loadingStock}
        lowStockItems={lowStockItems}
        quickActions={quickActions}
        currency={activeBusiness.currency}
      />
    );
  }

  const ownerMetrics = [
    {
      icon: MapPin,
      label: "Working branch",
      value: activeBranch?.name || "Not selected",
      helper: `${activeBranches.length} active branch${activeBranches.length === 1 ? "" : "es"}`
    },
    {
      icon: ReceiptText,
      label: "Today sales",
      value: loadingSales ? "Loading..." : formatMoney(salesTotal, activeBusiness.currency),
      helper: `${dashboardSales.length} completed transaction${dashboardSales.length === 1 ? "" : "s"}`
    },
    {
      icon: Users,
      label: "Team",
      value: loadingTeam ? "Loading..." : activeTeamUsers.length,
      helper: `${teamUsers.length} account${teamUsers.length === 1 ? "" : "s"} in this workspace`
    },
    inventoryIsActive
      ? {
          icon: AlertTriangle,
          label: "Stock alerts",
          value: loadingStock ? "Loading..." : lowStockItems.length,
          helper: lowStockItems.length ? "Items at reorder level" : "No urgent stock issue"
        }
      : {
          icon: Boxes,
          label: "Modules",
          value: activeModules.length,
          helper: activeModules.map((module) => module.key).join(", ") || "None enabled"
        }
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
        <div className="grid gap-4 border-b border-zera-line px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">{activeRoleName || "Business"} workspace</p>
            <h2 className="mt-1 text-xl font-bold">{activeBusiness.name}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">{dashboardDescription(activeRoleName, activeBranch?.name)}</p>
          </div>
          {posIsActive ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zera-green px-4 text-sm font-semibold text-white shadow-xs hover:bg-zera-greenDark"
              to="/pos"
            >
              Open POS
              <ArrowRight size={16} />
            </Link>
          ) : null}
        </div>

        <div className="grid divide-y divide-zera-line md:grid-cols-4 md:divide-x md:divide-y-0">
          {ownerMetrics.map((metric) => (
            <DashboardMetricCell key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      {posIsActive ? (
        <section className="grid gap-3 rounded-md border border-zera-line bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
              <POSWorkflowIcon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-zera-muted">Sales workflow</p>
              <h3 className="mt-1 text-lg font-bold">{posWorkflow.title}</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">{posWorkflow.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <span className="rounded-md bg-zera-mintSoft px-3 py-2 text-xs font-bold text-zera-green">{posWorkflow.primaryRule}</span>
            <span className="rounded-md bg-zera-mintSoft px-3 py-2 text-xs font-bold text-zera-muted">{activeBusiness.type || "Business type not set"}</span>
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

      {inventoryIsActive && lowStockItems.length ? (
        <InventoryAttentionPanel currency={activeBusiness.currency} loading={loadingStock} lowStockItems={lowStockItems} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-zera-line px-4 py-3">
            <div>
              <h3 className="font-bold">Today at a glance</h3>
              <p className="mt-1 text-xs text-zera-muted">Recent completed receipts for this workspace.</p>
            </div>
            {posIsActive ? (
              <Link className="text-sm font-semibold text-zera-green hover:underline" to="/sales">
                Sales list
              </Link>
            ) : null}
          </div>

          {loadingSales ? (
            <div className="p-5 text-sm text-zera-muted">Loading today’s activity...</div>
          ) : recentCompletedSales.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[680px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zera-line bg-zera-mintSoft text-xs uppercase text-zera-muted">
                    <th className="px-4 py-3 font-bold">Receipt</th>
                    <th className="px-4 py-3 font-bold">Customer</th>
                    <th className="px-4 py-3 font-bold">Branch</th>
                    <th className="px-4 py-3 font-bold">Time</th>
                    <th className="px-4 py-3 text-right font-bold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCompletedSales.map((sale) => (
                    <tr className="border-b border-zera-line last:border-0 hover:bg-zera-mintSoft/70" key={sale.id}>
                      <td className="px-4 py-3 font-bold text-zera-ink">{sale.receiptNumber}</td>
                      <td className="px-4 py-3 text-zera-muted">{sale.customer?.name || "Walk-in customer"}</td>
                      <td className="px-4 py-3 text-zera-muted">{sale.branch?.name || activeBranch?.name || "Branch"}</td>
                      <td className="px-4 py-3 text-zera-muted">{formatTime(sale.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatMoney(sale.total, activeBusiness.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center">
              <ReceiptText className="text-zera-green" size={26} />
              <p className="mt-3 text-sm font-bold">No completed sales today</p>
              <p className="mt-1 text-sm text-zera-muted">New transactions will appear here.</p>
            </div>
          )}
        </article>

        <article className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
          <div className="border-b border-zera-line px-4 py-3">
            <h3 className="font-bold">Action queue</h3>
            <p className="mt-1 text-xs text-zera-muted">Setup and operating checks that need attention.</p>
          </div>
          <div className="divide-y divide-zera-line">
            {isTableService && cashierCanCloseBills ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Open table bills</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">{loadingOpenBills ? "Checking..." : `${openBills.length} waiting for cashier`}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${openBills.length ? "bg-amber-50 text-amber-800" : "bg-zera-mintSoft text-zera-green"}`}>
                  {openBills.length ? "Settle" : "Clear"}
                </span>
              </div>
            ) : null}
            {inventoryIsActive ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Low stock</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">{loadingStock ? "Checking inventory..." : `${lowStockItems.length} item${lowStockItems.length === 1 ? "" : "s"} at reorder level`}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${lowStockItems.length ? "bg-amber-50 text-amber-800" : "bg-zera-mintSoft text-zera-green"}`}>
                  {lowStockItems.length ? "Review" : "Good"}
                </span>
              </div>
            ) : null}
            {setupItems.map((item) => (
              <div className="flex items-center justify-between gap-3 px-4 py-3" key={item.label}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">{item.value}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${item.ready ? "bg-zera-mintSoft text-zera-green" : "bg-amber-50 text-amber-800"}`}>
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
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                className="group flex min-h-16 items-center gap-3 rounded-md border border-zera-line bg-white p-3 shadow-xs transition hover:border-zera-green hover:bg-zera-mintSoft"
                key={action.path}
                to={action.path}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
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

function DashboardMetricCell({ helper, icon: Icon, label, value }) {
  return (
    <article className="bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-zera-muted">{label}</p>
          <p className="mt-1 truncate text-lg font-bold text-zera-ink">{value}</p>
          <p className="mt-0.5 truncate text-xs text-zera-muted">{helper}</p>
        </div>
      </div>
    </article>
  );
}

function RoleDashboard({
  activeBranch,
  activeBusiness,
  completedSales,
  currency,
  inventoryIsActive,
  loadingStock,
  lowStockItems,
  posIsActive,
  quickActions,
  roleDashboard,
  roleName,
  salesTotal
}) {
  const PrimaryIcon = roleDashboard.icon;

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader
        eyebrow={roleDashboard.eyebrow}
        title={roleDashboard.title}
        description={roleDashboard.description}
        action={
          posIsActive ? (
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-zera-green px-4 text-sm font-semibold text-white shadow-xs hover:bg-zera-greenDark"
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

      {inventoryIsActive && ["Store Keeper", "Pharmacist"].includes(roleName) && lowStockItems.length ? (
        <InventoryAttentionPanel currency={currency} loading={loadingStock} lowStockItems={lowStockItems} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-md border border-zera-line bg-white">
          <div className="flex items-center gap-3 border-b border-zera-line px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
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
                <div className="rounded-md border border-zera-line bg-zera-mintSoft p-3" key={step.title}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-zera-green">
                      <StepIcon size={18} />
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-zera-green">Step {index + 1}</span>
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

        <aside className="space-y-4">
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
            <div className="mt-4 rounded-md bg-zera-mintSoft px-3 py-3 text-sm text-zera-muted">
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
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                className="group flex min-h-16 items-center gap-3 rounded-md border border-zera-line bg-white p-3 shadow-xs transition hover:border-zera-green hover:bg-zera-mintSoft"
                key={action.path}
                to={action.path}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
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
    <section className="rounded-md border border-zera-line bg-white p-4 shadow-xs">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
            <ReceiptText size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-zera-green">Cashier handoff</p>
            <h3 className="mt-1 text-lg font-bold">Open table bills</h3>
            <p className="mt-1 text-sm leading-6 text-zera-muted">
              Customer bills sent by waiters appear here. Receive payment, close the table, and print the final receipt from one queue.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[auto_auto_auto] sm:items-center">
          <div className="rounded-md bg-zera-mintSoft px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-zera-muted">Waiting</p>
            <p className="text-lg font-bold">{loading ? "..." : openBills.length}</p>
          </div>
          <div className="rounded-md bg-zera-mintSoft px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-zera-muted">Amount due</p>
            <p className="text-lg font-bold">{loading ? "..." : formatMoney(totalDue, currency)}</p>
          </div>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-zera-green px-4 text-sm font-semibold text-white shadow-xs hover:bg-zera-greenDark" to="/open-bills">
            Settle bills
          </Link>
        </div>
      </div>

      {openBills.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {openBills.slice(0, 3).map((order) => (
            <Link className="rounded-md border border-zera-line bg-white px-3 py-3 shadow-xs transition hover:border-zera-green hover:bg-zera-mintSoft" key={order.id} to="/open-bills">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{order.table?.name || "Table bill"}</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">{order.orderNumber}</p>
                </div>
                <Table2 className="shrink-0 text-zera-green" size={18} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold">{formatMoney(order.total, currency)}</p>
                <span className={`rounded-md px-2 py-1 text-xs font-bold ${order.status === "BILL_PRINTED" ? "bg-zera-mintSoft text-zera-green" : "bg-amber-50 text-amber-700"}`}>
                  {order.status === "BILL_PRINTED" ? "Bill printed" : "Open order"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function InventoryAttentionPanel({ currency, loading, lowStockItems }) {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50/60 p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white text-amber-700">
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-amber-700">Inventory attention</p>
            <h3 className="mt-1 text-lg font-bold">Low-stock items need follow-up</h3>
            <p className="mt-1 text-sm leading-6 text-zera-muted">
              Review items that reached their low stock alert before the next busy sales period.
            </p>
          </div>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-zera-green px-4 text-sm font-semibold text-white shadow-xs hover:bg-zera-greenDark"
          to="/inventory?view=low"
        >
          Open inventory
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 rounded-md border border-dashed border-amber-200 bg-white/70 p-4 text-sm text-zera-muted">Loading stock attention...</div>
      ) : (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {lowStockItems.slice(0, 3).map((stock) => (
            <Link className="rounded-md border border-amber-200 bg-white px-3 py-3 hover:border-amber-500" key={stock.id} to="/inventory?view=low">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{stock.product?.name || "Product"}</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">
                    {Number(stock.quantity).toLocaleString()} left · alert {Number(stock.reorderLevel).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Low</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-zera-green">{formatMoney(stock.product?.price || 0, currency)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function RoleFocusList({ roleDashboard }) {
  if (roleDashboard.loading) {
    return <div className="rounded-md border border-dashed border-zera-line bg-zera-mintSoft p-5 text-sm text-zera-muted">Loading workspace items...</div>;
  }

  if (!roleDashboard.focusItems.length) {
    return <div className="rounded-md border border-dashed border-zera-line bg-zera-mintSoft p-5 text-sm text-zera-muted">{roleDashboard.emptyFocusText}</div>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {roleDashboard.focusItems.slice(0, 8).map((item) => (
        <div className="rounded-md border border-zera-line bg-zera-mintSoft px-3 py-3" key={item.id || item.title}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{item.title}</p>
              <p className="mt-1 truncate text-xs text-zera-muted">{item.subtitle}</p>
            </div>
            {item.badge ? <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold text-zera-green">{item.badge}</span> : null}
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
  inventoryIsActive,
  loadingStock,
  loadingWorkData,
  lowStockItems,
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
  const serviceProductItems = activeProducts
    .filter((product) => product.type !== "PHYSICAL")
    .map((product) => ({
      id: product.id,
      title: product.name,
      subtitle: product.category || "Service item",
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
  const stockAttentionItems = lowStockItems.map((stock) => ({
    id: stock.id,
    title: stock.product?.name || "Product",
    subtitle: `${Number(stock.quantity).toLocaleString()} left · alert ${Number(stock.reorderLevel).toLocaleString()}`,
    badge: "Low stock"
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
        { icon: Printer, title: "Print customer bill", description: "When the guest asks to pay, print the customer bill and hand it to cashier." }
      ],
      focusTitle: "Tables to serve",
      focusSubtitle: "Quick view of table setup for this branch.",
      focusAction: "Open POS",
      focusPath: "/pos",
      focusItems: tableItems,
      emptyFocusText: "No tables are set for this branch yet. Ask the owner or manager to add tables.",
      todayTitle: "Today’s table bills",
      todaySubtitle: "Recent completed bills for this branch.",
      guidance: "A waiter dashboard should stay light: table first, order second, customer bill handoff last. Cashier owns payment."
    };
  }

  if (roleName === "Store Keeper") {
    return {
      icon: PackageCheck,
      eyebrow: "Store keeper workspace",
      title: `${activeBusiness?.name || "Business"} catalog readiness`,
      description: "Keep products ready for checkout, receive deliveries, and follow up low-stock alerts before sales are affected.",
      primaryAction: inventoryIsActive ? "Open Inventory" : "Manage Products",
      primaryPath: inventoryIsActive ? "/inventory" : "/products",
      loading: loadingWorkData || loadingStock,
      stats: [
        { icon: Package, label: "Active products", value: loadingWorkData ? "Loading..." : activeProducts.length, helper: "Ready to sell" },
        inventoryIsActive
          ? { icon: AlertTriangle, label: "Low stock", value: loadingStock ? "Loading..." : lowStockItems.length, helper: lowStockItems.length ? "Needs receiving" : "Stock looks calm" }
          : { icon: ReceiptText, label: "Today's sales", value: formatMoney(salesTotal, currency), helper: `${completedSales.length} transactions` },
        { icon: Boxes, label: "Categories", value: productCategories.length, helper: productCategories.slice(0, 2).join(", ") || "Not grouped" },
        { icon: MapPin, label: "Branch", value: branchName, helper: businessType }
      ],
      workTitle: "Store keeper flow",
      workSubtitle: "Keep product data and stock quantities useful for the sales team.",
      steps: [
        { icon: AlertTriangle, title: "Check alerts", description: "Start with products where current stock reached the low stock alert." },
        { icon: PackageCheck, title: "Receive stock", description: "Add delivered quantity to current stock without overwriting the balance." },
        { icon: ListChecks, title: "Correct counts", description: "Use Set count only after a physical count or stock correction." }
      ],
      focusTitle: inventoryIsActive ? "Low-stock attention" : "Active products",
      focusSubtitle: inventoryIsActive ? "Products that need receiving or review." : "Products currently visible to POS.",
      focusAction: inventoryIsActive ? "Open inventory" : "Manage products",
      focusPath: inventoryIsActive ? "/inventory" : "/products",
      focusItems: inventoryIsActive ? stockAttentionItems : productItems,
      emptyFocusText: inventoryIsActive
        ? "No low-stock items right now. Keep receiving stock when deliveries arrive."
        : "No active products yet. Add products before the shop can sell confidently.",
      todayTitle: "Today’s product movement",
      todaySubtitle: "Sales activity that may affect stock follow-up.",
      guidance: "Use Receive stock for new deliveries. Use Set count only when you are correcting the actual shelf count."
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
        inventoryIsActive
          ? { icon: AlertTriangle, label: "Low stock", value: loadingStock ? "Loading..." : lowStockItems.length, helper: lowStockItems.length ? "Needs review" : "Stock looks calm" }
          : { icon: UserRound, label: "Customers", value: activeCustomers.length, helper: "Saved profiles" },
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

  if (roleName === "Technician") {
    return {
      icon: Smartphone,
      eyebrow: "Technician workspace",
      title: `${activeBusiness?.name || "Electronics shop"} service desk`,
      description: "Support device-service work with customer lookup, repair-service items, and clean handoff to cashier checkout.",
      primaryAction: "Open POS",
      primaryPath: "/pos",
      loading: loadingWorkData,
      stats: [
        { icon: UserRound, label: "Customers", value: activeCustomers.length, helper: "Saved contacts" },
        { icon: Package, label: "Service items", value: activeProducts.filter((product) => product.type !== "PHYSICAL").length, helper: "Repairs and charges" },
        { icon: ReceiptText, label: "Today's sales", value: formatMoney(salesTotal, currency), helper: `${completedSales.length} transactions` },
        { icon: MapPin, label: "Branch", value: branchName, helper: businessType }
      ],
      workTitle: "Service desk flow",
      workSubtitle: "Keep repair and service charges easy to sell.",
      steps: [
        { icon: UserRound, title: "Find customer", description: "Use customer records for repeat device service or walk-in for quick work." },
        { icon: Smartphone, title: "Select service", description: "Use service items such as diagnosis, screen replacement, or repair labor." },
        { icon: ReceiptText, title: "Send to cashier", description: "Cashier records payment and prints the customer receipt." }
      ],
      focusTitle: "Service catalog",
      focusSubtitle: "Services and charges available for electronics workflows.",
      focusAction: "Manage products",
      focusPath: "/products",
      focusItems: serviceProductItems,
      emptyFocusText: "No service items yet. Add repair services or charges in products.",
      todayTitle: "Today’s service sales",
      todaySubtitle: "Recent completed electronics transactions.",
      guidance: "A full repair ticket workflow comes later; for now, use service items to sell diagnosis, repair labor, and charges."
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

  if (roleName === "Technician") {
    return `Support device-service work, customer lookup, and repair-service sales at ${branchName || "the selected branch"}.`;
  }

  if (roleName === "Manager") {
    return `Monitor today’s branch activity, team access, and operational readiness at ${branchName || "the selected branch"}.`;
  }

  return "See today’s performance, operational readiness, and the actions that need your attention.";
}

function getRoleScopedSales(sales, roleName, userId) {
  if (!userId || ["Owner", "Manager"].includes(roleName)) {
    return sales;
  }

  if (roleName === "Waiter") {
    return sales.filter((sale) => sale.posOrder?.waiter?.id === userId);
  }

  if (["Cashier", "Pharmacist", "Front Desk", "Store Keeper", "Technician"].includes(roleName)) {
    return sales.filter((sale) => sale.cashier?.id === userId);
  }

  return sales;
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
  const type = business?.type?.toLowerCase() || "";

  if (business?.posMode === "TABLE_SERVICE") {
    return {
      icon: Table2,
      title: "Table-service POS",
      description: "Built for bars, restaurants, and table-based service. Waiters open table bills; cashiers receive payment, close the table, and issue the final receipt.",
      primaryRule: "Table required"
    };
  }

  if (type.includes("pharmacy")) {
    return {
      icon: Pill,
      title: "Pharmacy checkout POS",
      description: "Built for pharmacy counter sales. Staff search medicines and services, attach a patient or customer when needed, and record payment clearly.",
      primaryRule: "Patient optional"
    };
  }

  if (type.includes("hotel")) {
    return {
      icon: Hotel,
      title: "Front desk service POS",
      description: "Built for hotel front-desk charges. Staff record guest-facing services now, with room folios and reservations planned for later modules.",
      primaryRule: "Guest optional"
    };
  }

  if (type.includes("supermarket")) {
    return {
      icon: ShoppingBasket,
      title: "Supermarket checkout POS",
      description: "Built for basket checkout. Staff search or scan products, confirm quantities, and keep the payment flow fast for queue-heavy sales.",
      primaryRule: "Basket checkout"
    };
  }

  if (type.includes("electronic")) {
    return {
      icon: Smartphone,
      title: "Electronics shop POS",
      description: "Built for device and accessory sales. Staff search products by name, SKU, or barcode, track stock, issue receipts, and prepare repair-service items as services.",
      primaryRule: "Device checkout"
    };
  }

  if (type.includes("retail")) {
    return {
      icon: Store,
      title: "Retail shop checkout POS",
      description: "Built for shop-counter sales. Staff find products quickly, keep the cart simple, and record payment without table service steps.",
      primaryRule: "Counter checkout"
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

  if (roleName === "Store Keeper") {
    if (modules.includes("INVENTORY")) {
      actions.push({ label: "Inventory", helper: "Receive stock and review alerts", path: "/inventory", icon: Boxes });
    }

    actions.push({ label: "Products", helper: "Keep catalog clean", path: "/products", icon: Package });

    if (modules.includes("POS")) {
      actions.push({ label: "Sales history", helper: "Review stock-moving sales", path: "/sales", icon: Store });
    }

    return actions.slice(0, 4);
  }

  if (roleName === "Pharmacist") {
    if (modules.includes("POS")) {
      actions.push({ label: "New sale", helper: "Open pharmacy checkout", path: "/pos", icon: ReceiptText });
    }

    if (modules.includes("INVENTORY")) {
      actions.push({ label: "Inventory", helper: "Review medicine stock alerts", path: "/inventory", icon: Boxes });
    }

    actions.push(
      { label: "Products", helper: "Manage pharmacy catalog", path: "/products", icon: Package },
      { label: "Customers", helper: "Find or create a customer", path: "/customers", icon: UserRound }
    );

    return actions.slice(0, 4);
  }

  if (modules.includes("POS")) {
    if (business?.posMode === "TABLE_SERVICE" && ["Owner", "Manager", "Cashier"].includes(roleName)) {
      actions.push(
        { label: "Settle bills", helper: "Receive payments and close tables", path: "/open-bills", icon: ClipboardCheck },
        { label: "Staff reports", helper: "Waiter and cashier totals", path: "/reports", icon: BarChart3 }
      );
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

  if (["Owner", "Manager", "Store Keeper", "Pharmacist"].includes(roleName) && modules.includes("INVENTORY")) {
    actions.push({ label: "Inventory", helper: "Receive stock and review alerts", path: "/inventory", icon: Boxes });
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
