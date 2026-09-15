import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Boxes, Building2, CheckCircle2, ClipboardList, Package, ReceiptText, RefreshCcw, Search, Table2 } from "lucide-react";
import Button from "../../components/Button.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getOperationsSummary } from "../../services/operationsService.js";

export default function OperationsPage() {
  const { activeBranch, activeBranchId, activeBusiness, activeBusinessId, branches } = useWorkspace();
  const [operationsData, setOperationsData] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeModuleKeys = operationsData?.activeModuleKeys || getActiveModuleKeys(activeBusiness);
  const inventoryEnabled = activeModuleKeys.includes("INVENTORY");
  const posEnabled = activeModuleKeys.includes("POS");
  const tableService = activeBusiness?.posMode === "TABLE_SERVICE";

  useEffect(() => {
    if (!activeBusinessId) {
      setOperationsData(null);
      return;
    }

    loadOperations();
  }, [activeBranchId, activeBusiness?.posMode, activeBusinessId]);

  async function loadOperations() {
    try {
      setLoading(true);
      setError("");
      const data = await getOperationsSummary(activeBusinessId, activeBranchId ? { branchId: activeBranchId } : {});
      setOperationsData(data);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load operations.");
    } finally {
      setLoading(false);
    }
  }

  const activeBranches = operationsData?.metrics?.activeBranches ?? branches.filter((branch) => branch.status === "ACTIVE").length;
  const totalBranches = operationsData?.metrics?.totalBranches ?? branches.length;
  const activeProducts = operationsData?.metrics?.activeProducts ?? 0;
  const missingCodeProducts = operationsData?.products?.missingCodeProducts || [];
  const lowStockItems = operationsData?.inventory?.lowStockItems || [];
  const openOrders = operationsData?.service?.openOrders || [];
  const openOrdersTotal = operationsData?.service?.openOrdersTotal || 0;
  const occupiedTables = operationsData?.metrics?.occupiedTables ?? 0;
  const tableRows = operationsData?.service?.tableRows || [];
  const counterRows = buildCounterRows(missingCodeProducts, lowStockItems);
  const visibleCounterRows = filterCounterRows(counterRows, query);
  const visibleTableRows = filterTableRows(tableRows, query);
  const checks = buildOperationalChecks({
    activeBranches,
    activeProducts,
    inventoryEnabled,
    lowStockItems,
    missingCodeProducts,
    posEnabled,
    tableRows,
    tableService
  });

  if (!activeBusiness) {
    return (
      <section className="rounded-md border border-zera-line bg-white p-5 shadow-xs">
        <h2 className="text-xl font-bold">Operations</h2>
        <p className="mt-2 text-sm text-zera-muted">Select a business before reviewing daily operations.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3">
      <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
        <div className="grid gap-3 border-b border-zera-line px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Operations</p>
              <span className="h-1 w-1 rounded-full bg-zera-line" />
              <p className="text-xs font-semibold text-zera-muted">{formatPOSMode(activeBusiness.posMode)}</p>
            </div>
            <h2 className="mt-0.5 text-xl font-bold text-zera-ink">Daily control</h2>
            <p className="mt-0.5 max-w-3xl text-sm text-zera-muted">
              Monitor the configured workspace, branch readiness, selling flow, stock issues, and open service work.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/pos"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zera-green px-3 text-sm font-semibold text-white shadow-xs transition hover:bg-zera-greenDark"
            >
              <ReceiptText size={16} />
              Open POS
            </Link>
            <Button type="button" variant="secondary" className="h-9 gap-2 px-3" disabled={loading} onClick={loadOperations}>
              <RefreshCcw size={16} />
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <section className="grid divide-y divide-zera-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <Metric icon={Building2} label="Active branches" loading={loading} value={`${activeBranches}/${totalBranches || 0}`} />
          <Metric icon={Package} label="Products ready" loading={loading} value={`${activeProducts}`} />
          <Metric icon={Boxes} label="Stock alerts" loading={loading} value={inventoryEnabled ? lowStockItems.length : "Off"} />
          <Metric icon={tableService ? Table2 : ReceiptText} label={tableService ? "Open tables" : "Selling mode"} loading={loading} value={tableService ? occupiedTables : "Counter"} />
        </section>
      </section>

      {error ? <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div> : null}

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="space-y-3">
          <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
            <div className="flex flex-col gap-3 border-b border-zera-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-zera-green">{tableService ? "Service floor" : "Counter workflow"}</p>
                <h3 className="mt-0.5 text-base font-bold">{tableService ? "Tables and open bills" : "Products needing attention"}</h3>
                <p className="mt-0.5 text-sm text-zera-muted">
                  {tableService ? "Use this to see what is occupied, ready to pay, or still open." : "Use this to clean up products before selling and stock movement."}
                </p>
              </div>
              <label className="flex h-9 w-full items-center gap-2 rounded-md border border-zera-line bg-white px-2.5 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10 lg:w-[320px]">
                <Search size={16} className="shrink-0 text-zera-muted" />
                <input className="w-full border-0 bg-transparent text-sm outline-none" placeholder={tableService ? "Search table, bill, waiter" : "Search product, SKU, category"} value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
            </div>

            {tableService ? (
              <TableServiceRegister activeBusiness={activeBusiness} loading={loading} rows={visibleTableRows} />
            ) : (
              <CounterIssueRegister activeBusiness={activeBusiness} inventoryEnabled={inventoryEnabled} loading={loading} rows={visibleCounterRows} />
            )}
          </section>

          <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
            <PanelHeader eyebrow="Quick work" title="Daily actions" description="Keep the most-used actions close without adding duplicate navigation." />
            <div className="grid divide-y divide-zera-line md:grid-cols-4 md:divide-x md:divide-y-0">
              <QuickAction icon={ReceiptText} label="Sell" helper="Product entry and receipt" to="/pos" />
              <QuickAction icon={Package} label="Products" helper="Catalog and prices" to="/products" />
              <QuickAction icon={Boxes} label="Inventory" helper={inventoryEnabled ? "Receive and adjust stock" : "Module not active"} to={inventoryEnabled ? "/inventory" : ""} />
              <QuickAction icon={ClipboardList} label="Receipts" helper="Review sales history" to="/sales" />
            </div>
          </section>
        </main>

        <aside className="space-y-3">
          <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
            <PanelHeader eyebrow="Readiness" title="Operating checklist" description={activeBranch ? `${activeBranch.name} branch status` : "Select a branch to complete checks."} />
            <div className="divide-y divide-zera-line">
              {checks.map((check) => (
                <div className="flex items-start gap-3 px-4 py-3" key={check.label}>
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${check.ready ? "bg-zera-mintSoft text-zera-green" : "bg-amber-50 text-amber-700"}`}>
                    {check.ready ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold">{check.label}</p>
                    <p className="mt-0.5 text-sm leading-5 text-zera-muted">{check.helper}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
            <PanelHeader eyebrow="Workspace" title="Configured modules" description="Active features for this business." />
            <div className="grid grid-cols-2 gap-2 p-4">
              {["POS", "INVENTORY", "FINANCE", "OPERATIONS", "REPORTS"].map((moduleKey) => {
                const active = activeModuleKeys.includes(moduleKey);
                return (
                  <span className={`rounded-md border px-3 py-2 text-sm font-bold ${active ? "border-zera-line bg-zera-mintSoft text-zera-green" : "border-zera-line bg-white text-zera-muted"}`} key={moduleKey}>
                    {moduleKey.toLowerCase()}
                  </span>
                );
              })}
            </div>
          </section>

          {tableService ? (
            <section className="rounded-md border border-zera-line bg-white p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zera-green">Open bills</p>
              <p className="mt-1 text-2xl font-extrabold">{formatMoney(openOrdersTotal, activeBusiness.currency)}</p>
              <p className="mt-1 text-sm text-zera-muted">{openOrders.length} bill{openOrders.length === 1 ? "" : "s"} waiting in table service.</p>
              <Link className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-zera-line px-3 text-sm font-bold text-zera-ink hover:bg-zera-mintSoft" to="/open-bills">
                Settle bills
              </Link>
            </section>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

function TableServiceRegister({ activeBusiness, loading, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[940px] w-full border-collapse text-left text-sm">
        <thead className="border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
          <tr>
            <th className="px-4 py-2.5">Table</th>
            <th className="px-4 py-2.5">State</th>
            <th className="px-4 py-2.5">Bill</th>
            <th className="px-4 py-2.5">Waiter</th>
            <th className="px-4 py-2.5">Updated</th>
            <th className="px-4 py-2.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="px-4 py-8 text-zera-muted" colSpan={6}>
                Loading service floor...
              </td>
            </tr>
          ) : null}
          {!loading && rows.length ? (
            rows.map((row) => (
              <tr className="border-b border-zera-line last:border-0 hover:bg-zera-mintSoft" key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-bold text-zera-ink">{row.name}</p>
                  <p className="mt-0.5 text-xs text-zera-muted">{row.seats} seat{row.seats === 1 ? "" : "s"}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={row.order ? (row.order.status === "BILL_PRINTED" ? "ready" : "busy") : "open"} label={row.order ? (row.order.status === "BILL_PRINTED" ? "Ready to pay" : "Occupied") : "Available"} />
                </td>
                <td className="px-4 py-3 font-semibold text-zera-muted">{row.order?.orderNumber || "No bill"}</td>
                <td className="px-4 py-3 text-zera-muted">{row.order?.waiter?.name || "Not assigned"}</td>
                <td className="px-4 py-3 text-zera-muted">{row.order ? formatDate(row.order.updatedAt || row.order.createdAt) : "-"}</td>
                <td className="px-4 py-3 text-right text-base font-extrabold text-zera-ink">{row.order ? formatMoney(row.order.total, activeBusiness.currency) : "-"}</td>
              </tr>
            ))
          ) : null}
          {!loading && !rows.length ? (
            <tr>
              <td className="px-4 py-8 text-zera-muted" colSpan={6}>
                No tables found for this branch.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function CounterIssueRegister({ inventoryEnabled, loading, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[840px] w-full border-collapse text-left text-sm">
        <thead className="border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
          <tr>
            <th className="px-4 py-2.5">Product</th>
            <th className="px-4 py-2.5">Category</th>
            <th className="px-4 py-2.5">Issue</th>
            <th className="px-4 py-2.5">Stock</th>
            <th className="px-4 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="px-4 py-8 text-zera-muted" colSpan={5}>
                Loading operations...
              </td>
            </tr>
          ) : null}
          {!loading && rows.length ? (
            rows.map((row) => (
              <tr className="border-b border-zera-line last:border-0 hover:bg-zera-mintSoft" key={row.key}>
                <td className="px-4 py-3">
                  <p className="font-bold text-zera-ink">{row.product.name}</p>
                  <p className="mt-0.5 text-xs text-zera-muted">{row.product.sku || row.product.barcode || "No code"}</p>
                </td>
                <td className="px-4 py-3 text-zera-muted">{row.product.category || "Uncategorized"}</td>
                <td className="px-4 py-3">
                  <p className="font-bold text-amber-800">{row.issue}</p>
                  <p className="mt-0.5 text-xs text-zera-muted">{row.helper}</p>
                </td>
                <td className="px-4 py-3 font-semibold text-zera-muted">{typeof row.quantity === "number" ? row.quantity : inventoryEnabled ? "Tracked" : "Not tracked"}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="inline-flex h-8 items-center justify-center rounded-md border border-zera-line px-3 text-xs font-bold text-zera-ink hover:bg-white" to={row.issue === "Low stock" ? "/inventory?view=low" : "/products"}>
                    Fix
                  </Link>
                </td>
              </tr>
            ))
          ) : null}
          {!loading && !rows.length ? (
            <tr>
              <td className="px-4 py-8 text-zera-muted" colSpan={5}>
                No product or stock issues found for this branch.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ icon: Icon, label, loading, value }) {
  return (
    <div className="flex min-w-0 items-center gap-3 bg-white px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-zera-muted">{label}</p>
        <p className="mt-0.5 truncate text-lg font-extrabold text-zera-ink">{loading ? "..." : value}</p>
      </div>
    </div>
  );
}

function PanelHeader({ description, eyebrow, title }) {
  return (
    <div className="border-b border-zera-line px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zera-green">{eyebrow}</p>
      <h3 className="mt-0.5 text-base font-bold text-zera-ink">{title}</h3>
      <p className="mt-0.5 text-sm text-zera-muted">{description}</p>
    </div>
  );
}

function QuickAction({ helper, icon: Icon, label, to }) {
  const content = (
    <div className={`flex min-h-[92px] items-start gap-3 px-4 py-3 transition ${to ? "hover:bg-zera-mintSoft" : "opacity-60"}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-zera-ink">{label}</span>
        <span className="mt-1 block text-sm leading-5 text-zera-muted">{helper}</span>
      </span>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
}

function StatusBadge({ label, tone }) {
  const classes = {
    busy: "bg-amber-50 text-amber-800",
    open: "bg-zera-mintSoft text-zera-green",
    ready: "bg-blue-50 text-zera-blue"
  };

  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${classes[tone] || classes.open}`}>{label}</span>;
}

function buildOperationalChecks({ activeBranches, activeProducts, inventoryEnabled, lowStockItems, missingCodeProducts, posEnabled, tableRows, tableService }) {
  const checks = [
    {
      label: "POS access",
      helper: posEnabled ? "Selling workspace is enabled for this business." : "Enable POS from System Admin package or module setup.",
      ready: posEnabled
    },
    {
      label: "Branch ready",
      helper: activeBranches ? `${activeBranches} active branch${activeBranches === 1 ? "" : "es"} available.` : "Create and activate at least one branch.",
      ready: activeBranches > 0
    },
    {
      label: "Products ready",
      helper: activeProducts ? `${activeProducts} active product${activeProducts === 1 ? "" : "s"} can be sold.` : "Create active products before daily selling.",
      ready: activeProducts > 0
    },
    {
      label: "Product codes",
      helper: missingCodeProducts.length ? `${missingCodeProducts.length} item${missingCodeProducts.length === 1 ? "" : "s"} need SKU or barcode.` : "Products are ready for quick search and scanning.",
      ready: missingCodeProducts.length === 0
    }
  ];

  if (inventoryEnabled) {
    checks.push({
      label: "Stock levels",
      helper: lowStockItems.length ? `${lowStockItems.length} low-stock item${lowStockItems.length === 1 ? "" : "s"} need receiving.` : "No low-stock items in the selected branch.",
      ready: lowStockItems.length === 0
    });
  }

  if (tableService) {
    checks.push({
      label: "Table setup",
      helper: tableRows.length ? `${tableRows.length} table${tableRows.length === 1 ? "" : "s"} configured for service.` : "Create tables before using table-service POS.",
      ready: tableRows.length > 0
    });
  }

  return checks;
}

function getActiveModuleKeys(business) {
  return (business?.modules || [])
    .filter((module) => module.active !== false)
    .map((module) => module.module?.key || module.key)
    .filter(Boolean);
}

function buildCounterRows(missingCodeProducts, lowStockItems) {
  const rows = missingCodeProducts.map((product) => {
    const lowStock = lowStockItems.find((stock) => stock.productId === product.id);

    return {
      key: `code-${product.id}`,
      product,
      issue: "Needs code",
      helper: lowStock ? `Also low stock: ${lowStock.quantity} on hand.` : "Add SKU or barcode for faster selling.",
      quantity: lowStock?.quantity
    };
  });

  lowStockItems.forEach((stock) => {
    if (missingCodeProducts.some((product) => product.id === stock.productId)) {
      return;
    }

    rows.push({
      key: `stock-${stock.id}`,
      product: stock.product,
      issue: "Low stock",
      helper: `On hand ${stock.quantity}, reorder at ${stock.reorderLevel}.`,
      quantity: stock.quantity
    });
  });

  return rows;
}

function filterCounterRows(rows, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) =>
    [row.product?.name, row.product?.sku, row.product?.barcode, row.product?.category, row.issue]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery))
  );
}

function filterTableRows(rows, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) =>
    [row.name, row.order?.orderNumber, row.order?.waiter?.name, row.order?.customer?.name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery))
  );
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date(value))
    : "-";
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatPOSMode(mode) {
  const labels = {
    ELECTRONICS_RETAIL: "Electronics checkout",
    PHARMACY: "Pharmacy checkout",
    RETAIL_CHECKOUT: "Retail checkout",
    SUPERMARKET: "Supermarket checkout",
    TABLE_SERVICE: "Table service"
  };

  return labels[mode] || "Configured workflow";
}
